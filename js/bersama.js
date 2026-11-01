/* =====================================================================
 * VeriRad — MODUL BERSAMA
 * Berkas ini IDENTIK di dua tempat:
 *   - frontend : js/bersama.js
 *   - backend  : Bersama.gs
 * Isinya: pembulatan, parser rumus, mesin penilaian toleransi, ringkasan
 * status, template bawaan, dan penyusun HTML laporan.
 * JANGAN memakai API browser (window, document) atau API GAS di sini.
 * Kalau mengubah satu, salin ke yang lain supaya hasil klien = server.
 * ===================================================================== */

var VR_VERSI = '1.0.0';
var VR_KATEGORI = ['Keselamatan', 'Mekanik', 'Kualitas Citra', 'Dosimetri'];
var VR_KATEGORI_KOLOM = { 'Keselamatan': 'st_keselamatan', 'Mekanik': 'st_mekanik', 'Kualitas Citra': 'st_citra', 'Dosimetri': 'st_dosimetri' };
var VR_TIPE_INPUT = { ANGKA: 'Angka (diukur)', HITUNG: 'Dihitung otomatis (rumus)', KUALITATIF: 'Pilihan (kualitatif)' };
var VR_TIPE_TOL = {
  TIDAK_ADA: 'Tanpa toleransi (data pendukung)',
  MAKS: 'Maksimum (nilai ≤ batas)',
  KURANG: 'Kurang dari (nilai < batas)',
  MIN: 'Minimum (nilai ≥ batas)',
  LEBIH: 'Lebih dari (nilai > batas)',
  RENTANG: 'Rentang (min ≤ nilai ≤ maks)',
  MUTLAK_PM: 'Plus-minus (|nilai| ≤ batas)',
  KUALITATIF: 'Harus sama dengan acuan'
};
var VR_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/* ---------------------------------------------------------------------
 * ANGKA & PEMBULATAN
 * ------------------------------------------------------------------- */

/** Ubah teks input menjadi angka. Koma dan titik sama-sama dianggap desimal. */
function vrAngka(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).trim().replace(/\s+/g, '').replace(/−/g, '-');
  if (!s) return null;
  s = s.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  var n = Number(s);
  return isFinite(n) ? n : null;
}

/**
 * Pembulatan half-up (setengah menjauhi nol) yang kebal galat floating point.
 * Contoh: 424.95 → 425.0 (bukan 424.9), 85.65 → 85.7, -1.25 → -1.3.
 */
function vrBulat(x, d) {
  var n = vrAngka(x);
  if (n === null) return null;
  d = (d === undefined || d === null || d === '') ? 2 : Math.max(0, Math.min(6, parseInt(d, 10) || 0));
  n = Number(n.toPrecision(12));                       // buang sisa galat biner
  var tanda = n < 0 ? -1 : 1;
  var a = Math.abs(n);
  var r;
  if (String(a).indexOf('e') > -1) r = Math.round(a * Math.pow(10, d)) / Math.pow(10, d);
  else r = Number(Math.round(Number(a + 'e' + d)) + 'e-' + d);
  r = tanda * r;
  return r === 0 ? 0 : r;                              // hindari -0
}

/** Tampilkan angka dengan d desimal dan pemisah desimal pilihan (',' atau '.'). */
function vrFormat(x, d, sep) {
  var v = vrBulat(x, d);
  if (v === null) return '';
  d = (d === undefined || d === null || d === '') ? 2 : Math.max(0, Math.min(6, parseInt(d, 10) || 0));
  var s = v.toFixed(d);
  return sep === '.' ? s : s.replace('.', ',');
}

/** Angka "apa adanya" untuk teks toleransi (tanpa nol berlebih). */
function vrAngkaRingkas(x, sep) {
  var n = vrAngka(x);
  if (n === null) return String(x === undefined || x === null ? '' : x);
  var s = String(Number(n.toPrecision(10)));
  return sep === '.' ? s : s.replace('.', ',');
}

/* ---------------------------------------------------------------------
 * PARSER RUMUS (aman, tanpa eval)
 * Mendukung: + - * / ^ ( ) angka, kode parameter, fungsi:
 *   avg/rata, sum, min, max, abs, sqrt, pow, round(x,d), log10, ln,
 *   sin, cos, tan, atan, atan2 (radian), deg, rad, dan konstanta pi.
 * ------------------------------------------------------------------- */
var VR_FUNGSI = {
  avg: function (a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; },
  rata: function (a) { return VR_FUNGSI.avg(a); },
  sum: function (a) { return a.reduce(function (s, x) { return s + x; }, 0); },
  min: function (a) { return Math.min.apply(null, a); },
  max: function (a) { return Math.max.apply(null, a); },
  abs: function (a) { return Math.abs(a[0]); },
  sqrt: function (a) { return Math.sqrt(a[0]); },
  pow: function (a) { return Math.pow(a[0], a[1]); },
  round: function (a) { return vrBulat(a[0], a.length > 1 ? a[1] : 0); },
  log10: function (a) { return Math.log(a[0]) / Math.LN10; },
  ln: function (a) { return Math.log(a[0]); },
  sin: function (a) { return Math.sin(a[0]); },
  cos: function (a) { return Math.cos(a[0]); },
  tan: function (a) { return Math.tan(a[0]); },
  atan: function (a) { return Math.atan(a[0]); },
  atan2: function (a) { return Math.atan2(a[0], a[1]); },
  deg: function (a) { return a[0] * 180 / Math.PI; },
  rad: function (a) { return a[0] * Math.PI / 180; }
};

function vrToken(expr) {
  var t = [], i = 0, s = String(expr || '');
  while (i < s.length) {
    var c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      var m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i);
      if (!m) throw new Error('Angka tidak valid di posisi ' + (i + 1));
      t.push({ t: 'n', v: Number(m[0]) }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      var m2 = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      t.push({ t: 'id', v: m2[0] }); i += m2[0].length; continue;
    }
    if ('+-*/^(),'.indexOf(c) > -1) { t.push({ t: c }); i++; continue; }
    throw new Error('Karakter "' + c + '" tidak dikenal dalam rumus');
  }
  return t;
}

