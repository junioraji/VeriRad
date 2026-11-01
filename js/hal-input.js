/* =====================================================================
 * VeriRad — Input QC: pilih RS & alat → form per kategori → tinjau & simpan
 * Penilaian Lulus/Gagal berjalan di browser (instan); server menilai ulang
 * saat menyimpan (sumber kebenaran). Draf disimpan otomatis di perangkat.
 * ===================================================================== */
'use strict';

let InputRs = '';
let InputJenis = '';
let F = null;   // state form aktif

daftarHalaman('input', {
  judul: 'Input QC', akses: 'fismed',
  render(el, alatId) { if (alatId) renderFormQc(el, alatId); else renderPilihAlat(el); }
});

function stepper(n) {
  return '<div class="stepper">' + ['Pilih RS & alat', 'Isi form QC', 'Tinjau & simpan'].map((t, i) =>
    '<div class="st ' + (i + 1 === n ? 'on' : i + 1 < n ? 'done' : '') + '"><b>' + (i + 1 < n ? '✓' : i + 1) + '</b>' + t + '</div>').join('') + '</div>';
}

/* ---------------- Langkah 1: pilih alat ---------------- */
function renderPilihAlat(el) {
  const per = AppState.periode, rsList = rsAktif();
  if (!rsList.length) { el.innerHTML = kosong('Belum ada rumah sakit', 'Tambahkan rumah sakit dan alat terlebih dahulu.', '<a class="btn btn-primary" href="#/kelola">' + ic('plus') + 'Kelola RS & Alat</a>'); return; }
  if (!InputRs || !getRs(InputRs)) InputRs = (AppState.filterRs && getRs(AppState.filterRs)) ? AppState.filterRs : rsList[0].rs_id;
  const rs = getRs(InputRs);
  const alatRs = alatAktif(InputRs);
  const jenisAda = AppState.templates.filter(t => alatRs.some(a => a.template_id === t.template_id));
  const alat = alatRs.filter(a => !InputJenis || a.template_id === InputJenis);
  el.innerHTML = '<div class="page-h"><div><h1>Input QC Bulanan</h1><p>Periode ' + esc(vrNamaPeriode(per)) + ' · ganti periode di bilah atas bila perlu.</p></div></div>' + stepper(1) +
    '<div class="rs-cards">' + rsList.map(r => {
      const al = alatAktif(r.rs_id), sel = al.filter(a => statusAlat(a.alat_id, per).sesi && statusAlat(a.alat_id, per).sesi.status_sesi === 'FINAL').length;
      return '<button class="rs-card" data-rs="' + r.rs_id + '" aria-pressed="' + (r.rs_id === InputRs) + '"><span class="hstack between"><span class="nm">' + esc(r.nama) + '</span>' + (r.kode ? '<span class="tag tag-soft">' + esc(r.kode) + '</span>' : '') + '</span>' +
        '<span class="small muted">' + al.length + ' alat aktif · ' + sel + ' selesai</span><span class="progress light"><i style="width:' + (al.length ? sel / al.length * 100 : 0) + '%"></i></span></button>';
    }).join('') + '</div>' +
    '<div class="hstack between"><div class="hstack"><button class="chip" data-j="" aria-pressed="' + !InputJenis + '">Semua <span class="n">' + alatRs.length + '</span></button>' +
    jenisAda.map(t => '<button class="chip" data-j="' + t.template_id + '" aria-pressed="' + (InputJenis === t.template_id) + '">' + esc(t.nama) + ' <span class="n">' + alatRs.filter(a => a.template_id === t.template_id).length + '</span></button>').join('') + '</div>' +
    '<div class="field" style="min-width:220px"><label class="sr-only" for="cari-alat">Cari alat</label><input class="input" id="cari-alat" placeholder="Cari kode, merek, no. seri, ruangan…"></div></div>' +
    '<div class="dev-grid" id="dev-grid"></div>';
  const grid = $('#dev-grid', el);
  function gambar(q) {
    q = (q || '').toLowerCase();
    const list = alat.filter(a => !q || [a.kode, a.merek, a.tipe, a.no_seri_tabung, a.ruangan].join(' ').toLowerCase().indexOf(q) > -1);
    grid.innerHTML = list.map(a => kartuAlat(a, per)).join('') +
      '<a class="card dev add" href="#/kelola">' + ic('circle-plus') + '<b>Daftarkan alat baru di ' + esc(rs.nama) + '</b><span class="small">Tambah tabung sinar-X atau unit pencitraan lain.</span></a>';
  }
  gambar('');
  $$('[data-rs]', el).forEach(b => b.addEventListener('click', () => { InputRs = b.dataset.rs; InputJenis = ''; renderPilihAlat(el); }));
  $$('[data-j]', el).forEach(b => b.addEventListener('click', () => { InputJenis = b.dataset.j; renderPilihAlat(el); }));
  $('#cari-alat', el).addEventListener('input', debounce(e => gambar(e.target.value), 200));
}