/** Ubah rumus menjadi pohon sintaks. Melempar Error bila rumus salah. */
function vrParse(expr) {
  var tok = vrToken(expr), p = 0;
  function lihat(tp) { return tok[p] && tok[p].t === tp; }
  function ambil(tp) { if (!lihat(tp)) throw new Error('Rumus tidak lengkap: diharapkan "' + tp + '"'); return tok[p++]; }
  function ekspresi() {
    var n = suku();
    while (lihat('+') || lihat('-')) { var op = tok[p++].t; n = { op: op, a: n, b: suku() }; }
    return n;
  }
  function suku() {
    var n = faktor();
    while (lihat('*') || lihat('/')) { var op = tok[p++].t; n = { op: op, a: n, b: faktor() }; }
    return n;
  }
  function faktor() {
    var n = unary();
    if (lihat('^')) { p++; n = { op: '^', a: n, b: faktor() }; }
    return n;
  }
  function unary() {
    if (lihat('-')) { p++; return { op: 'neg', a: unary() }; }
    if (lihat('+')) { p++; return unary(); }
    return primer();
  }
  function primer() {
    var k = tok[p];
    if (!k) throw new Error('Rumus berakhir terlalu cepat');
    if (k.t === 'n') { p++; return { num: k.v }; }
    if (k.t === '(') { p++; var e = ekspresi(); ambil(')'); return e; }
    if (k.t === 'id') {
      p++;
      if (lihat('(')) {
        var nama = k.v.toLowerCase();
        if (!VR_FUNGSI[nama]) throw new Error('Fungsi "' + k.v + '" tidak dikenal');
        p++;
        var arg = [];
        if (!lihat(')')) { arg.push(ekspresi()); while (lihat(',')) { p++; arg.push(ekspresi()); } }
        ambil(')');
        return { fn: nama, arg: arg };
      }
      if (k.v.toLowerCase() === 'pi') return { num: Math.PI };
      return { v: k.v };
    }
    throw new Error('Simbol "' + k.t + '" tidak diharapkan');
  }
  var hasil = ekspresi();
  if (p < tok.length) throw new Error('Ada sisa simbol setelah posisi yang valid');
  return hasil;
}

/** Daftar kode parameter yang dipakai di dalam rumus. */
function vrVariabel(ast, out) {
  out = out || [];
  if (!ast) return out;
  if (ast.v && out.indexOf(ast.v) === -1) out.push(ast.v);
  if (ast.a) vrVariabel(ast.a, out);
  if (ast.b) vrVariabel(ast.b, out);
  if (ast.arg) ast.arg.forEach(function (x) { vrVariabel(x, out); });
  return out;
}

/** Hitung pohon sintaks dengan nilai variabel. Mengembalikan null bila ada variabel kosong. */
function vrHitungAst(ast, vars) {
  if (ast.num !== undefined) return ast.num;
  if (ast.v !== undefined) {
    if (!(ast.v in vars)) throw new Error('Kode "' + ast.v + '" tidak ada di template ini');
    var x = vars[ast.v];
    return (x === null || x === undefined) ? null : x;
  }
  if (ast.fn) {
    var a = [];
    for (var i = 0; i < ast.arg.length; i++) { var r = vrHitungAst(ast.arg[i], vars); if (r === null) return null; a.push(r); }
    if (!a.length) throw new Error('Fungsi ' + ast.fn + '() butuh argumen');
    return VR_FUNGSI[ast.fn](a);
  }
  if (ast.op === 'neg') { var u = vrHitungAst(ast.a, vars); return u === null ? null : -u; }
  var A = vrHitungAst(ast.a, vars), B = vrHitungAst(ast.b, vars);
  if (A === null || B === null) return null;
  switch (ast.op) {
    case '+': return A + B;
    case '-': return A - B;
    case '*': return A * B;
    case '/': if (B === 0) throw new Error('Pembagian dengan nol'); return A / B;
    case '^': return Math.pow(A, B);
  }
  throw new Error('Operator tidak dikenal');
}

/** Cek rumus terhadap daftar kode yang tersedia. Mengembalikan pesan error atau ''. */
function vrCekRumus(expr, kodeTersedia) {
  try {
    var v = vrVariabel(vrParse(expr));
    var asing = v.filter(function (k) { return kodeTersedia.indexOf(k) === -1; });
    return asing.length ? 'Kode tidak dikenal: ' + asing.join(', ') : '';
  } catch (e) { return e.message; }
}

/* ---------------------------------------------------------------------
 * MESIN PENILAIAN
 * params : parameter aktif satu template (objek baris TemplateParameter)
 * input  : { KODE: { nilai: '12,3' | 'Berfungsi', na: true/false, alasan: '' } }
 * hasil  : { KODE: { nilai, tampil, status, min, maks, pesan, naOtomatis } }
 * status : LULUS | GAGAL | NA | KOSONG | INFO | ERROR
 * ------------------------------------------------------------------- */
function vrBenar(v) { return v === true || String(v).toUpperCase() === 'TRUE' || v === 1 || v === '1' || String(v).toUpperCase() === 'YA'; }

function vrUrutParam(params) {
  return params.slice().sort(function (a, b) {
    var ka = VR_KATEGORI.indexOf(a.kategori), kb = VR_KATEGORI.indexOf(b.kategori);
    if (ka !== kb) return ka - kb;
    return (Number(a.urutan) || 0) - (Number(b.urutan) || 0);
  });
}

function vrNilaiBatas(b, vars) {
  if (b === null || b === undefined || String(b).trim() === '') return { ada: false };
  var n = vrAngka(b);
  if (n !== null) return { ada: true, v: n };
  try {
    var r = vrHitungAst(vrParse(String(b)), vars);
    return r === null ? { ada: true, v: null, tunggu: true } : { ada: true, v: r };
  } catch (e) { return { ada: true, v: null, err: 'Batas tidak valid: ' + e.message }; }
}