function kartuAlat(a, per) {
  const t = getTpl(a.template_id) || {}, s = statusAlat(a.alat_id, per);
  const lalu = AppState.sesi.filter(x => x.alat_id === a.alat_id && x.status_sesi === 'FINAL' && x.periode < per).sort((x, y) => x.periode < y.periode ? 1 : -1)[0];
  const kat = kategoriTpl(a.template_id);
  const lokal = Store.get(userKey('draf:' + a.alat_id + ':' + per), null);
  const cats = VR_KATEGORI.map(k => {
    const v = s.sesi && kat.indexOf(k) > -1 ? s.sesi[VR_KATEGORI_KOLOM[k]] : '';
    return '<i class="' + (kat.indexOf(k) === -1 ? 'none' : (v || '').toLowerCase()) + '" title="' + esc(k + ': ' + (kat.indexOf(k) === -1 ? 'tidak ada' : LABEL_STATUS[v] || 'Belum')) + '">' + k[0] + '</i>';
  }).join('');
  const label = s.st === 'BELUM' ? (lokal ? 'Lanjutkan draf' : 'Mulai uji QC') : s.st === 'DRAF' ? 'Lanjutkan draf' : 'Lihat / ubah';
  return '<div class="card dev ' + (s.st === 'DRAF' || lokal ? 'is-draft' : s.st === 'GAGAL' ? 'is-fail' : '') + '">' +
    '<div class="hd"><span class="tag">' + esc(a.kode) + '</span><span class="small muted mono">' + esc((t.nama || '').toUpperCase()) + '</span><span class="sp"></span>' + (lokal && s.st !== 'DRAF' ? badge('DRAF', 'Draf perangkat') : badge(s.st)) + '</div>' +
    '<div class="bd"><h3>' + esc(a.merek + ' ' + a.tipe) + '</h3><div class="cats">' + cats + '</div>' +
    '<dl class="kv"><dt>Ruangan</dt><dd title="' + esc(a.ruangan) + '">' + esc(a.ruangan || '—') + '</dd><dt>No. seri tabung</dt><dd>' + esc(a.no_seri_tabung || '—') + '</dd>' +
    '<dt>Template</dt><dd>' + esc((t.nama || '') + ' v' + (t.versi || 1)) + '</dd>' +
    '<dt>Uji terakhir</dt><dd>' + (lalu ? esc(singkatBulan(lalu.periode)) + ' · ' + esc(LABEL_STATUS[lalu.status_total] || '') : '—') + '</dd></dl></div>' +
    '<div class="ft"><a class="btn btn-sm btn-ghost" href="#/riwayat/' + a.alat_id + '">' + ic('chart-line') + 'Riwayat</a>' +
    '<a class="btn btn-sm ' + (s.st === 'BELUM' || s.st === 'DRAF' ? 'btn-primary' : '') + '" href="#/input/' + a.alat_id + '">' + ic(s.st === 'BELUM' && !lokal ? 'circle-play' : 'pencil') + label + '</a></div></div>';
}

/* ---------------- Langkah 2 & 3: form QC ---------------- */
function kunciDraf(alatId, per) { return userKey('draf:' + alatId + ':' + per); }

async function renderFormQc(el, alatId) {
  const a = getAlat(alatId);
  if (!a) { el.innerHTML = kosong('Alat tidak ditemukan', 'Alat mungkin sudah dinonaktifkan.', '<a class="btn" href="#/input">Kembali</a>'); return; }
  const per = AppState.periode, rs = getRs(a.rs_id) || {}, tpl = getTpl(a.template_id) || {};
  el.innerHTML = '<div class="skel" style="height:120px"></div><div class="skel" style="height:48px"></div><div class="skel" style="height:420px"></div>';
  const sesi = sesiAlat(alatId, per);
  if (sesi && !(await muatHasil([sesi.sesi_id]))) { el.innerHTML = kosong('Gagal memuat data', 'Periksa koneksi lalu coba lagi.', '<button class="btn" onclick="rute()">Coba lagi</button>'); return; }
  if (location.hash.indexOf(alatId) === -1) return;            // pengguna sudah pindah halaman
  const hasil = sesi ? (AppState.hasil[sesi.sesi_id] || []) : [];
  let params = sesi && sesi.status_sesi === 'FINAL' && hasil.length ? vrParamDariHasil(hasil) : paramsTpl(tpl.template_id).filter(p => vrBenar(p.aktif));
  params = vrUrutParam(params);
  F = { alat: a, rs, tpl, per, sesi, params, input: sesi ? vrInputDariHasil(hasil) : {}, catatan: sesi ? sesi.catatan : '',
    tanggal: sesi ? sesi.tanggal : (String(AppState.hariIni).slice(0, 7) === per ? AppState.hariIni : ''), tab: '', lokal: null, pernyataan: false, kotor: false };
  const d = Store.get(kunciDraf(alatId, per), null);
  if (d && (!sesi || d.waktu > Date.parse(String(sesi.diubah) + '+07:00'))) { F.input = d.input || {}; F.catatan = d.catatan || ''; F.tanggal = d.tanggal || F.tanggal; F.lokal = d.waktu; }
  const kat = VR_KATEGORI.filter(k => params.some(p => p.kategori === k));
  F.tab = kat[0] || 'TINJAU';
  F.kat = kat;
  if (!params.length) { el.innerHTML = kosong('Template belum punya parameter', 'Tambahkan parameter di menu Template Toleransi.', '<a class="btn btn-primary" href="#/template">Buka Template</a>'); return; }
  gambarForm(el);
}