function vrEvaluasi(params, input, sep) {
  input = input || {};
  var ps = vrUrutParam(params.filter(function (p) { return vrBenar(p.aktif === undefined ? true : p.aktif); }));
  var vars = {}, st = {}, out = {};
  // 1. Nilai langsung (ANGKA & KUALITATIF)
  ps.forEach(function (p) {
    var inp = input[p.kode] || {};
    vars[p.kode] = null;
    if (vrBenar(inp.na)) { st[p.kode] = 'NA'; return; }
    if (p.tipe_input === 'HITUNG') { st[p.kode] = 'TUNDA'; return; }
    if (p.tipe_input === 'KUALITATIF') { st[p.kode] = (inp.nilai === undefined || inp.nilai === null || inp.nilai === '') ? 'KOSONG' : 'ISI'; return; }
    var raw = inp.nilai;
    if (raw === undefined || raw === null || String(raw).trim() === '') { st[p.kode] = 'KOSONG'; return; }
    var n = vrAngka(raw);
    if (n === null) { st[p.kode] = 'ERROR'; out[p.kode] = { pesan: 'Bukan angka yang valid' }; return; }
    vars[p.kode] = n; st[p.kode] = 'ISI';
  });
  // 2. Parameter hitung (urut ketergantungan)
  var sisa = ps.filter(function (p) { return st[p.kode] === 'TUNDA'; });
  var putaran = 0;
  while (sisa.length && putaran <= ps.length) {
    putaran++;
    sisa = sisa.filter(function (p) {
      var ast;
      try { ast = vrParse(p.formula); } catch (e) { st[p.kode] = 'ERROR'; out[p.kode] = { pesan: 'Rumus salah: ' + e.message }; return false; }
      var dep = vrVariabel(ast);
      for (var i = 0; i < dep.length; i++) {
        if (!(dep[i] in st)) { st[p.kode] = 'ERROR'; out[p.kode] = { pesan: 'Rumus memakai kode tidak dikenal: ' + dep[i] }; return false; }
        if (st[dep[i]] === 'TUNDA') return true;            // tunggu putaran berikutnya
      }
      var adaNA = dep.filter(function (k) { return st[k] === 'NA'; });
      if (adaNA.length) { st[p.kode] = 'NA'; out[p.kode] = { naOtomatis: true, pesan: 'Tidak dihitung karena ' + adaNA.join(', ') + ' N/A' }; return false; }
      var adaErr = dep.filter(function (k) { return st[k] === 'ERROR'; });
      if (adaErr.length) { st[p.kode] = 'ERROR'; out[p.kode] = { pesan: 'Tergantung ' + adaErr.join(', ') + ' yang tidak valid' }; return false; }
      try {
        var v = vrHitungAst(ast, vars);
        if (v === null) { st[p.kode] = 'KOSONG'; return false; }
        if (!isFinite(v)) throw new Error('hasil tidak terhingga');
        vars[p.kode] = v; st[p.kode] = 'ISI';
      } catch (e2) { st[p.kode] = 'ERROR'; out[p.kode] = { pesan: e2.message }; }
      return false;
    });
  }
  sisa.forEach(function (p) { st[p.kode] = 'ERROR'; out[p.kode] = { pesan: 'Rumus saling bergantung (melingkar)' }; });
  // 3. Penilaian toleransi
  ps.forEach(function (p) {
    var o = out[p.kode] || {};
    var inp = input[p.kode] || {};
    var d = (p.desimal === '' || p.desimal === undefined || p.desimal === null) ? 2 : Number(p.desimal);
    o.min = null; o.maks = null;
    if (st[p.kode] === 'NA') {
      o.status = 'NA'; o.nilai = null; o.tampil = 'N/A';
      if (!o.naOtomatis) o.pesan = inp.alasan || '';
      out[p.kode] = o; return;
    }
    if (st[p.kode] === 'ERROR') { o.status = 'ERROR'; o.nilai = null; o.tampil = '—'; out[p.kode] = o; return; }
    if (p.tipe_input === 'KUALITATIF') {
      o.nilai = st[p.kode] === 'KOSONG' ? null : String(inp.nilai);
      o.tampil = o.nilai === null ? '' : o.nilai;
      if (o.nilai === null) o.status = 'KOSONG';
      else if (p.tipe_toleransi === 'TIDAK_ADA') o.status = 'INFO';
      else o.status = (String(o.nilai).trim().toLowerCase() === String(p.acuan || '').trim().toLowerCase()) ? 'LULUS' : 'GAGAL';
      out[p.kode] = o; return;
    }
    var v = vars[p.kode];
    o.nilai = v; o.tampil = v === null ? '' : vrFormat(v, d, sep);
    var tol = p.tipe_toleransi || 'TIDAK_ADA';
    if (v === null) { o.status = 'KOSONG'; out[p.kode] = o; return; }
    if (tol === 'TIDAK_ADA') { o.status = 'INFO'; out[p.kode] = o; return; }
    var bMin = vrNilaiBatas(p.batas_min, vars), bMaks = vrNilaiBatas(p.batas_maks, vars);
    if (bMin.err || bMaks.err) { o.status = 'ERROR'; o.pesan = bMin.err || bMaks.err; out[p.kode] = o; return; }
    if (bMin.tunggu || bMaks.tunggu) { o.status = 'KOSONG'; o.pesan = 'Batas menunggu nilai lain diisi'; out[p.kode] = o; return; }
    o.min = bMin.ada ? bMin.v : null; o.maks = bMaks.ada ? bMaks.v : null;
    var x = vrBulat(v, d);                                  // nilai yang dilaporkan = nilai yang dinilai
    var lulus = null;
    switch (tol) {
      case 'MAKS': lulus = o.maks === null ? null : x <= o.maks; break;
      case 'KURANG': lulus = o.maks === null ? null : x < o.maks; break;
      case 'MIN': lulus = o.min === null ? null : x >= o.min; break;
      case 'LEBIH': lulus = o.min === null ? null : x > o.min; break;
      case 'RENTANG': lulus = (o.min === null || o.maks === null) ? null : (x >= o.min && x <= o.maks); break;
      case 'MUTLAK_PM': lulus = o.maks === null ? null : Math.abs(x) <= Math.abs(o.maks); break;
      default: lulus = null;
    }
    if (lulus === null) { o.status = 'ERROR'; o.pesan = 'Batas toleransi belum diisi di template'; }
    else o.status = lulus ? 'LULUS' : 'GAGAL';
    out[p.kode] = o;
  });
  return out;
}

/** Teks kriteria toleransi, mis. "≥ 100 lux", "125 – 165 HU", "± 4 HU", "= Berfungsi". */
function vrTeksToleransi(p, min, maks, sep) {
  var u = p.satuan ? ' ' + p.satuan : '';
  var mn = (min !== null && min !== undefined) ? vrAngkaRingkas(min, sep) : String(p.batas_min || '');
  var mk = (maks !== null && maks !== undefined) ? vrAngkaRingkas(maks, sep) : String(p.batas_maks || '');
  switch (p.tipe_toleransi) {
    case 'MAKS': return '≤ ' + mk + u;
    case 'KURANG': return '< ' + mk + u;
    case 'MIN': return '≥ ' + mn + u;
    case 'LEBIH': return '> ' + mn + u;
    case 'RENTANG': return mn + ' s.d. ' + mk + u;
    case 'MUTLAK_PM': return '± ' + String(mk).replace(/^-/, '') + u;
    case 'KUALITATIF': return String(p.acuan || '');
    default: return '';
  }
}

/** Ringkasan status per kategori dan total. Hanya parameter bertoleransi yang dihitung. */
function vrRingkas(params, hasil) {
  var ps = params.filter(function (p) { return vrBenar(p.aktif === undefined ? true : p.aktif); });
  var kat = {}, tot = { lulus: 0, gagal: 0, na: 0, kosong: 0, error: 0, total: 0 };
  VR_KATEGORI.forEach(function (k) { kat[k] = null; });
  ps.forEach(function (p) {
    if (p.tipe_toleransi === 'TIDAK_ADA') return;
    var k = p.kategori;
    if (!kat[k]) kat[k] = { lulus: 0, gagal: 0, na: 0, kosong: 0, error: 0, total: 0, status: null };
    var h = hasil[p.kode] || { status: 'KOSONG' };
    var c = kat[k];
    c.total++; tot.total++;
    if (h.status === 'LULUS') { c.lulus++; tot.lulus++; }
    else if (h.status === 'GAGAL') { c.gagal++; tot.gagal++; }
    else if (h.status === 'NA') { c.na++; tot.na++; }
    else if (h.status === 'ERROR') { c.error++; tot.error++; if (vrBenar(p.wajib)) { c.kosong++; tot.kosong++; } }
    else if (vrBenar(p.wajib)) { c.kosong++; tot.kosong++; }
  });
  var daftar = [];
  VR_KATEGORI.forEach(function (k) {
    var c = kat[k]; if (!c) return;
    c.status = c.gagal ? 'GAGAL' : c.kosong ? 'BELUM' : (c.na === c.total ? 'NA' : 'LULUS');
    daftar.push(c.status);
  });
  tot.status = vrGabungStatus(daftar);
  return { kategori: kat, total: tot };
}

function vrGabungStatus(daftar) {
  if (!daftar.length) return 'BELUM';
  if (daftar.indexOf('GAGAL') > -1) return 'GAGAL';
  if (daftar.indexOf('BELUM') > -1) return 'BELUM';
  if (daftar.every(function (s) { return s === 'NA'; })) return 'NA';
  return 'LULUS';
}

/**
 * Bangun baris SesiQC + HasilQC (dengan snapshot toleransi) dari input form.
 * Dipakai server (sumber kebenaran) dan mode demo.
 * o: { sesi_id, alat, template, params, input, catatan, periode, tanggal,
 *      status_sesi: 'DRAF'|'FINAL', penguji_email, penguji_nama, sekarang, dibuat, sep }
 */
function vrBangunHasil(o) {
  var params = vrUrutParam(o.params.filter(function (p) { return vrBenar(p.aktif === undefined ? true : p.aktif); }));
  var ev = vrEvaluasi(params, o.input, '.');
  var rk = vrRingkas(params, ev);
  var sesi = {
    sesi_id: o.sesi_id, alat_id: o.alat.alat_id, rs_id: o.alat.rs_id,
    template_id: o.template.template_id, template_versi: String(o.template.versi || 1),
    periode: o.periode, tanggal: o.tanggal, status_sesi: o.status_sesi === 'FINAL' ? 'FINAL' : 'DRAF',
    status_total: rk.total.status,
    n_total: rk.total.total, n_lulus: rk.total.lulus, n_gagal: rk.total.gagal, n_na: rk.total.na, n_kosong: rk.total.kosong,
    catatan: String(o.catatan || '').slice(0, 2000),
    penguji_email: o.penguji_email || '', penguji_nama: o.penguji_nama || '',
    dibuat: o.dibuat || o.sekarang, diubah: o.sekarang
  };
  VR_KATEGORI.forEach(function (k) { sesi[VR_KATEGORI_KOLOM[k]] = rk.kategori[k] ? rk.kategori[k].status : ''; });
  var hasil = params.map(function (p) {
    var h = ev[p.kode] || {}, inp = (o.input || {})[p.kode] || {};
    return {
      hasil_id: o.sesi_id + '-' + p.kode, sesi_id: o.sesi_id, alat_id: o.alat.alat_id, periode: o.periode,
      kode: p.kode, nama: p.nama, kategori: p.kategori, kelompok: p.kelompok || '', satuan: p.satuan || '',
      tipe_input: p.tipe_input, tipe_toleransi: p.tipe_toleransi || 'TIDAK_ADA',
      batas_min: String(p.batas_min === undefined || p.batas_min === null ? '' : p.batas_min),
      batas_maks: String(p.batas_maks === undefined || p.batas_maks === null ? '' : p.batas_maks),
      min_terpakai: h.min === null || h.min === undefined ? '' : String(h.min),
      maks_terpakai: h.maks === null || h.maks === undefined ? '' : String(h.maks),
      formula: p.formula || '', opsi: p.opsi || '', wajib: vrBenar(p.wajib) ? 'TRUE' : 'FALSE', boleh_na: vrBenar(p.boleh_na) ? 'TRUE' : 'FALSE',
      acuan: p.acuan || '', desimal: String(p.desimal === undefined ? 2 : p.desimal), urutan: String(p.urutan || 0),
      nilai_input: inp.nilai === undefined || inp.nilai === null ? '' : String(inp.nilai).slice(0, 200),
      nilai: h.nilai === null || h.nilai === undefined ? '' : String(h.nilai),
      status: h.status || 'KOSONG',
      alasan_na: h.status === 'NA' ? String(h.pesan || inp.alasan || '').slice(0, 500) : ''
    };
  });
  if (o.status_sesi === 'FINAL') {
    var kurang = hasil.filter(function (h) { return h.status === 'NA' && !h.alasan_na; });
    if (kurang.length) throw new Error('Alasan N/A wajib diisi: ' + kurang.map(function (h) { return h.kode; }).join(', '));
    var err = hasil.filter(function (h) { return h.status === 'ERROR'; });
    if (err.length) throw new Error('Masih ada nilai/rumus yang tidak valid: ' + err.map(function (h) { return h.kode; }).join(', '));
  }
  return { sesi: sesi, hasil: hasil };
}

/** Rekonstruksi daftar parameter dari snapshot HasilQC (dipakai saat membuka/mengubah sesi FINAL). */
function vrParamDariHasil(hasilRows) {
  return (hasilRows || []).map(function (h) {
    return {
      kode: h.kode, nama: h.nama, kategori: h.kategori, kelompok: h.kelompok, satuan: h.satuan, tipe_input: h.tipe_input,
      tipe_toleransi: h.tipe_toleransi, batas_min: h.batas_min, batas_maks: h.batas_maks, formula: h.formula, opsi: h.opsi,
      acuan: h.acuan, desimal: h.desimal, urutan: h.urutan, wajib: h.wajib, boleh_na: h.boleh_na, aktif: 'TRUE', keterangan: ''
    };
  });
}

/** Ubah baris HasilQC kembali menjadi map input form. */
function vrInputDariHasil(hasilRows) {
  var m = {};
  (hasilRows || []).forEach(function (h) {
    if (h.tipe_input === 'HITUNG' && h.status !== 'NA') return;
    m[h.kode] = { nilai: h.nilai_input, na: h.status === 'NA' && !/^Tidak dihitung karena/.test(h.alasan_na || ''), alasan: h.alasan_na || '' };
  });
  return m;
}

/* ---------------------------------------------------------------------
 * TANGGAL & PERIODE
 * ------------------------------------------------------------------- */