function gambarForm(el) {
  const a = F.alat, final = F.sesi && F.sesi.status_sesi === 'FINAL';
  el.innerHTML =
    '<div class="hstack between"><a class="btn btn-ghost btn-sm" href="#/input">' + ic('arrow-left') + 'Ganti alat</a>' + stepper(F.tab === 'TINJAU' ? 3 : 2) + '</div>' +
    (F.lokal ? '<div class="banner banner-warn">' + ic('smartphone') + '<div class="t small"><b>Melanjutkan draf yang tersimpan di perangkat ini</b> (' + esc(new Date(F.lokal).toLocaleString('id-ID')) + '). Belum terkirim ke server.</div><button class="btn btn-sm" id="buang-lokal">Buang draf perangkat</button></div>' : '') +
    (final ? '<div class="banner banner-info">' + ic('lock') + '<div class="t small">Sesi ini sudah <b>final</b>. Perubahan akan menimpa hasil final dan memakai toleransi saat sesi diuji (snapshot), bukan template terbaru.</div></div>' : '') +
    '<div class="card card-b qc-head"><div style="min-width:240px"><div class="hstack"><span class="tag">' + esc(a.kode) + '</span><span class="small muted mono">' + esc((F.tpl.nama || '').toUpperCase()) + '</span>' + (F.sesi ? (final ? badge(F.sesi.status_total) : badge('DRAF')) : badge('BELUM', 'Baru')) + '</div>' +
    '<h1 style="margin-top:6px">' + esc(F.tpl.nama || '') + ' — ' + esc(F.rs.nama || '') + '</h1><p class="muted" style="margin:2px 0 0">' + esc(a.merek + ' ' + a.tipe) + '</p></div>' +
    '<div class="meta"><div><div class="k">No. seri tabung</div><div class="v mono">' + esc(a.no_seri_tabung || '—') + '</div></div><div><div class="k">Ruangan</div><div class="v" title="' + esc(a.ruangan) + '">' + esc(a.ruangan || '—') + '</div></div>' +
    '<div><div class="k">Periode</div><div class="v">' + esc(vrNamaPeriode(F.per)) + '</div></div><div><div class="k">Tanggal uji</div><input type="date" class="input" id="tgl-uji" style="height:28px;padding:2px 6px;border:0;background:transparent;font-weight:600" value="' + esc(F.tanggal) + '" min="' + F.per + '-01" max="' + F.per + '-31"></div></div></div>' +
    '<div class="tabs" role="tablist" id="tabs"></div>' +
    '<div class="qc-layout"><div class="stack" id="tab-isi"></div>' +
    '<aside class="qc-side" id="qc-side"></aside></div>' +
    '<div class="sticky-bar" id="bar"></div>';
  $('#tgl-uji', el).addEventListener('change', e => { F.tanggal = e.target.value; simpanLokal(); });
  const bl = $('#buang-lokal', el);
  if (bl) bl.addEventListener('click', async () => {
    if (!(await konfirmasi('Buang draf perangkat?', 'Isian yang belum terkirim di perangkat ini akan dihapus dan form kembali ke data server.', 'Buang', true))) return;
    Store.del(kunciDraf(a.alat_id, F.per)); renderFormQc(el, a.alat_id);
  });
  gambarTabs(); gambarTab(); gambarSisi(); gambarBar();
}

function evaluasiF() { return vrEvaluasi(F.params, F.input, sep()); }
function hitungKat(ev, k) {
  const ps = F.params.filter(p => p.kategori === k && p.tipe_toleransi !== 'TIDAK_ADA');
  const isi = ps.filter(p => ['LULUS', 'GAGAL', 'NA'].indexOf((ev[p.kode] || {}).status) > -1).length;
  const gagal = ps.filter(p => (ev[p.kode] || {}).status === 'GAGAL').length;
  return { isi, total: ps.length, gagal };
}
function gambarTabs() {
  const ev = evaluasiF();
  $('#tabs').innerHTML = F.kat.map((k, i) => {
    const c = hitungKat(ev, k);
    const kls = c.gagal ? 'bad' : c.total && c.isi === c.total ? 'ok' : '';
    return '<button role="tab" data-tab="' + esc(k) + '" aria-selected="' + (F.tab === k) + '">' + (i + 1) + '. ' + esc(k) + ' <span class="cnt ' + kls + '">' + (c.total ? c.isi + '/' + c.total : 'data') + '</span></button>';
  }).join('') + '<button role="tab" data-tab="TINJAU" aria-selected="' + (F.tab === 'TINJAU') + '">' + ic('clipboard-check') + 'Tinjau & simpan</button>';
  $$('#tabs [data-tab]').forEach(b => b.addEventListener('click', () => { F.tab = b.dataset.tab; gambarTabs(); gambarTab(); gambarBar(); $('#tab-isi').scrollIntoView({ block: 'nearest' }); }));
}

function gambarTab() {
  const box = $('#tab-isi');
  const stp = $('.stepper'); if (stp) stp.outerHTML = stepper(F.tab === 'TINJAU' ? 3 : 2);
  if (F.tab === 'TINJAU') { gambarTinjau(box); return; }
  const ps = F.params.filter(p => p.kategori === F.tab);
  const grup = [];
  ps.forEach(p => { let g = grup.find(x => x.nama === (p.kelompok || 'Umum')); if (!g) grup.push(g = { nama: p.kelompok || 'Umum', ps: [] }); g.ps.push(p); });
  const kode = F.params.map(p => p.kode);
  box.innerHTML = grup.map((g, gi) => '<section class="card grp-card"><div class="card-h"><h3><span class="tag tag-soft">' + String(gi + 1).padStart(2, '0') + '</span>' + esc(g.nama) + '</h3><span class="small muted" data-gst="' + esc(g.nama) + '"></span></div>' +
    g.ps.map(p => barisParam(p, kode)).join('') + '</section>' +
    (apakahKelompokLinier(g.nama, g.ps) ? '<section class="card grp-card lin-card" data-lin="' + esc(g.nama) + '"><div class="card-h"><h3>' + ic('chart-scatter') + 'Grafik linearitas — ' + esc(g.nama) + '</h3><span class="small muted">terukur vs nominal</span></div><div class="card-b"></div></section>' : '')).join('');
  // event
  $$('[data-in]', box).forEach(inp => {
    inp.addEventListener('input', () => { setInput(inp.dataset.in, { nilai: inp.value }); });
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const all = $$('[data-in]:not([disabled])', box), i = all.indexOf(inp);
      if (all[i + 1]) all[i + 1].focus(); else { const n = $('#lanjut'); if (n) n.focus(); }
    });
  });
  $$('[data-seg]', box).forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const k = seg.dataset.seg, cur = (F.input[k] || {}).nilai;
    setInput(k, { nilai: cur === b.dataset.v ? '' : b.dataset.v });
    $$('button', seg).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === (F.input[k] || {}).nilai)));
  }));
  $$('[data-na]', box).forEach(cb => cb.addEventListener('change', () => {
    const k = cb.dataset.na;
    setInput(k, { na: cb.checked });
    const row = cb.closest('.prm');
    $('.alasan', row).classList.toggle('hidden', !cb.checked);
    $$('[data-in], [data-seg] button', row).forEach(x => { x.disabled = cb.checked; });
    if (cb.checked) $('.alasan input', row).focus();
  }));
  $$('[data-alasan]', box).forEach(inp => inp.addEventListener('input', () => setInput(inp.dataset.alasan, { alasan: inp.value })));
  perbaruiNilai();
}

function barisParam(p, kode) {
  const inp = F.input[p.kode] || {}, na = vrBenar(inp.na), data = p.tipe_toleransi === 'TIDAK_ADA';
  let ctl;
  if (p.tipe_input === 'HITUNG') {
    ctl = '<div class="measure auto"><input class="input" readonly tabindex="-1" data-out="' + p.kode + '" aria-label="' + esc(p.nama) + ' (otomatis)"><span class="unit">' + esc(p.satuan || 'AUTO') + '</span></div>' +
      '<div class="hint mono" style="margin-top:4px" title="Rumus">= ' + esc(p.formula) + '</div>';
  } else if (p.tipe_input === 'KUALITATIF') {
    const opsi = String(p.opsi || '').split('|').map(x => x.trim()).filter(String);
    ctl = '<div class="seg" data-seg="' + p.kode + '" role="group" aria-label="' + esc(p.nama) + '">' + opsi.map(o => '<button type="button" data-v="' + esc(o) + '" aria-pressed="' + (inp.nilai === o) + '"' + (na ? ' disabled' : '') + '>' + esc(o) + '</button>').join('') + '</div>';
  } else {
    ctl = '<div class="measure"><input class="input" inputmode="decimal" autocomplete="off" data-in="' + p.kode + '" value="' + esc(inp.nilai || '') + '" aria-label="' + esc(p.nama) + '"' + (na ? ' disabled' : '') + ' placeholder="0' + (sep()) + '00"><span class="unit">' + esc(p.satuan || '—') + '</span></div>';
  }
  const bolehNa = vrBenar(p.boleh_na);
  return '<div class="prm ' + (data ? 'is-data' : '') + '" data-k="' + p.kode + '">' +
    '<div><div class="nm">' + esc(p.nama) + (vrBenar(p.wajib) && !data ? '' : data ? '' : ' <span class="small muted">(opsional)</span>') + '</div><div class="cd">' + esc(p.kode) + '</div>' + (p.keterangan ? '<div class="ket">' + esc(p.keterangan) + '</div>' : '') + '</div>' +
    '<div class="ctl">' + ctl + '</div>' +
    '<div class="tolc">' + (data ? '<span class="tol">data pendukung</span>' : '<div class="tol" data-tol="' + p.kode + '"></div><div data-gauge="' + p.kode + '"></div>') + '</div>' +
    '<div class="st" data-st="' + p.kode + '"></div>' +
    (bolehNa && p.tipe_input !== 'HITUNG' ? '<div class="na-row"><label class="switch"><input type="checkbox" data-na="' + p.kode + '"' + (na ? ' checked' : '') + '><span class="trk"></span>Tandai N/A (tidak diuji)</label>' +
      '<span class="alasan field ' + (na ? '' : 'hidden') + '" style="flex:1;min-width:200px"><input class="input" style="height:32px" data-alasan="' + p.kode + '" value="' + esc(inp.alasan || '') + '" placeholder="Alasan wajib, mis. Alat ukur sedang dikalibrasi" maxlength="300"></span></div>' : '') +
    '</div>';
}

function setInput(kode, patch) {
  F.input[kode] = Object.assign({}, F.input[kode] || {}, patch);
  F.kotor = true;
  perbaruiNilai();
  simpanLokal();
}
const simpanLokal = debounce(() => {
  if (!F) return;
  Store.set(kunciDraf(F.alat.alat_id, F.per), { input: F.input, catatan: F.catatan, tanggal: F.tanggal, waktu: Date.now() });
  F.lokal = Date.now();
}, 400);

function gaugeHtml(p, h) {
  const x = vrAngka(h.nilai);
  if (x === null || ['MIN', 'LEBIH', 'MAKS', 'KURANG', 'RENTANG', 'MUTLAK_PM'].indexOf(p.tipe_toleransi) === -1) return '';
  let lo = null, hi = null;
  if (p.tipe_toleransi === 'MUTLAK_PM') { lo = -Math.abs(h.maks); hi = Math.abs(h.maks); }
  else { lo = h.min; hi = h.maks; }
  const pts = [x, lo, hi].filter(v => v !== null && isFinite(v));
  let a = Math.min.apply(null, pts), b = Math.max.apply(null, pts);
  const span = (b - a) || Math.abs(b) || 1;
  a -= span * .3; b += span * .3;
  if (lo === null) { lo = Math.min(0, a); a = Math.min(a, lo); }
  if (hi === null) hi = b;
  const pc = v => Math.max(0, Math.min(100, (v - a) / (b - a) * 100));
  return '<div class="gauge" title="Posisi nilai terhadap rentang lulus"><span class="ok" style="left:' + pc(lo) + '%;width:' + (pc(hi) - pc(lo)) + '%"></span><span class="pt ' + (h.status === 'GAGAL' ? 'bad' : '') + '" style="left:' + pc(x) + '%"></span></div>';
}