function vrNamaPeriode(per) {
  var m = String(per || '').match(/^(\d{4})-(\d{2})$/);
  return m ? VR_BULAN[Number(m[2]) - 1] + ' ' + m[1] : String(per || '');
}
function vrTanggalPanjang(t) {
  var m = String(t || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Number(m[3]) + ' ' + VR_BULAN[Number(m[2]) - 1] + ' ' + m[1] : String(t || '');
}
function vrGeserPeriode(per, n) {
  var m = String(per).match(/^(\d{4})-(\d{2})$/);
  var t = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  var y = Math.floor(t / 12), b = t % 12 + 1;
  return y + '-' + (b < 10 ? '0' : '') + b;
}

/* ---------------------------------------------------------------------
 * TEMPLATE BAWAAN (dari Lampiran A PRD — dapat diedit di menu Template)
 * Butir bertanda ⚠ menunggu keputusan fisikawan medis (Lampiran B).
 * ------------------------------------------------------------------- */
function vrTemplateBawaan() {
  var urut = 0;
  function P(kat, kel, kode, nama, tipe, sat, tol, mn, mk, f, ext) {
    ext = ext || {};
    urut += 10;
    return {
      kategori: kat, kelompok: kel, kode: kode, nama: nama, tipe_input: tipe, satuan: sat || '',
      tipe_toleransi: tol, batas_min: mn === undefined || mn === null ? '' : String(mn), batas_maks: mk === undefined || mk === null ? '' : String(mk),
      formula: f || '', opsi: ext.opsi || '', acuan: ext.acuan || '', desimal: String(ext.d === undefined ? 2 : ext.d),
      urutan: String(urut), wajib: ext.wajib === false ? 'FALSE' : 'TRUE', boleh_na: ext.na ? 'TRUE' : 'FALSE', aktif: 'TRUE',
      keterangan: ext.ket || ''
    };
  }
  var FUNGSI = { opsi: 'Berfungsi|Tidak Berfungsi', acuan: 'Berfungsi', d: 0 };
  var BAIK = { opsi: 'Baik|Rusak / Tidak Ada', acuan: 'Baik', d: 0 };
  function radiografi() {
    urut = 0;
    return [
      P('Keselamatan', 'Ruangan', 'LAMPU', 'Fungsi lampu indikator radiasi', 'KUALITATIF', '', 'KUALITATIF', '', '', '', FUNGSI),
      P('Keselamatan', 'Ruangan', 'SIGN', 'Kondisi penanda peringatan radiasi', 'KUALITATIF', '', 'KUALITATIF', '', '', '', BAIK),
      P('Mekanik', 'Iluminasi', 'IL_Q1', 'Iluminasi kuadran I', 'ANGKA', 'lux', 'TIDAK_ADA', '', '', '', { d: 1 }),
      P('Mekanik', 'Iluminasi', 'IL_Q2', 'Iluminasi kuadran II', 'ANGKA', 'lux', 'TIDAK_ADA', '', '', '', { d: 1 }),
      P('Mekanik', 'Iluminasi', 'IL_Q3', 'Iluminasi kuadran III', 'ANGKA', 'lux', 'TIDAK_ADA', '', '', '', { d: 1 }),
      P('Mekanik', 'Iluminasi', 'IL_Q4', 'Iluminasi kuadran IV', 'ANGKA', 'lux', 'TIDAK_ADA', '', '', '', { d: 1 }),
      P('Mekanik', 'Iluminasi', 'IL_LATAR', 'Cahaya latar (ambien)', 'ANGKA', 'lux', 'TIDAK_ADA', '', '', '', { d: 1 }),
      P('Mekanik', 'Iluminasi', 'IL_RATA', 'Rata-rata iluminasi 4 kuadran', 'HITUNG', 'lux', 'TIDAK_ADA', '', '', 'avg(IL_Q1, IL_Q2, IL_Q3, IL_Q4)', { d: 1 }),
      P('Mekanik', 'Iluminasi', 'IL_SELISIH', 'Selisih iluminasi (rata-rata − latar)', 'HITUNG', 'lux', 'MIN', 100, '', 'IL_RATA - IL_LATAR',
        { d: 1, ket: '⚠ Dokumen lain memakai "> 100 lux". Ganti tipe ke "Lebih dari" bila itu acuan Anda (Lampiran B no. 6).' }),
      P('Mekanik', 'Kolimasi', 'KOL_X1', 'Pergeseran kolimasi X1', 'ANGKA', '%', 'TIDAK_ADA', '', '', ''),
      P('Mekanik', 'Kolimasi', 'KOL_X2', 'Pergeseran kolimasi X2', 'ANGKA', '%', 'TIDAK_ADA', '', '', ''),
      P('Mekanik', 'Kolimasi', 'KOL_Y1', 'Pergeseran kolimasi Y1', 'ANGKA', '%', 'TIDAK_ADA', '', '', ''),
      P('Mekanik', 'Kolimasi', 'KOL_Y2', 'Pergeseran kolimasi Y2', 'ANGKA', '%', 'TIDAK_ADA', '', '', ''),
      P('Mekanik', 'Kolimasi', 'KOL_X', 'Deviasi kolimasi sumbu X (|X1|+|X2|)', 'HITUNG', '%', 'MAKS', '', 2, 'abs(KOL_X1) + abs(KOL_X2)',
        { ket: '⚠ Tabel lain memakai ΔX ≤ 2 cm (setara 2% pada SID 100 cm) — Lampiran B no. 5.' }),
      P('Mekanik', 'Kolimasi', 'KOL_Y', 'Deviasi kolimasi sumbu Y (|Y1|+|Y2|)', 'HITUNG', '%', 'MAKS', '', 2, 'abs(KOL_Y1) + abs(KOL_Y2)'),
      P('Mekanik', 'Kolimasi', 'KOL_XY', 'Deviasi kolimasi total (X + Y)', 'HITUNG', '%', 'MAKS', '', 3, 'KOL_X + KOL_Y'),
      P('Mekanik', 'Ketegaklurusan Berkas', 'TEGAK_JARAK', 'Pergeseran pusat berkas (jarak)', 'ANGKA', 'cm', 'MAKS', '', 0.5, '',
        { ket: '⚠ Tabel lain memakai ≤ 8 mm (Lampiran B no. 5).' }),
      P('Mekanik', 'Ketegaklurusan Berkas', 'TEGAK_SUDUT', 'Kemiringan berkas (sudut)', 'ANGKA', '°', 'MAKS', '', 1.4, '',
        { ket: '⚠ Tabel lain memakai ≤ 3° (Lampiran B no. 5).' }),
      P('Mekanik', 'Fungsional', 'FUNG_TABUNG', 'Fungsional pergeseran tabung', 'KUALITATIF', '', 'KUALITATIF', '', '', '', FUNGSI),
      P('Mekanik', 'Fungsional', 'FUNG_KOLIMATOR', 'Fungsional bukaan kolimasi', 'KUALITATIF', '', 'KUALITATIF', '', '', '', FUNGSI),
      P('Dosimetri', 'Generator', 'DOS_KV', 'Akurasi tegangan (kV)', 'ANGKA', '%', 'KURANG', '', 10, '', { na: true }),
      P('Dosimetri', 'Keluaran', 'DOS_LIN', 'Linearitas keluaran (CL)', 'ANGKA', '', 'KURANG', '', 0.1, '', { na: true, d: 3 }),
      P('Dosimetri', 'Keluaran', 'DOS_REP', 'Reproduksibilitas keluaran (CV)', 'ANGKA', '', 'KURANG', '', 0.05, '', { na: true, d: 3 }),
      P('Dosimetri', 'Kualitas Berkas', 'DOS_HVL', 'Kualitas berkas (HVL)', 'ANGKA', 'mmAl', 'LEBIH', 3.7, '', '', { na: true })
    ];
  }
  function ct() {
    urut = 0;
    var lin = [['AKRIL_B', 'Akrilik besar', 125, 165], ['AKRIL_K', 'Akrilik kecil', 125, 165], ['LEKSAN', 'Leksan', 101, 131],
      ['NILON', 'Nilon', 85, 115], ['PE', 'Polietilen', -90, -60], ['TEFLON', 'Teflon', 996, 1066], ['AIR', 'Air', -4, 4]];
    var arr = [
      P('Keselamatan', 'Ruangan', 'LAMPU', 'Fungsi lampu indikator radiasi', 'KUALITATIF', '', 'KUALITATIF', '', '', '', FUNGSI),
      P('Keselamatan', 'Ruangan', 'SIGN', 'Kondisi penanda peringatan radiasi', 'KUALITATIF', '', 'KUALITATIF', '', '', '', BAIK),
      P('Keselamatan', 'Ruangan', 'AUDIO', 'Fungsi audio visual', 'KUALITATIF', '', 'KUALITATIF', '', '', '', FUNGSI),
      P('Mekanik', 'Laser Penanda', 'SLICE_MIN', 'Tebal slice minimum alat', 'ANGKA', 'mm', 'TIDAK_ADA', '', '', '', { d: 2 }),
      P('Mekanik', 'Laser Penanda', 'LASER_DEV', 'Deviasi laser penanda', 'ANGKA', 'mm', 'MAKS', '', 'SLICE_MIN', '',
        { ket: 'Batas = tebal slice minimum (diisi pada SLICE_MIN).' }),
      P('Mekanik', 'Posisi Meja', 'MEJA_SD', 'Selisih posisi meja vs indikator (SD)', 'ANGKA', 'mm', 'MAKS', '', 1, '',
        { ket: '⚠ Tabel lain memakai akurasi ± 2 mm (Lampiran B no. 5).' }),
      P('Mekanik', 'Fungsional', 'TOMBOL', 'Fungsional tombol', 'KUALITATIF', '', 'KUALITATIF', '', '', '', FUNGSI),
      P('Kualitas Citra', 'Akurasi CT Number', 'CT_AIR', 'Akurasi CT number air (mean ROI pusat)', 'ANGKA', 'HU', 'MUTLAK_PM', '', 4, ''),
      P('Kualitas Citra', 'Keseragaman Noise', 'SD_C', 'SD ROI pusat', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman Noise', 'SD_12', 'SD ROI jam 12', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman Noise', 'SD_3', 'SD ROI jam 3', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman Noise', 'SD_6', 'SD ROI jam 6', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman Noise', 'SD_9', 'SD ROI jam 9', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman Noise', 'NOISE_UNI', 'Keseragaman noise (SD maks − SD min)', 'HITUNG', 'HU', 'MAKS', '', 2,
        'max(SD_C, SD_12, SD_3, SD_6, SD_9) - min(SD_C, SD_12, SD_3, SD_6, SD_9)',
        { ket: '⚠ Laporan Des 2024 menulis 0,64 untuk selisih 0,90 (≈ dibagi √2). Bila itu rumus Anda, tambahkan "/ sqrt(2)" (Lampiran B no. 3).' }),
      P('Kualitas Citra', 'Keseragaman CT Number', 'M_C', 'Mean ROI pusat', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman CT Number', 'M_12', 'Mean ROI jam 12', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman CT Number', 'M_3', 'Mean ROI jam 3', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman CT Number', 'M_6', 'Mean ROI jam 6', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman CT Number', 'M_9', 'Mean ROI jam 9', 'ANGKA', 'HU', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Keseragaman CT Number', 'UNI_CT', 'Keseragaman CT pusat–tepi (selisih terbesar)', 'HITUNG', 'HU', 'MAKS', '', 2,
        'max(abs(M_C - M_12), abs(M_C - M_3), abs(M_C - M_6), abs(M_C - M_9))',
        { ket: '⚠ Rumus dan batas perlu dikonfirmasi: laporan Des 2024 menulis 1,30; tabel lain memakai 4 HU (Lampiran B no. 4–5).' })
    ];
    lin.forEach(function (l) {
      arr.push(P('Kualitas Citra', 'Linearitas CT Number', 'LIN_' + l[0], 'Linearitas CT number — ' + l[1], 'ANGKA', 'HU', 'RENTANG', l[2], l[3], '', { d: 1 }));
    });
    arr = arr.concat([
      P('Kualitas Citra', 'Geometri', 'GEO_UKUR', 'Diameter terukur pada akrilik besar', 'ANGKA', 'mm', 'TIDAK_ADA', '', '', ''),
      P('Kualitas Citra', 'Geometri', 'GEO_DEV', 'Deviasi geometri (terukur − 50 mm)', 'HITUNG', 'mm', 'MUTLAK_PM', '', 1, 'GEO_UKUR - 50',
        { ket: '⚠ Nominal 50 mm diasumsikan dari laporan Des 2024 (Lampiran B no. 2).' }),
      P('Kualitas Citra', 'Artefak', 'ARTEFAK', 'Artefak citra', 'KUALITATIF', '', 'KUALITATIF', '', '', '', { opsi: 'Tidak ada artefak|Ada artefak', acuan: 'Tidak ada artefak', d: 0 }),
      P('Dosimetri', 'Generator', 'DOS_KV', 'Akurasi tegangan (kV)', 'ANGKA', '%', 'KURANG', '', 6, '', { na: true }),
      P('Dosimetri', 'Keluaran', 'DOS_LIN', 'Linearitas keluaran (CL)', 'ANGKA', '', 'KURANG', '', 0.1, '', { na: true, d: 3 }),
      P('Dosimetri', 'Keluaran', 'DOS_REP', 'Reproduksibilitas keluaran (CV)', 'ANGKA', '', 'KURANG', '', 0.05, '', { na: true, d: 3 }),
      P('Dosimetri', 'Kualitas Berkas', 'DOS_HVL', 'Kualitas berkas (HVL)', 'ANGKA', 'mmAl', 'LEBIH', 3.7, '', '', { na: true })
    ]);
    return arr;
  }
  function panoramik() {
    urut = 0;
    return [
      P('Mekanik', 'Kolimasi', 'PAN_PANJANG', 'Kolimasi — panjang', 'ANGKA', 'mm', 'MIN', 149, '', '',
        { d: 1, ket: '⚠ Laporan Des 2024: 142 mm berstatus Lulus padahal batas ≥ 149 mm. Pastikan batasnya (Lampiran B no. 1).' }),
      P('Mekanik', 'Kolimasi', 'PAN_LEBAR', 'Kolimasi — lebar', 'ANGKA', 'mm', 'MIN', 7, '', '', { d: 1 })
    ];
  }
  return [
    { template_id: 'TPL-RU', nama: 'Radiografi Umum', singkatan: 'RU', versi: '1', aktif: 'TRUE', params: radiografi() },
    { template_id: 'TPL-MOB', nama: 'Radiografi Mobile', singkatan: 'MX', versi: '1', aktif: 'TRUE', params: radiografi() },
    { template_id: 'TPL-CT', nama: 'CT Scan', singkatan: 'CT', versi: '1', aktif: 'TRUE', params: ct() },
    { template_id: 'TPL-PAN', nama: 'Dental Panoramik', singkatan: 'DP', versi: '1', aktif: 'TRUE', params: panoramik() }
  ];
}

/* ---------------------------------------------------------------------
 * LAPORAN BULANAN (HTML → PDF di server, pratinjau di browser)
 * o: { rs, alat:[...], sesi:[...], hasil:[...], periode, profil:{nama,no_izin,kota},
 *      logo:'data:...', ttd:'data:...', grafik:[{judul,src}], tanggal:'YYYY-MM-DD',
 *      sep:',', templates:[...] }
 * ------------------------------------------------------------------- */
function vrEsc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

var VR_LABEL_STATUS = { LULUS: 'LULUS', GAGAL: 'GAGAL', NA: 'N/A', BELUM: 'BELUM', KOSONG: 'BELUM', INFO: '', ERROR: 'TIDAK VALID' };

function vrLaporanHtml(o) {
  var sep = o.sep || ',';
  var rs = o.rs || {};
  var profil = o.profil || {};
  var tplNama = {};
  (o.templates || []).forEach(function (t) { tplNama[t.template_id] = t.nama; });
  var sesiPer = {};
  (o.sesi || []).forEach(function (s) { if (s.periode === o.periode && s.rs_id === rs.rs_id) sesiPer[s.alat_id] = s; });
  var hasilPer = {};
  (o.hasil || []).forEach(function (h) { (hasilPer[h.sesi_id] = hasilPer[h.sesi_id] || []).push(h); });
  var alat = (o.alat || []).filter(function (a) { return a.rs_id === rs.rs_id && vrBenar(a.aktif); });
  alat.sort(function (a, b) { return String(a.kode).localeCompare(String(b.kode)); });

  function badge(s) {
    var warna = { LULUS: '#15803D', GAGAL: '#B91C1C', NA: '#64748B', BELUM: '#475569', KOSONG: '#475569', ERROR: '#B91C1C' }[s] || '#475569';
    var latar = { LULUS: '#DCFCE7', GAGAL: '#FEE2E2' }[s] || '#F1F5F9';
    var ikon = { LULUS: '&#9679;', GAGAL: '&#9632;', NA: '&#9671;' }[s] || '&#9675;';
    if (s === 'INFO' || !s) return '<span style="color:#94A3B8">–</span>';
    return '<span style="display:inline-block;padding:1px 6px;border-radius:8px;background:' + latar + ';color:' + warna + ';font-weight:bold;font-size:8pt;white-space:nowrap">' + ikon + ' ' + (VR_LABEL_STATUS[s] || s) + '</span>';
  }

  var jumlah = { LULUS: 0, GAGAL: 0, BELUM: 0, NA: 0 };
  var barisRingkas = alat.map(function (a, i) {
    var s = sesiPer[a.alat_id];
    var stat = s && s.status_sesi === 'FINAL' ? s.status_total : 'BELUM';
    jumlah[stat] = (jumlah[stat] || 0) + 1;
    var sel = VR_KATEGORI.map(function (k) {
      var v = s && s.status_sesi === 'FINAL' ? s[VR_KATEGORI_KOLOM[k]] : '';
      return '<td style="text-align:center">' + (v ? badge(v) : '<span style="color:#94A3B8">–</span>') + '</td>';
    }).join('');
    return '<tr><td>' + (i + 1) + '</td><td><b>' + vrEsc(a.kode) + '</b><br>' + vrEsc(a.merek + ' ' + a.tipe) + '<br><span style="color:#64748B">' + vrEsc(tplNama[a.template_id] || '') + ' · ' + vrEsc(a.ruangan) + '</span></td>' + sel +
      '<td style="text-align:center">' + (s && s.status_sesi === 'FINAL' ? badge(stat) : badge('BELUM') + (s ? '<br><span style="font-size:7pt;color:#64748B">draf</span>' : '')) + '</td></tr>';
  }).join('');

  var detail = alat.map(function (a) {
    var s = sesiPer[a.alat_id];
    var kepala = '<div style="background:#0F1E3D;color:#fff;padding:6px 8px;margin-top:14px;font-weight:bold">' +
      vrEsc(a.kode) + ' — ' + vrEsc(tplNama[a.template_id] || '') + ' · ' + vrEsc(a.merek + ' ' + a.tipe) + '</div>' +
      '<div style="padding:4px 8px;border:1px solid #E3E8EF;border-top:none;font-size:8pt;color:#334155">No. seri tabung: <b>' + vrEsc(a.no_seri_tabung) + '</b> &nbsp;·&nbsp; Ruangan: <b>' + vrEsc(a.ruangan) + '</b>' +
      (s ? ' &nbsp;·&nbsp; Tanggal uji: <b>' + vrEsc(vrTanggalPanjang(s.tanggal)) + '</b>' : '') + '</div>';
    if (!s || s.status_sesi !== 'FINAL') return kepala + '<p style="color:#64748B;font-style:italic;margin:6px 0">' + (s ? 'Pengujian masih berupa draf dan belum disimpan final.' : 'Belum diuji pada periode ini.') + '</p>';
    var rows = (hasilPer[s.sesi_id] || []).slice().sort(function (x, y) {
      var kx = VR_KATEGORI.indexOf(x.kategori), ky = VR_KATEGORI.indexOf(y.kategori);
      return kx !== ky ? kx - ky : Number(x.urutan) - Number(y.urutan);
    });
    var no = 0, katSebelum = '';
    var isi = rows.map(function (h) {
      var data = h.tipe_toleransi === 'TIDAK_ADA';
      var nilai = h.status === 'NA' ? 'N/A' : (h.tipe_input === 'KUALITATIF' ? vrEsc(h.nilai) : (h.nilai === '' ? '' : vrFormat(h.nilai, h.desimal, sep) + (h.satuan ? ' ' + vrEsc(h.satuan) : '')));
      var krit = vrEsc(vrTeksToleransi(h, h.min_terpakai === '' || h.min_terpakai === undefined ? null : vrAngka(h.min_terpakai),
        h.maks_terpakai === '' || h.maks_terpakai === undefined ? null : vrAngka(h.maks_terpakai), sep));
      var katSel = h.kategori !== katSebelum ? vrEsc(h.kategori) : '';
      katSebelum = h.kategori;
      if (!data) no++;
      return '<tr style="' + (data ? 'color:#64748B;font-size:7.5pt' : '') + (h.status === 'GAGAL' ? 'background:#FEF2F2' : '') + '">' +
        '<td style="text-align:center">' + (data ? '' : no) + '</td><td>' + katSel + '</td>' +
        '<td>' + (data ? '&nbsp;&nbsp;' : '') + vrEsc(h.nama) + (h.kelompok && !data ? '<br><span style="color:#64748B;font-size:7pt">' + vrEsc(h.kelompok) + '</span>' : '') + '</td>' +
        '<td style="text-align:right;font-family:Courier New,monospace">' + nilai + '</td>' +
        '<td style="text-align:center;font-family:Courier New,monospace">' + krit + '</td>' +
        '<td style="text-align:center">' + (data ? '' : badge(h.status)) + '</td></tr>';
    }).join('');
    var na = rows.filter(function (h) { return h.status === 'NA' && h.tipe_toleransi !== 'TIDAK_ADA'; });
    var naHtml = na.length ? '<p style="font-size:8pt;margin:4px 0"><b>Parameter tidak diuji (N/A):</b> ' + na.map(function (h) { return vrEsc(h.nama) + ' — ' + vrEsc(h.alasan_na); }).join('; ') + '</p>' : '';
    var cat = s.catatan ? '<p style="font-size:8pt;margin:4px 0;padding:6px;border-left:3px solid #F37021;background:#FFF7F0"><b>Catatan fisikawan medis:</b> ' + vrEsc(s.catatan) + '</p>' : '';
    return kepala + '<table class="t"><thead><tr><th style="width:24px">No</th><th style="width:70px">Aspek</th><th>Deskripsi Uji</th><th style="width:80px">Hasil</th><th style="width:90px">Kriteria</th><th style="width:62px">Status</th></tr></thead><tbody>' + isi + '</tbody></table>' + naHtml + cat;
  }).join('');

  var grafik = (o.grafik || []).length ? '<h3 style="font-size:10pt;margin:16px 0 6px;color:#0F1E3D">Grafik Tren</h3>' + o.grafik.map(function (g) {
    return '<div style="margin:6px 0;page-break-inside:avoid"><div style="font-size:8pt;font-weight:bold;color:#1B2A4A">' + vrEsc(g.judul) + '</div><img src="' + g.src + '" style="width:100%;max-width:640px;border:1px solid #E3E8EF"></div>';
  }).join('') : '';

  var kop = '<table style="width:100%;border-collapse:collapse"><tr>' +
    '<td style="width:70px;vertical-align:middle">' + (o.logo ? '<img src="' + o.logo + '" style="width:60px;height:60px;object-fit:contain">' : '') + '</td>' +
    '<td style="text-align:center;vertical-align:middle"><div style="font-size:14pt;font-weight:bold;color:#0F1E3D">' + vrEsc(rs.nama) + '</div>' +
    '<div style="font-size:9pt;color:#334155">' + vrEsc(rs.alamat) + (rs.telepon ? ' · Telp. ' + vrEsc(rs.telepon) : '') + '</div></td>' +
    '<td style="width:70px"></td></tr></table><div style="border-bottom:2px solid #0F1E3D;margin:6px 0 1px"></div><div style="border-bottom:1px solid #F37021;margin-bottom:10px"></div>';

  var css = '<style>@page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#0F172A;margin:0}' +
    'table.t{width:100%;border-collapse:collapse;margin:0}table.t th{background:#F1F5F9;color:#1B2A4A;font-size:7.5pt;text-transform:uppercase;padding:4px;border:1px solid #CBD5E1;text-align:left}' +
    'table.t td{padding:3px 4px;border:1px solid #E3E8EF;vertical-align:top;font-size:8pt}</style>';

  var ringkas = '<table style="width:100%;border-collapse:collapse;margin:8px 0"><tr>' +
    [['Jumlah alat', alat.length, '#1B2A4A'], ['Lulus', jumlah.LULUS || 0, '#15803D'], ['Gagal', jumlah.GAGAL || 0, '#B91C1C'], ['Belum/draf', jumlah.BELUM || 0, '#475569'], ['N/A', jumlah.NA || 0, '#64748B']]
      .map(function (k) { return '<td style="border:1px solid #E3E8EF;padding:6px;text-align:center"><div style="font-size:7pt;color:#64748B;text-transform:uppercase">' + k[0] + '</div><div style="font-size:16pt;font-weight:bold;color:' + k[2] + '">' + k[1] + '</div></td>'; }).join('') +
    '</tr></table>';

  var ttd = '<table style="width:100%;margin-top:24px;page-break-inside:avoid;border-collapse:collapse"><tr>' +
    '<td style="width:50%;text-align:center;vertical-align:top">Mengetahui,<br>' + vrEsc(rs.jabatan_penandatangan || 'Kepala Instalasi Radiologi') + '<div style="height:64px"></div>' +
    '<b><u>' + vrEsc(rs.nama_penandatangan || '..............................') + '</u></b><br>' + (rs.nip_penandatangan ? 'NIP. ' + vrEsc(rs.nip_penandatangan) : '') + '</td>' +
    '<td style="width:50%;text-align:center;vertical-align:top">' + vrEsc((profil.kota ? profil.kota + ', ' : '') + vrTanggalPanjang(o.tanggal)) + '<br>Fisikawan Medis' +
    (o.ttd ? '<div style="height:64px"><img src="' + o.ttd + '" style="height:60px"></div>' : '<div style="height:64px"></div>') +
    '<b><u>' + vrEsc(profil.nama || '') + '</u></b><br>' + vrEsc(profil.no_izin || '') + '</td></tr></table>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Laporan QC ' + vrEsc(rs.nama) + ' ' + vrEsc(vrNamaPeriode(o.periode)) + '</title>' + css + '</head><body>' +
    kop +
    '<div style="text-align:center;font-size:12pt;font-weight:bold;color:#0F1E3D">LAPORAN QUALITY CONTROL BULANAN</div>' +
    '<div style="text-align:center;font-size:10pt;margin-bottom:8px">Alat Radiologi · Periode ' + vrEsc(vrNamaPeriode(o.periode)) + '</div>' +
    '<table class="t" style="margin-bottom:6px"><tr><td style="width:25%;background:#F8FAFC">Fisikawan medis</td><td>' + vrEsc(profil.nama || '') + (profil.no_izin ? ' (' + vrEsc(profil.no_izin) + ')' : '') + '</td>' +
    '<td style="width:20%;background:#F8FAFC">Tanggal laporan</td><td>' + vrEsc(vrTanggalPanjang(o.tanggal)) + '</td></tr></table>' +
    '<h3 style="font-size:10pt;margin:10px 0 4px;color:#0F1E3D">I. Ringkasan</h3>' + ringkas +
    '<table class="t"><thead><tr><th style="width:20px">No</th><th>Alat</th><th>Keselamatan</th><th>Mekanik</th><th>Kualitas Citra</th><th>Dosimetri</th><th>Status Akhir</th></tr></thead><tbody>' + barisRingkas + '</tbody></table>' +
    '<h3 style="font-size:10pt;margin:14px 0 4px;color:#0F1E3D">II. Rincian Hasil Pengujian</h3>' + detail +
    grafik + ttd +
    '<div style="margin-top:16px;border-top:1px solid #E3E8EF;padding-top:4px;font-size:7pt;color:#94A3B8">Dibuat dengan VeriRad · ' + vrEsc(rs.nama) + ' · ' + vrEsc(vrNamaPeriode(o.periode)) + '</div>' +
    '</body></html>';
}