function perbaruiNilai() {
  if (!F) return;
  const ev = evaluasiF();
  F.params.forEach(p => {
    const h = ev[p.kode] || {};
    const row = $('.prm[data-k="' + p.kode + '"]');
    if (!row) return;
    const out = $('[data-out="' + p.kode + '"]', row);
    if (out) out.value = h.status === 'NA' ? 'N/A' : (h.tampil || '');
    const tol = $('[data-tol="' + p.kode + '"]', row);
    if (tol) tol.textContent = vrTeksToleransi(p, h.min, h.maks, sep()) || (p.tipe_toleransi === 'KUALITATIF' ? '= ' + p.acuan : '');
    const g = $('[data-gauge="' + p.kode + '"]', row);
    if (g) g.innerHTML = gaugeHtml(p, h);
    const st = $('[data-st="' + p.kode + '"]', row);
    if (st) st.innerHTML = p.tipe_toleransi === 'TIDAK_ADA' ? (h.status === 'NA' ? badge('NA') : h.status === 'ERROR' ? badge('ERROR') : '') :
      badge(h.status === 'KOSONG' ? 'BELUM' : h.status) + (h.pesan && h.status !== 'NA' ? '<span class="err-msg" style="max-width:180px;text-align:right">' + esc(h.pesan) + '</span>' : h.naOtomatis ? '<span class="hint" style="max-width:180px;text-align:right">' + esc(h.pesan) + '</span>' : '');
    const inp = $('[data-in="' + p.kode + '"]', row);
    if (inp) inp.classList.toggle('is-error', h.status === 'ERROR');
    row.classList.toggle('is-gagal', h.status === 'GAGAL');
    row.classList.toggle('is-na', h.status === 'NA');
  });
  $$('[data-gst]').forEach(s => {
    const ps = F.params.filter(p => p.kategori === F.tab && (p.kelompok || 'Umum') === s.dataset.gst && p.tipe_toleransi !== 'TIDAK_ADA');
    const st = vrGabungStatus(ps.map(p => { const x = (ev[p.kode] || {}).status; return x === 'KOSONG' || x === 'ERROR' ? 'BELUM' : x; }));
    s.innerHTML = ps.length ? badge(st) : '';
  });
  // perbarui penghitung tab tanpa menggambar ulang
  F.kat.forEach(k => {
    const c = hitungKat(ev, k), cnt = $('#tabs [data-tab="' + k + '"] .cnt');
    if (cnt) { cnt.textContent = c.total ? c.isi + '/' + c.total : 'data'; cnt.className = 'cnt ' + (c.gagal ? 'bad' : c.total && c.isi === c.total ? 'ok' : ''); }
  });
  gambarRingkasSisi(ev);
  $$('[data-lin]').forEach(sec => gambarLinierForm(sec, ev));
}

/** Grafik linearitas di form: titik terukur vs nominal (titik tengah rentang toleransi). */
function gambarLinierForm(sec, ev) {
  const ps = F.params.filter(p => p.kategori === F.tab && (p.kelompok || 'Umum') === sec.dataset.lin && p.tipe_toleransi === 'RENTANG');
  const rows = ps.map(p => { const h = ev[p.kode] || {}; return { kode: p.kode, nama: p.nama, min: h.min !== null && h.min !== undefined ? h.min : p.batas_min, maks: h.maks !== null && h.maks !== undefined ? h.maks : p.batas_maks, nilai: h.nilai, status: h.status }; });
  const t = titikLinier(rows), g = grafikLinier(t, { satuan: (ps[0] || {}).satuan, judul: 'Linearitas ' + sec.dataset.lin });
  const r = g.reg, terisi = t.filter(x => x.y !== null).length, gagal = t.filter(x => x.status === 'GAGAL').length;
  const u = (ps[0] || {}).satuan ? ' ' + ps[0].satuan : '';
  $('.card-b', sec).innerHTML = '<div class="chart">' + g.svg + '<div class="chart-legend" style="margin-top:6px"><span><i style="background:#F37021"></i>Garis regresi</span><span style="color:#94A3B8"><i class="dash"></i><span style="color:var(--muted)">Ideal (terukur = nominal)</span></span><span><i style="background:#86EFAC;height:8px"></i>Rentang toleransi</span><span><i style="background:#DC2626;width:8px;height:8px"></i>Di luar rentang</span></div></div>' +
    '<div class="lin-stat"><div><div class="k">Titik terisi</div><div class="v">' + terisi + ' / ' + t.length + '</div></div><div><div class="k">Di luar rentang</div><div class="v" style="color:' + (gagal ? 'var(--fail)' : 'var(--pass)') + '">' + gagal + '</div></div>' +
    '<div><div class="k">Kemiringan</div><div class="v">' + (r.a !== undefined ? vrFormat(r.a, 4, sep()) : '—') + '</div></div><div><div class="k">R²</div><div class="v">' + (r.r2 !== undefined ? vrFormat(r.r2, 4, sep()) : '—') + '</div></div></div>' +
    '<div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r-md)"><table class="tbl"><thead><tr><th>Bahan</th><th class="c">Nominal</th><th class="c">Terukur</th><th class="c">Selisih</th><th class="c">Rentang</th><th class="c">Status</th></tr></thead><tbody>' +
    t.map(x => '<tr class="' + (x.status === 'GAGAL' ? 'is-fail' : '') + '"><td>' + esc(x.label) + '</td><td class="num">' + esc(vrFormat(x.x, 1, sep())) + '</td><td class="num">' + (x.y === null ? '—' : esc(vrFormat(x.y, 1, sep()))) + '</td>' +
      '<td class="num">' + (x.y === null ? '—' : esc((x.y - x.x >= 0 ? '+' : '') + vrFormat(x.y - x.x, 1, sep()))) + '</td><td class="c m">' + esc(vrAngkaRingkas(x.min, sep()) + ' s.d. ' + vrAngkaRingkas(x.maks, sep()) + u) + '</td><td class="c">' + badge(x.status === 'KOSONG' ? 'BELUM' : x.status) + '</td></tr>').join('') + '</tbody></table></div>' +
    '<p class="hint" style="margin:0">Nominal = titik tengah rentang toleransi tiap bahan. Kemiringan dan R² mendekati 1 berarti respons CT number linear. Grafik ini visualisasi; status Lulus/Gagal tetap dari rentang tiap bahan.' +
    (terisi < 2 ? ' Isi minimal 2 bahan untuk menampilkan garis regresi.' : '') + '</p>';
}

function gambarSisi() {
  const side = $('#qc-side');
  const lamp = F.sesi ? (AppState.lampiran[F.sesi.sesi_id] || []) : [];
  side.innerHTML =
    '<div class="card"><div class="card-h"><h3>' + ic('activity') + 'Ringkasan alat ini</h3></div><div class="card-b" id="ringkas-sisi"></div></div>' +
    '<div class="card"><div class="card-h"><h3>' + ic('paperclip') + 'Lampiran & bukti foto</h3><span class="small muted">' + lamp.length + ' berkas</span></div><div class="card-b stack" style="gap:8px">' +
    '<label class="dropzone" id="dz">' + ic('cloud-upload') + '<div><b>Unggah foto / PDF</b></div><div class="hint">JPG, PNG, PDF · maks 8 MB</div><input type="file" id="f-lamp" accept="image/*,application/pdf" class="sr-only" multiple></label>' +
    '<div id="lamp-list" class="stack" style="gap:6px">' + lamp.map(l => '<div class="file-row">' + ic(/pdf/.test(l.mime) ? 'file-text' : 'image') + '<span class="grow" title="' + esc(l.nama) + '">' + esc(l.nama) + '</span>' +
      '<button class="btn btn-ghost btn-sm btn-icon" data-lihat="' + l.drive_file_id + '" data-nama="' + esc(l.nama) + '" aria-label="Lihat">' + ic('eye') + '</button><button class="btn btn-ghost btn-sm btn-icon" data-hapus-lamp="' + l.lampiran_id + '" aria-label="Hapus">' + ic('trash-2') + '</button></div>').join('') + '</div></div></div>' +
    '<div class="card"><div class="card-h"><h3>' + ic('notebook-pen') + 'Catatan fisikawan medis</h3></div><div class="card-b"><textarea class="input" id="catatan" maxlength="2000" placeholder="Temuan, kondisi alat, rekomendasi tindak lanjut…">' + esc(F.catatan) + '</textarea>' +
    '<div class="hint" style="margin-top:4px">Muncul di laporan PDF.</div></div></div>';
  $('#catatan', side).addEventListener('input', e => { F.catatan = e.target.value; F.kotor = true; simpanLokal(); const t = $('#catatan-t'); if (t) t.value = F.catatan; });
  $('#f-lamp', side).addEventListener('change', e => unggahLampiran(Array.from(e.target.files)));
  const dz = $('#dz', side);
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); unggahLampiran(Array.from(e.dataTransfer.files)); });
  $$('[data-lihat]', side).forEach(b => b.addEventListener('click', async () => {
    setBusy(b, true, '');
    const uri = await dataUriBerkas(b.dataset.lihat);
    setBusy(b, false);
    if (!uri) return toast('Lampiran tidak bisa dibuka.', 'error');
    modal({ judul: b.dataset.nama, lebar: true, isi: /^data:image/.test(uri) ? '<img src="' + uri + '" style="max-width:100%;display:block;margin:auto">' : '<iframe src="' + uri + '" style="width:100%;height:70vh;border:0"></iframe>' });
  }));
  $$('[data-hapus-lamp]', side).forEach(b => b.addEventListener('click', async () => {
    if (!(await konfirmasi('Hapus lampiran?', 'Berkas akan dipindahkan ke sampah Google Drive.', 'Hapus', true))) return;
    const r = await api('lampiran.hapus', { lampiran_id: b.dataset.hapusLamp });
    if (!r.success) return toast(r.message, 'error');
    AppState.lampiran[F.sesi.sesi_id] = (AppState.lampiran[F.sesi.sesi_id] || []).filter(l => l.lampiran_id !== b.dataset.hapusLamp);
    gambarSisi(); perbaruiNilai();
  }));
  perbaruiNilai();
}

function gambarRingkasSisi(ev) {
  const box = $('#ringkas-sisi'); if (!box) return;
  const rk = vrRingkas(F.params, ev).total;
  const terisi = rk.total - rk.kosong;
  box.innerHTML = '<div class="stat-cells" style="grid-template-columns:1fr 1fr"><div class="lulus"><div class="k">Lulus</div><div class="v">' + rk.lulus + '</div></div><div class="gagal"><div class="k">Gagal</div><div class="v">' + rk.gagal + '</div></div>' +
    '<div><div class="k">N/A</div><div class="v">' + rk.na + '</div></div><div><div class="k">Belum</div><div class="v">' + rk.kosong + '</div></div></div>' +
    '<div class="hstack between small" style="margin:12px 0 6px"><span class="muted">Kelengkapan</span><b class="mono">' + terisi + ' / ' + rk.total + '</b></div><div class="progress light"><i style="width:' + (rk.total ? terisi / rk.total * 100 : 0) + '%"></i></div>' +
    '<div style="margin-top:12px" class="hstack between"><span class="small muted">Status sementara</span>' + badge(rk.status) + '</div>';
}

async function unggahLampiran(files) {
  if (!files.length) return;
  if (AppState.demo === false && navigator.onLine === false) return toast('Unggah lampiran butuh koneksi internet. Isian form tetap tersimpan di perangkat.', 'warning');
  if (!F.sesi) {
    toast('Menyimpan draf ke server dulu supaya lampiran bisa ditautkan…', 'info');
    const ok = await simpanSesi(false, true);
    if (!ok) return;
  }
  for (const f of files) {
    try {
      const b = await bacaBerkas(f);
      const r = await api('file.unggah', { jenis: 'lampiran', sesi_id: F.sesi.sesi_id, nama: b.nama, mime: b.mime, base64: b.base64 });
      if (!r.success) { toast(f.name + ': ' + r.message, 'error'); continue; }
      (AppState.lampiran[F.sesi.sesi_id] = AppState.lampiran[F.sesi.sesi_id] || []).push(r.data.lampiran);
      AppState.berkas[r.data.file_id] = b.dataUri;
      toast(b.nama + ' terunggah.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  gambarSisi();
}

function gambarBar() {
  const bar = $('#bar'), i = F.kat.indexOf(F.tab);
  const lanjut = F.tab === 'TINJAU' ? '' : '<button class="btn btn-primary" id="lanjut">' + (i < F.kat.length - 1 ? 'Lanjut ke ' + esc(F.kat[i + 1]) : 'Tinjau & simpan') + ic('arrow-right') + '</button>';
  bar.innerHTML = (F.sesi && F.sesi.status_sesi === 'DRAF' ? '<button class="btn btn-ghost btn-danger" id="hapus-draf">' + ic('trash-2') + '<span class="hide-sm">Hapus draf</span></button>' : '') +
    '<span class="sp small muted" id="bar-info">' + (navigator.onLine === false ? ic('cloud-off') + ' Offline — tersimpan di perangkat' : ic('save') + ' Tersimpan otomatis di perangkat') + '</span>' +
    '<button class="btn" id="simpan-draf">' + ic('save') + 'Simpan draf</button>' + lanjut;
  $('#simpan-draf').addEventListener('click', e => simpanSesi(false, false, e.currentTarget));
  const l = $('#lanjut');
  if (l) l.addEventListener('click', () => { F.tab = i < F.kat.length - 1 ? F.kat[i + 1] : 'TINJAU'; gambarTabs(); gambarTab(); gambarBar(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  const h = $('#hapus-draf');
  if (h) h.addEventListener('click', async () => {
    if (!(await konfirmasi('Hapus draf?', 'Draf QC ' + F.alat.kode + ' periode ' + vrNamaPeriode(F.per) + ' akan dihapus dari server dan perangkat.', 'Hapus draf', true))) return;
    const r = await api('sesi.hapus', { sesi_id: F.sesi.sesi_id });
    if (!r.success) return toast(r.message, 'error');
    AppState.sesi = AppState.sesi.filter(s => s.sesi_id !== F.sesi.sesi_id);
    Store.del(kunciDraf(F.alat.alat_id, F.per));
    toast('Draf dihapus.', 'success'); buka('input');
  });
}

function gambarTinjau(box) {
  const ev = evaluasiF(), rk = vrRingkas(F.params, ev);
  const t = rk.total;
  const gagal = F.params.filter(p => (ev[p.kode] || {}).status === 'GAGAL');
  const kosongP = F.params.filter(p => p.tipe_toleransi !== 'TIDAK_ADA' && vrBenar(p.wajib) && ['KOSONG', 'ERROR'].indexOf((ev[p.kode] || {}).status) > -1);
  const naP = F.params.filter(p => (ev[p.kode] || {}).status === 'NA' && !(ev[p.kode] || {}).naOtomatis);
  const naTanpaAlasan = naP.filter(p => !String((F.input[p.kode] || {}).alasan || '').trim());
  const errP = F.params.filter(p => (ev[p.kode] || {}).status === 'ERROR');
  const siap = !kosongP.length && !naTanpaAlasan.length && !errP.length;
  const vk = t.status === 'GAGAL' ? 'bad' : t.status === 'BELUM' ? 'wait' : 'ok';
  const judul = t.status === 'GAGAL' ? gagal.length + ' parameter gagal — alat perlu tindak lanjut' : t.status === 'BELUM' ? 'Belum lengkap: ' + kosongP.length + ' parameter wajib belum diisi' : t.status === 'NA' ? 'Semua parameter N/A' : 'Semua parameter yang diuji lulus';
  box.innerHTML =
    '<div class="card verdict ' + vk + '"><div class="ic">' + ic(vk === 'ok' ? 'shield-check' : vk === 'bad' ? 'triangle-alert' : 'clock') + '</div><div style="flex:1"><div class="small muted mono">HASIL EVALUASI · ' + esc(F.alat.kode) + '</div><h2>' + esc(judul) + '</h2></div>' + badge(t.status) + '</div>' +
    '<div class="stat-cells"><div><div class="k">Parameter dinilai</div><div class="v">' + t.total + '</div></div><div class="lulus"><div class="k">Lulus</div><div class="v">' + t.lulus + '</div></div><div class="gagal"><div class="k">Gagal</div><div class="v">' + t.gagal + '</div></div><div><div class="k">N/A</div><div class="v">' + t.na + '</div></div></div>' +
    (gagal.length ? '<div class="card"><div class="card-h"><h3 style="color:var(--fail)">' + ic('circle-alert') + 'Temuan gagal</h3></div><div class="card-b stack" style="gap:10px">' + gagal.map(p => {
      const h = ev[p.kode];
      return '<div class="finding"><div><b>' + esc(p.nama) + '</b><div class="small muted">' + esc(p.kategori + ' · ' + (p.kelompok || '')) + '</div></div><div><div class="small muted">Terukur</div><div class="big">' + esc(h.tampil) + ' <span class="small">' + esc(p.satuan) + '</span></div></div>' +
        '<div><div class="small muted">Kriteria</div><div class="mono"><b>' + esc(vrTeksToleransi(p, h.min, h.maks, sep())) + '</b></div><button class="btn btn-sm" style="margin-top:6px" data-ke="' + esc(p.kategori) + '" data-fokus="' + p.kode + '">' + ic('pencil') + 'Periksa nilai</button></div></div>';
    }).join('') + '</div></div>' : '') +
    (kosongP.length || errP.length ? '<div class="card"><div class="card-h"><h3>' + ic('circle-dashed') + 'Belum diisi / tidak valid</h3><span class="small muted">isi nilai, atau tandai N/A beserta alasan</span></div><div class="list">' + kosongP.map(p =>
      '<div class="list-item" style="align-items:center"><div class="grow"><b>' + esc(p.nama) + '</b><div class="small muted">' + esc(p.kategori) + ((ev[p.kode] || {}).pesan ? ' · ' + esc(ev[p.kode].pesan) : '') + '</div></div><button class="btn btn-sm" data-ke="' + esc(p.kategori) + '" data-fokus="' + p.kode + '">Isi</button></div>').join('') + '</div></div>' : '') +
    (naP.length ? '<div class="card"><div class="card-h"><h3>' + ic('diamond') + 'Parameter tidak diuji (N/A)</h3></div><div class="list">' + naP.map(p => {
      const al = String((F.input[p.kode] || {}).alasan || '').trim();
      return '<div class="list-item"><div class="grow"><b>' + esc(p.nama) + '</b><div class="small ' + (al ? 'muted' : '') + '" style="' + (al ? '' : 'color:var(--fail)') + '">' + (al ? 'Alasan: ' + esc(al) : '⚠ Alasan wajib diisi') + '</div></div>' + (al ? '' : '<button class="btn btn-sm" data-ke="' + esc(p.kategori) + '" data-fokus="' + p.kode + '">Isi alasan</button>') + '</div>';
    }).join('') + '</div></div>' : '') +
    '<div class="card"><div class="card-h"><h3>' + ic('table-2') + 'Rekapitulasi per kategori</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kategori</th><th class="c">Jumlah</th><th class="c">Lulus</th><th class="c">Gagal</th><th class="c">N/A</th><th class="c">Belum</th><th class="c">Status</th></tr></thead><tbody>' +
    VR_KATEGORI.filter(k => rk.kategori[k]).map(k => { const c = rk.kategori[k]; return '<tr class="' + (c.status === 'GAGAL' ? 'is-fail' : '') + '"><td><b>' + esc(k) + '</b></td><td class="num c">' + c.total + '</td><td class="num c">' + c.lulus + '</td><td class="num c">' + c.gagal + '</td><td class="num c">' + c.na + '</td><td class="num c">' + c.kosong + '</td><td class="c">' + badge(c.status) + '</td></tr>'; }).join('') +
    '</tbody></table></div></div>' +
    '<div class="card"><div class="card-h"><h3>' + ic('signature') + 'Pernyataan & penyimpanan final</h3></div><div class="card-b stack">' +
    '<div class="field"><label for="catatan-t">Catatan / rekomendasi tindak lanjut (muncul di laporan)</label><textarea class="input" id="catatan-t" maxlength="2000">' + esc(F.catatan) + '</textarea></div>' +
    '<label class="check"><input type="checkbox" id="pernyataan"' + (F.pernyataan ? ' checked' : '') + '><span>Saya menyatakan data di atas diambil langsung dari pengujian alat <b>' + esc(F.alat.kode + ' ' + F.alat.merek + ' ' + F.alat.tipe) + '</b> pada tanggal ' + esc(F.tanggal ? vrTanggalPanjang(F.tanggal) : '(isi tanggal uji)') + '.</span></label>' +
    (!siap ? '<div class="banner banner-warn small">' + ic('triangle-alert') + '<div class="t">Simpan final belum bisa: lengkapi parameter wajib, alasan N/A, atau nilai yang tidak valid. Anda tetap bisa <b>menyimpan draf</b>.</div></div>' : '') +
    '<div class="hstack" style="justify-content:flex-end"><button class="btn" id="simpan-draf-2">' + ic('save') + 'Simpan draf</button><button class="btn btn-primary" id="simpan-final"' + (siap ? '' : ' disabled') + '>' + ic('lock') + 'Simpan hasil QC (final)</button></div></div></div>';
  $('#catatan-t', box).addEventListener('input', e => { F.catatan = e.target.value; simpanLokal(); const c = $('#catatan'); if (c) c.value = F.catatan; });
  $('#pernyataan', box).addEventListener('change', e => { F.pernyataan = e.target.checked; });
  $('#simpan-draf-2', box).addEventListener('click', e => simpanSesi(false, false, e.currentTarget));
  $('#simpan-final', box).addEventListener('click', e => {
    if (!F.tanggal) return toast('Isi tanggal uji di bagian atas.', 'warning');
    if (!F.pernyataan) return toast('Centang pernyataan sebelum menyimpan final.', 'warning');
    simpanSesi(true, false, e.currentTarget);
  });
  $$('[data-fokus]', box).forEach(b => b.addEventListener('click', () => {
    F.tab = b.dataset.ke; gambarTabs(); gambarTab(); gambarBar();
    const row = $('.prm[data-k="' + b.dataset.fokus + '"]');
    if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); const x = $('input:not([readonly]), button', row); if (x) setTimeout(() => x.focus(), 300); }
  }));
}

/** Simpan ke server. Bila jaringan gagal → masuk antrean & tetap aman di perangkat. */
async function simpanSesi(final, diam, btn) {
  const payload = { alat_id: F.alat.alat_id, periode: F.per, tanggal: F.tanggal, input: F.input, catatan: F.catatan, final: !!final };
  const reqId = uuid();
  const label = F.alat.kode + ' ' + vrNamaPeriode(F.per) + (final ? ' (final)' : ' (draf)');
  const antrekan = () => {
    Antrean.tambah({ kunci: 'sesi:' + F.alat.alat_id + ':' + F.per, action: 'sesi.simpan', data: payload, reqId, label, waktu: Date.now() });
    toast('Tidak tersambung ke server. ' + label + ' tersimpan di perangkat dan akan dikirim otomatis.', 'warning');
    if (final) buka('dasbor');
  };
  if (!AppState.demo && navigator.onLine === false) { antrekan(); return false; }
  setBusy(btn, true, final ? 'Menyimpan final…' : 'Menyimpan…');
  const r = await api('sesi.simpan', payload, { reqId });
  setBusy(btn, false);
  if (!r.success) {
    if (r.network) { antrekan(); return false; }
    toast(r.message, 'error'); return false;
  }
  upsertSesi(r.data.sesi);
  AppState.hasil[r.data.sesi.sesi_id] = r.data.hasil;
  Store.del(kunciDraf(F.alat.alat_id, F.per));
  F.sesi = r.data.sesi; F.lokal = null; F.kotor = false;
  if (!diam) toast(r.message || 'Tersimpan.', 'success');
  if (final) {
    if (r.data.sesi.status_total === 'GAGAL') toast('Hasil final ' + F.alat.kode + ': GAGAL. Temuan akan tampil di dasbor dan laporan.', 'warning');
    buka('dasbor');
  } else if (!diam) { const el = $('#page'); const tab = F.tab; gambarForm(el); F.tab = tab; }
  return true;
}
