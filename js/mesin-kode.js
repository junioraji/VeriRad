/* DIBANGUN OTOMATIS oleh tools/bangun-mesin.js dari backend/Kode.gs + tools/mesin/Lokal.js — JANGAN DIEDIT LANGSUNG.
 * Mesin VeriRad di browser: logika yang sama dengan backend Apps Script, berjalan terhadap salinan sheet di memori. */
function VR_MESIN_KODE(SpreadsheetApp, PropertiesService, CacheService, LockService, Utilities, DriveApp, Session, ContentService, MailApp, UrlFetchApp, ScriptApp, console, TAMBAHAN) {
/* =====================================================================
 * VeriRad — Kode.gs (REST API utama)
 * Arsitektur: frontend GitHub Pages ⇄ fetch(POST text/plain) ⇄ Web App ini.
 * Semua respons JSON lewat ContentService. Web App tidak memakai HtmlService (sidebar aktivasi di Pasang.gs khusus spreadsheet).
 * Rahasia & ID hanya di Script Properties (lihat Setup.gs).
 * Berkas lain dalam proyek: Bersama.gs, Laporan.gs, Setup.gs, Pasang.gs (lisensi & aktivasi)
 * ===================================================================== */

const APP_NAMA = 'VeriRad';
const ZONA = 'Asia/Jakarta';
const SESI_JAM = 12;
const SLOW_MS = 3000;

/** Kolom setiap sheet. Urutan = urutan kolom di Google Sheets. */
const SKEMA = {
  Pengaturan: ['kunci', 'nilai'],
  Pengguna: ['email', 'nama', 'peran', 'rs_ids', 'jabatan', 'aktif', 'dibuat'],
  RS: ['rs_id', 'kode', 'nama', 'alamat', 'telepon', 'nama_penandatangan', 'jabatan_penandatangan', 'nip_penandatangan',
    'email_atasan', 'email_cc', 'logo_file_id', 'aktif', 'dibuat', 'diubah', 'no_izin_fismed', 'kota'],
  Alat: ['alat_id', 'rs_id', 'template_id', 'kode', 'merek', 'tipe', 'no_seri_tabung', 'ruangan', 'foto_id', 'aktif', 'catatan', 'dibuat', 'diubah'],
  TemplateJenis: ['template_id', 'nama', 'singkatan', 'versi', 'aktif', 'diubah'],
  TemplateParameter: ['param_id', 'template_id', 'kategori', 'kelompok', 'kode', 'nama', 'tipe_input', 'satuan', 'tipe_toleransi',
    'batas_min', 'batas_maks', 'formula', 'opsi', 'acuan', 'desimal', 'urutan', 'wajib', 'boleh_na', 'aktif', 'keterangan'],
  SesiQC: ['sesi_id', 'alat_id', 'rs_id', 'template_id', 'template_versi', 'periode', 'tanggal', 'status_sesi',
    'st_keselamatan', 'st_mekanik', 'st_citra', 'st_dosimetri', 'status_total', 'n_total', 'n_lulus', 'n_gagal', 'n_na', 'n_kosong',
    'catatan', 'penguji_email', 'penguji_nama', 'dibuat', 'diubah'],
  HasilQC: ['hasil_id', 'sesi_id', 'alat_id', 'periode', 'kode', 'nama', 'kategori', 'kelompok', 'satuan', 'tipe_input', 'tipe_toleransi',
    'batas_min', 'batas_maks', 'min_terpakai', 'maks_terpakai', 'formula', 'opsi', 'wajib', 'boleh_na', 'acuan', 'desimal', 'urutan',
    'nilai_input', 'nilai', 'status', 'alasan_na'],
  Lampiran: ['lampiran_id', 'sesi_id', 'alat_id', 'rs_id', 'nama', 'mime', 'drive_file_id', 'ukuran', 'dibuat'],
  LaporanTerkirim: ['laporan_id', 'rs_id', 'periode', 'pdf_file_id', 'nama_file', 'dikirim_ke', 'cc', 'waktu', 'status_kirim', 'pesan_error', 'dibuat_oleh'],
  Log: ['waktu', 'email', 'aksi', 'objek', 'detail'],
  AppConfig: ['kunci', 'nilai', 'keterangan']
};

/* ---------------------------------------------------------------------
 * 1. SCRIPT PROPERTIES — satu pintu (gas-rahasia-script-properties R2)
 * ------------------------------------------------------------------- */
const PROPS = PropertiesService.getScriptProperties();
let _PROP_MEMO = null;
function prop_(key, def) {
  if (!_PROP_MEMO) _PROP_MEMO = PROPS.getProperties();
  const v = _PROP_MEMO[key];
  return v === undefined || v === null || v === '' ? (def === undefined ? '' : def) : v;
}
function setProp_(key, val) { PROPS.setProperty(key, String(val)); if (_PROP_MEMO) _PROP_MEMO[key] = String(val); }
function setProps_(obj) { PROPS.setProperties(obj); if (_PROP_MEMO) Object.keys(obj).forEach(function (k) { _PROP_MEMO[k] = String(obj[k]); }); }
function delProp_(key) { PROPS.deleteProperty(key); if (_PROP_MEMO) delete _PROP_MEMO[key]; }

/* ---------------------------------------------------------------------
 * 2. UTILITAS
 * ------------------------------------------------------------------- */
function ok_(data, message) { return { success: true, data: data === undefined ? null : data, message: message || '' }; }
function fail_(message, extra) { const r = { success: false, message: message }; if (extra) r.data = extra; return r; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function sekarang_() { return Utilities.formatDate(new Date(), ZONA, "yyyy-MM-dd'T'HH:mm:ss"); }
function hariIni_() { return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd'); }
function periodeIni_() { return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM'); }
function idBaru_(awalan) { return awalan + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(); }
function bersih_(v, maks) { return String(v === null || v === undefined ? '' : v).trim().slice(0, maks || 300); }
function emailValid_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '')); }
function daftarEmail_(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/);
  return arr.map(function (e) { return String(e).trim().toLowerCase(); }).filter(function (e) { return e; });
}
function cekPeriode_(p) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(p || ''))) throw new Error('Periode harus berformat YYYY-MM.'); return p; }

/* ---------------------------------------------------------------------
 * 3. AKSES SHEET (memo per eksekusi, semua nilai disimpan sebagai teks)
 * ------------------------------------------------------------------- */
let _SS = null;
const _ROWS = {};
function ss_() {
  if (_SS) return _SS;
  const id = prop_('SPREADSHEET_ID');
  if (!id) throw new Error('Database belum disiapkan. Jalankan setupAppEnvironment() di editor Apps Script.');
  _SS = SpreadsheetApp.openById(id);
  return _SS;
}
function sheet_(nama) {
  const sh = ss_().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak ditemukan. Jalankan setupAppEnvironment() lagi.');
  return sh;
}
function baca_(nama) {
  if (_ROWS[nama]) return _ROWS[nama];
  const sh = sheet_(nama), last = sh.getLastRow(), kol = SKEMA[nama];
  if (last < 2) return (_ROWS[nama] = []);
  const v = sh.getRange(2, 1, last - 1, kol.length).getDisplayValues();
  const rows = [];
  for (let i = 0; i < v.length; i++) {
    if (v[i].join('') === '') continue;
    const o = { _baris: i + 2 };
    for (let c = 0; c < kol.length; c++) o[kol[c]] = v[i][c];
    rows.push(o);
  }
  return (_ROWS[nama] = rows);
}
function lupa_(nama) { delete _ROWS[nama]; }
function selAman_(v) {
  const s = String(v === null || v === undefined ? '' : v);
  return /^[=@]/.test(s) ? "'" + s : s;                       // cegah injeksi rumus spreadsheet
}
function keBaris_(nama, o) { return SKEMA[nama].map(function (k) { return selAman_(o[k]); }); }

function tambah_(nama, objs) {
  if (!objs.length) return;
  const sh = sheet_(nama), kol = SKEMA[nama].length;
  const r = sh.getRange(sh.getLastRow() + 1, 1, objs.length, kol);
  r.setNumberFormat('@');
  r.setValues(objs.map(function (o) { return keBaris_(nama, o); }));
  lupa_(nama);
}
function ubah_(nama, baris, o) {
  const r = sheet_(nama).getRange(baris, 1, 1, SKEMA[nama].length);
  r.setNumberFormat('@');
  r.setValues([keBaris_(nama, o)]);
  lupa_(nama);
}
/** Simpan objek: ubah bila kunci sudah ada, tambah bila belum. */
function simpanObj_(nama, kunci, o) {
  const lama = baca_(nama).filter(function (r) { return r[kunci] === o[kunci]; })[0];
  if (lama) { ubah_(nama, lama._baris, Object.assign({}, lama, o)); return Object.assign({}, lama, o); }
  tambah_(nama, [o]); return o;
}
/** Hapus semua baris yang cocok (blok berurutan dihapus sekaligus, dari bawah). */
function hapusWhere_(nama, fn) {
  const sh = sheet_(nama);
  const idx = baca_(nama).filter(fn).map(function (r) { return r._baris; }).sort(function (a, b) { return b - a; });
  let i = 0;
  while (i < idx.length) {
    let akhir = idx[i], awal = akhir;
    while (i + 1 < idx.length && idx[i + 1] === awal - 1) { i++; awal = idx[i]; }
    sh.deleteRows(awal, akhir - awal + 1);
    i++;
  }
  lupa_(nama);
  return idx.length;
}
function pengaturan_() {
  const o = {};
  baca_('Pengaturan').forEach(function (r) { o[r.kunci] = r.nilai; });
  return o;
}
function setPengaturan_(kunci, nilai) { simpanObj_('Pengaturan', 'kunci', { kunci: kunci, nilai: String(nilai) }); }
function log_(email, aksi, objek, detail) {
  try { tambah_('Log', [{ waktu: sekarang_(), email: email, aksi: aksi, objek: objek || '', detail: String(detail || '').slice(0, 300) }]); }
  catch (e) { console.error('Log gagal: ' + e.message); }
}

/* ---------------------------------------------------------------------
 * 4. CACHE BERVERSI (gas-instant-ux-pro Prinsip 4)
 * ------------------------------------------------------------------- */
const CacheX = {
  SZ: 50000,
  c: function () { return CacheService.getScriptCache(); },
  get: function (key) {
    const c = this.c(), head = c.get(key);
    if (head == null) return null;
    if (head.indexOf('__chunks:') !== 0) return JSON.parse(head);
    const n = +head.slice(9), keys = [];
    for (let i = 0; i < n; i++) keys.push(key + '#' + i);
    const parts = c.getAll(keys); let s = '';
    for (let i = 0; i < n; i++) { if (parts[keys[i]] == null) return null; s += parts[keys[i]]; }
    return JSON.parse(s);
  },
  put: function (key, val, ttl) {
    const s = JSON.stringify(val), c = this.c();
    try {
      if (s.length <= this.SZ) return c.put(key, s, ttl);
      const n = Math.ceil(s.length / this.SZ); if (n > 20) return;
      const m = {}; for (let i = 0; i < n; i++) m[key + '#' + i] = s.substr(i * this.SZ, this.SZ);
      c.putAll(m, ttl); c.put(key, '__chunks:' + n, ttl);
    } catch (e) { /* cache opsional */ }
  }
};
function ver_(scope) {
  const c = CacheService.getScriptCache(), k = 'ver_' + scope;
  let v = c.get(k); if (!v) { v = String(Date.now()); c.put(k, v, 21600); }
  return v;
}
function bump_(scope) { CacheService.getScriptCache().put('ver_' + scope, String(Date.now()), 21600); }

/* ---------------------------------------------------------------------
 * 5. KEAMANAN: token Google + token sesi HMAC
 * ------------------------------------------------------------------- */
function acak_(n) {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  while (s.length < n) {
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid())
      .forEach(function (b) { if (s.length < n) s += huruf[(b & 0xff) % huruf.length]; });
  }
  return s;
}
function samaAman_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function samarkan_(v) { v = String(v || ''); return !v ? '' : v.length <= 8 ? '••••••' : v.slice(0, 4) + '••••••' + v.slice(-3); }
function secret_() {
  let s = prop_('SESSION_SECRET');
  if (!s) { s = acak_(64); setProp_('SESSION_SECRET', s); }
  return s;
}
function hmac_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret_())).replace(/=+$/, ''); }
function signToken_(p) { const body = Utilities.base64EncodeWebSafe(JSON.stringify(p)).replace(/=+$/, ''); return body + '.' + hmac_(body); }
function buatSesi_(email, peran) {
  const now = Date.now();
  return signToken_({ e: email, r: peran, i: now, x: now + SESI_JAM * 3600e3 });
}
function verifyToken_(t) {
  try {
    const parts = String(t || '').split('.');
    if (parts.length !== 2 || !samaAman_(hmac_(parts[0]), parts[1])) return null;
    let b = parts[0]; while (b.length % 4) b += '=';
    const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString());
    if (!p.x || p.x < Date.now()) return null;
    const rev = Number(CacheService.getScriptCache().get('rev_' + p.e) || prop_('REV_' + p.e) || 0);
    if (p.i < rev) return null;
    return { email: p.e, peran: p.r, exp: p.x };
  } catch (e) { return null; }
}
function revokeAll_(email) { const t = String(Date.now()); setProp_('REV_' + email, t); CacheService.getScriptCache().put('rev_' + email, t, 21600); }

function verifyGoogleIdToken_(idToken) {
  const cid = prop_('GOOGLE_CLIENT_ID');
  if (!cid) throw new Error('GOOGLE_CLIENT_ID belum diisi di Script Properties. Lihat panduan instalasi langkah "OAuth Client ID".');
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Token Google tidak valid atau kedaluwarsa. Coba masuk lagi.');
  const p = JSON.parse(r.getContentText());
  if (p.aud !== cid) throw new Error('Token Google bukan untuk aplikasi ini.');
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(p.iss) === -1) throw new Error('Penerbit token tidak dikenal.');
  if (String(p.email_verified) !== 'true') throw new Error('Email Google belum terverifikasi.');
  if (Number(p.exp) * 1000 < Date.now()) throw new Error('Token Google kedaluwarsa.');
  return { email: String(p.email).toLowerCase(), nama: p.name || '', foto: p.picture || '' };
}

/** Pengguna aktif berdasarkan email (peran dibaca dari sheet, bukan dari token). */
function penggunaAktif_(email) {
  const u = baca_('Pengguna').filter(function (r) { return r.email.toLowerCase() === String(email).toLowerCase(); })[0];
  if (!u || !vrBenar(u.aktif)) return null;
  const peran = u.peran === 'FISMED' ? 'FISMED' : 'ATASAN';
  return { email: u.email.toLowerCase(), nama: u.nama, peran: peran, jabatan: u.jabatan,
    rs_ids: peran === 'FISMED' ? null : String(u.rs_ids || '').split(',').map(function (x) { return x.trim(); }).filter(String) };
}
function bolehRs_(ctx, rsId) { return ctx.me.peran === 'FISMED' || ctx.me.rs_ids.indexOf(rsId) > -1; }
function wajibRs_(ctx, rsId) { if (!bolehRs_(ctx, rsId)) throw new Error('Anda tidak memiliki akses ke rumah sakit ini.'); }

/* ---------------------------------------------------------------------
 * 6. ROUTER
 * akses: publik | semua (login) | fismed
 * tulis: aksi tulis (idempotensi reqId + lock), kunci:false = handler kelola lock sendiri
 * ------------------------------------------------------------------- */
// Dibangun saat dipanggil (bukan saat file dimuat) agar aman terhadap urutan berkas .gs
let _RUTE = null;
function rute_() {
  if (_RUTE) return _RUTE;
  _RUTE = {
  'auth.config': { akses: 'publik', fn: apiConfig_ },
  'auth.login': { akses: 'publik', fn: apiLogin_ },
  'auth.keluarSemua': { akses: 'semua', tulis: true, bebasLisensi: true, fn: apiKeluarSemua_ },
  'boot': { akses: 'semua', fn: apiBoot_ },
  'sesi.list': { akses: 'semua', fn: apiSesiList_ },
  'hasil.list': { akses: 'semua', fn: apiHasilList_ },
  'sesi.simpan': { akses: 'fismed', tulis: true, fn: apiSesiSimpan_ },
  'sesi.hapus': { akses: 'fismed', tulis: true, fn: apiSesiHapus_ },
  'rs.simpan': { akses: 'fismed', tulis: true, fn: apiRsSimpan_ },
  'rs.izin': { akses: 'fismed', tulis: true, fn: apiRsIzin_ },
  'alat.simpan': { akses: 'fismed', tulis: true, fn: apiAlatSimpan_ },
  'alat.hapus': { akses: 'fismed', tulis: true, fn: apiAlatHapus_ },
  'rs.hapus': { akses: 'fismed', tulis: true, fn: apiRsHapus_ },
  'template.simpan': { akses: 'fismed', tulis: true, fn: apiTemplateSimpan_ },
  'pengguna.simpan': { akses: 'fismed', tulis: true, fn: apiPenggunaSimpan_ },
  'pengguna.hapus': { akses: 'fismed', tulis: true, fn: apiPenggunaHapus_ },
  'pengaturan.simpan': { akses: 'fismed', tulis: true, fn: apiPengaturanSimpan_ },
  'file.unggah': { akses: 'fismed', tulis: true, fn: apiFileUnggah_ },
  'file.ambil': { akses: 'semua', fn: apiFileAmbil_ },
  'lampiran.hapus': { akses: 'fismed', tulis: true, fn: apiLampiranHapus_ },
  'laporan.list': { akses: 'semua', fn: apiLaporanList_ },
  'laporan.buat': { akses: 'fismed', tulis: true, kunci: false, fn: apiLaporanBuat_ },
  'laporan.unduh': { akses: 'semua', fn: apiLaporanUnduh_ },
  'laporan.kirimUlang': { akses: 'fismed', tulis: true, kunci: false, fn: apiLaporanKirimUlang_ },
  'lisensi.segarkan': { akses: 'fismed', fn: apiLisensiSegarkan_ },
  'lisensi.pesan': { akses: 'fismed', fn: apiLisensiPesan_ }
  };
  return _RUTE;
}
const AKSI_TANPA_LOG = { 'auth.keluarSemua': 1 };

function doGet(e) {
  const a = (e && e.parameter && e.parameter.action) || 'ping';
  if (a === 'config') return json_(apiConfig_());
  let ph = ''; try { ph = pemilikHash_(); } catch (err) { }
  return json_(ok_({ app: APP_NAMA, versi: VR_VERSI, waktu: sekarang_(), pemilik_hash: ph }));
}

function doPost(e) {
  const t0 = Date.now();
  let body = {}, res;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    res = dispatch_(body);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res = fail_(err && err.message ? err.message : String(err));
  }
  res.ms = Date.now() - t0;
  if (res.ms > SLOW_MS) console.warn('SLOW ' + body.action + ' ' + res.ms + 'ms');
  return json_(res);
}

function dispatch_(body) {
  const r = rute_()[body.action];
  if (!r) return fail_('Aksi tidak dikenal: ' + body.action);
  const ctx = { reqId: String(body.reqId || ''), after: [] };
  if (r.akses !== 'publik') {
    const s = verifyToken_(body.token);
    if (!s) return fail_('Sesi berakhir. Silakan masuk lagi.', { code: 'AUTH' });
    const me = penggunaAktif_(s.email);
    if (!me) return fail_('Akun Anda tidak aktif lagi di VeriRad.', { code: 'AUTH' });
    if (r.akses === 'fismed' && me.peran !== 'FISMED') return fail_('Aksi ini hanya untuk fisikawan medis.', { code: 'FORBIDDEN' });
    ctx.me = me;
  }
  const data = body.data || {};
  if (r.tulis && !r.bebasLisensi) {                                  // gerbang langganan: baca tetap boleh, tulis dikunci
    const L = lisensi_();
    if (!L.boleh_tulis) return fail_(L.pesan || 'Langganan VeriRad tidak aktif.', { code: 'LISENSI', lisensi: lisensiPublik_(ctx.me) });
  }
  if (!r.tulis) return r.fn(ctx, data);
  const c = CacheService.getScriptCache(), k = ctx.reqId ? 'idem_' + ctx.reqId : '';
  const hit = k && c.get(k);
  if (hit) return JSON.parse(hit);                                   // permintaan ulang → hasil sama
  const jalankan = function () { return r.fn(ctx, data); };
  const out = r.kunci === false ? jalankan() : denganKunci_(jalankan);
  if (k && out.success) { const s = JSON.stringify(out); if (s.length < 90000) c.put(k, s, 21600); }
  if (out.success && !AKSI_TANPA_LOG[body.action]) {
    denganKunci_(function () { log_(ctx.me.email, body.action, out.logObjek || '', out.logDetail || ''); });
  }
  delete out.logObjek; delete out.logDetail;
  ctx.after.forEach(function (fn) { try { fn(); } catch (e) { console.error(e.message); } });
  return out;
}
function denganKunci_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Server sedang sibuk. Coba beberapa detik lagi.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------------------------------------------------------------------
 * 7. AUTH & BOOT
 * ------------------------------------------------------------------- */
function apiConfig_() {
  return ok_({ app: APP_NAMA, versi: VR_VERSI, googleClientId: prop_('GOOGLE_CLIENT_ID'), siap: !!prop_('SPREADSHEET_ID') });
}

function apiLogin_(ctx, d) {
  const g = verifyGoogleIdToken_(String(d.idToken || ''));
  const me = penggunaAktif_(g.email);
  if (!me) return fail_('Email ' + g.email + ' belum terdaftar di VeriRad. Minta fisikawan medis Anda menambahkan email ini.', { code: 'NOT_REGISTERED', email: g.email });
  const pemilik = String(prop_('PEMILIK_EMAIL') || '').toLowerCase();
  if (me.peran === 'FISMED' && pemilik && me.email !== pemilik)
    return fail_('Paket VeriRad berlaku untuk 1 fisikawan medis (' + pemilik + '). Akun ini hanya bisa ditambahkan sebagai atasan.', { code: 'BATAS_PAKET', email: g.email });
  denganKunci_(function () { log_(me.email, 'auth.login', '', me.peran); });
  return ok_({ token: buatSesi_(me.email, me.peran), boot: dataBoot_({ me: me }), foto: g.foto });
}

function apiKeluarSemua_(ctx) { revokeAll_(ctx.me.email); return ok_(null, 'Semua sesi Anda telah diakhiri.'); }

function apiBoot_(ctx) { return ok_(dataBoot_(ctx)); }

function refData_() {
  return CacheX.get('ref_' + ver_('ref')) || (function () {
    const tpl = baca_('TemplateJenis').map(tanpaBaris_);
    const par = baca_('TemplateParameter').map(tanpaBaris_);
    const d = { rs: baca_('RS').map(tanpaBaris_), alat: baca_('Alat').map(tanpaBaris_), templates: tpl, params: par,
      pengguna: baca_('Pengguna').map(tanpaBaris_), pengaturan: pengaturan_() };
    CacheX.put('ref_' + ver_('ref'), d, 1800);
    return d;
  })();
}
function tanpaBaris_(r) { const o = Object.assign({}, r); delete o._baris; return o; }

function dataBoot_(ctx) {
  const ref = refData_(), me = ctx.me;
  const rs = ref.rs.filter(function (r) { return bolehRs_(ctx, r.rs_id); });
  const rsIds = rs.map(function (r) { return r.rs_id; });
  const alat = ref.alat.filter(function (a) { return rsIds.indexOf(a.rs_id) > -1; });
  const p = ref.pengaturan;
  const pengaturan = me.peran === 'FISMED' ? p : { nama_fismed: p.nama_fismed, no_izin: p.no_izin, pemisah_desimal: p.pemisah_desimal };
  const dari = vrGeserPeriode(periodeIni_(), -11);
  return {
    me: me, versi: VR_VERSI, periode: periodeIni_(), hariIni: hariIni_(),
    pengaturan: pengaturan, rs: rs, alat: alat, templates: ref.templates, params: ref.params,
    pengguna: me.peran === 'FISMED' ? ref.pengguna : [],
    sesi: sesiDalam_(ctx, dari, '9999-12'), sesiDari: dari,
    laporan: laporanUntuk_(ctx, ''),
    lisensi: lisensiPublik_(me)
  };
}

/* ---------------------------------------------------------------------
 * 8. SESI & HASIL QC
 * ------------------------------------------------------------------- */
function sesiDalam_(ctx, dari, sampai) {
  return baca_('SesiQC').filter(function (s) { return s.periode >= dari && s.periode <= sampai && bolehRs_(ctx, s.rs_id); }).map(tanpaBaris_);
}
function apiSesiList_(ctx, d) {
  return ok_(sesiDalam_(ctx, d.dari ? cekPeriode_(d.dari) : '0000-01', d.sampai ? cekPeriode_(d.sampai) : '9999-12'));
}
function apiHasilList_(ctx, d) {
  const sesi = baca_('SesiQC').filter(function (s) { return bolehRs_(ctx, s.rs_id); });
  let ids;
  if (Array.isArray(d.sesi_ids)) ids = d.sesi_ids.slice(0, 400);
  else if (d.alat_id) {
    const dari = d.dari || '0000-01', sampai = d.sampai || '9999-12';
    ids = sesi.filter(function (s) { return s.alat_id === d.alat_id && s.periode >= dari && s.periode <= sampai; }).map(function (s) { return s.sesi_id; });
  } else return fail_('Sebutkan sesi_ids atau alat_id.');
  const boleh = {};
  sesi.forEach(function (s) { boleh[s.sesi_id] = 1; });
  const set = {};
  ids.forEach(function (i) { if (boleh[i]) set[i] = 1; });
  const hasil = baca_('HasilQC').filter(function (h) { return set[h.sesi_id]; }).map(tanpaBaris_);
  const lampiran = baca_('Lampiran').filter(function (l) { return set[l.sesi_id]; }).map(tanpaBaris_);
  return ok_({ hasil: hasil, lampiran: lampiran });
}

function apiSesiSimpan_(ctx, d) {
  const alat = baca_('Alat').filter(function (a) { return a.alat_id === d.alat_id; })[0];
  if (!alat) return fail_('Alat tidak ditemukan.');
  const periode = cekPeriode_(d.periode);
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || '')) ? d.tanggal : hariIni_();
  const lama = baca_('SesiQC').filter(function (s) { return s.alat_id === alat.alat_id && s.periode === periode; })[0];
  const tpl = baca_('TemplateJenis').filter(function (t) { return t.template_id === alat.template_id; })[0];
  if (!tpl) return fail_('Template alat tidak ditemukan.');
  let params;
  if (lama && lama.status_sesi === 'FINAL') {
    params = vrParamDariHasil(baca_('HasilQC').filter(function (h) { return h.sesi_id === lama.sesi_id; }));   // snapshot
  }
  if (!params || !params.length) params = baca_('TemplateParameter').filter(function (p) { return p.template_id === tpl.template_id && vrBenar(p.aktif); });
  if (!params.length) return fail_('Template "' + tpl.nama + '" belum punya parameter aktif.');
  const sesiId = lama ? lama.sesi_id : idBaru_('S');
  const b = vrBangunHasil({
    sesi_id: sesiId, alat: alat, template: lama && lama.status_sesi === 'FINAL' ? { template_id: lama.template_id, versi: lama.template_versi } : tpl,
    params: params, input: d.input || {}, catatan: bersih_(d.catatan, 2000), periode: periode, tanggal: tanggal,
    status_sesi: d.final ? 'FINAL' : 'DRAF', penguji_email: ctx.me.email, penguji_nama: ctx.me.nama,
    sekarang: sekarang_(), dibuat: lama ? lama.dibuat : ''
  });
  simpanObj_('SesiQC', 'sesi_id', b.sesi);
  hapusWhere_('HasilQC', function (h) { return h.sesi_id === sesiId; });
  tambah_('HasilQC', b.hasil);
  const out = ok_({ sesi: b.sesi, hasil: b.hasil }, d.final ? 'Hasil QC disimpan final.' : 'Draf tersimpan di server.');
  out.logObjek = alat.kode + ' ' + periode; out.logDetail = b.sesi.status_sesi + ' ' + b.sesi.status_total;
  return out;
}

function apiSesiHapus_(ctx, d) {
  const s = baca_('SesiQC').filter(function (x) { return x.sesi_id === d.sesi_id; })[0];
  if (!s) return fail_('Sesi tidak ditemukan.');
  if (s.status_sesi === 'FINAL') return fail_('Sesi final tidak bisa dihapus. Ubah nilainya lalu simpan ulang.');
  hapusWhere_('HasilQC', function (h) { return h.sesi_id === s.sesi_id; });
  hapusWhere_('SesiQC', function (x) { return x.sesi_id === s.sesi_id; });
  const out = ok_({ sesi_id: s.sesi_id }, 'Draf dihapus.');
  out.logObjek = s.sesi_id;
  return out;
}

/* ---------------------------------------------------------------------
 * 9. MASTER DATA: RS, ALAT, TEMPLATE, PENGGUNA, PENGATURAN
 * ------------------------------------------------------------------- */
function apiRsSimpan_(ctx, d) {
  const nama = bersih_(d.nama, 150);
  if (!nama) return fail_('Nama rumah sakit wajib diisi.');
  const atasan = daftarEmail_(d.email_atasan), cc = daftarEmail_(d.email_cc);
  const salah = atasan.concat(cc).filter(function (e) { return !emailValid_(e); });
  if (salah.length) return fail_('Email tidak valid: ' + salah.join(', '));
  const lama = d.rs_id ? baca_('RS').filter(function (r) { return r.rs_id === d.rs_id; })[0] : null;
  if (d.rs_id && !lama) return fail_('Rumah sakit tidak ditemukan.');
  if (!lama) {
    const L = lisensi_();
    if (baca_('RS').length >= L.batas_rs) return fail_('Batas paket: maksimal ' + L.batas_rs + ' rumah sakit. Hapus rumah sakit yang tidak dipakai lagi untuk menambah yang baru.', { code: 'BATAS_PAKET' });
  }
  const o = {
    rs_id: lama ? lama.rs_id : idBaru_('RS'), kode: bersih_(d.kode, 20).toUpperCase(), nama: nama, alamat: bersih_(d.alamat, 300),
    telepon: bersih_(d.telepon, 60), nama_penandatangan: bersih_(d.nama_penandatangan, 120),
    jabatan_penandatangan: bersih_(d.jabatan_penandatangan, 120) || 'Kepala Instalasi Radiologi', nip_penandatangan: bersih_(d.nip_penandatangan, 60),
    email_atasan: atasan.join(', '), email_cc: cc.join(', '), logo_file_id: lama ? lama.logo_file_id : '',
    aktif: d.aktif === false || d.aktif === 'FALSE' ? 'FALSE' : 'TRUE', dibuat: lama ? lama.dibuat : sekarang_(), diubah: sekarang_()
  };
  const r = simpanObj_('RS', 'rs_id', o);
  bump_('ref');
  const out = ok_(tanpaBaris_(r), 'Rumah sakit tersimpan.');
  out.logObjek = r.rs_id + ' ' + r.nama;
  return out;
}

/** Nomor izin (SIP) fisikawan medis & kota tanda tangan laporan, per rumah sakit. */
function apiRsIzin_(ctx, d) {
  const items = Array.isArray(d.items) ? d.items.slice(0, 50) : [];
  if (!items.length) return fail_('Tidak ada data yang disimpan.');
  const hasil = [];
  items.forEach(function (it) {
    const rs = baca_('RS').filter(function (r) { return r.rs_id === it.rs_id; })[0];
    if (!rs) return;
    const baru = Object.assign({}, rs, { no_izin_fismed: bersih_(it.no_izin_fismed, 120), kota: bersih_(it.kota, 80), diubah: sekarang_() });
    ubah_('RS', rs._baris, baru);
    hasil.push(tanpaBaris_(baru));
  });
  bump_('ref');
  const out = ok_(hasil, 'Nomor izin & kota per rumah sakit tersimpan.');
  out.logObjek = 'RS izin'; out.logDetail = hasil.length + ' RS';
  return out;
}

function apiAlatSimpan_(ctx, d) {
  const rs = baca_('RS').filter(function (r) { return r.rs_id === d.rs_id; })[0];
  if (!rs) return fail_('Pilih rumah sakit.');
  const tpl = baca_('TemplateJenis').filter(function (t) { return t.template_id === d.template_id; })[0];
  if (!tpl) return fail_('Pilih jenis alat (template).');
  const kode = bersih_(d.kode, 30).toUpperCase();
  if (!kode) return fail_('Kode alat wajib diisi (mis. RU-01).');
  const ganda = baca_('Alat').filter(function (a) { return a.rs_id === rs.rs_id && a.kode === kode && a.alat_id !== d.alat_id; });
  if (ganda.length) return fail_('Kode ' + kode + ' sudah dipakai di ' + rs.nama + '.');
  const lama = d.alat_id ? baca_('Alat').filter(function (a) { return a.alat_id === d.alat_id; })[0] : null;
  if (d.alat_id && !lama) return fail_('Alat tidak ditemukan.');
  if (lama && lama.template_id !== tpl.template_id) {
    const adaSesi = baca_('SesiQC').some(function (s) { return s.alat_id === lama.alat_id; });
    if (adaSesi) return fail_('Jenis alat tidak bisa diganti karena sudah ada riwayat QC. Nonaktifkan alat ini dan daftarkan alat baru.');
  }
  const o = {
    alat_id: lama ? lama.alat_id : idBaru_('AL'), rs_id: rs.rs_id, template_id: tpl.template_id, kode: kode,
    merek: bersih_(d.merek, 80), tipe: bersih_(d.tipe, 80), no_seri_tabung: bersih_(d.no_seri_tabung, 80), ruangan: bersih_(d.ruangan, 120),
    foto_id: lama ? lama.foto_id : '', aktif: d.aktif === false || d.aktif === 'FALSE' ? 'FALSE' : 'TRUE', catatan: bersih_(d.catatan, 500),
    dibuat: lama ? lama.dibuat : sekarang_(), diubah: sekarang_()
  };
  const r = simpanObj_('Alat', 'alat_id', o);
  bump_('ref');
  const out = ok_(tanpaBaris_(r), 'Alat tersimpan.');
  out.logObjek = rs.nama + ' ' + kode;
  return out;
}

/* ---------- Hapus alat / rumah sakit (permanen, beserta datanya) ---------- */
/** Kata konfirmasi yang harus diketik ulang pengguna: kode (atau nama bila kode kosong). */
function kataKonfirmasi_(o) { return String(o.kode || o.nama || '').trim().toUpperCase(); }
function sampahkan_(fileId) { if (fileId) try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { } }
/** Hapus satu set alat beserta sesi QC, hasil, lampiran, dan fotonya. Mengembalikan jumlah per tabel. */
function hapusAlatKaskade_(alatIds) {
  const ada = function (x) { return alatIds.indexOf(x.alat_id) > -1; };
  baca_('Lampiran').filter(ada).forEach(function (l) { sampahkan_(l.drive_file_id); });
  baca_('Alat').filter(ada).forEach(function (a) { sampahkan_(a.foto_id); });
  const n = {
    hasil: hapusWhere_('HasilQC', ada),
    sesi: hapusWhere_('SesiQC', ada),
    lampiran: hapusWhere_('Lampiran', ada),
    alat: hapusWhere_('Alat', ada)
  };
  return n;
}
function apiAlatHapus_(ctx, d) {
  const a = baca_('Alat').filter(function (x) { return x.alat_id === d.alat_id; })[0];
  if (!a) return fail_('Alat tidak ditemukan.');
  const adaSesi = baca_('SesiQC').some(function (s) { return s.alat_id === a.alat_id; });
  if (adaSesi && String(d.konfirmasi || '').trim().toUpperCase() !== kataKonfirmasi_(a))
    return fail_('Ketik kode alat ' + kataKonfirmasi_(a) + ' untuk menghapus alat beserta riwayat QC-nya.');
  const n = hapusAlatKaskade_([a.alat_id]);
  bump_('ref');
  const out = ok_({ alat_id: a.alat_id, jumlah: n }, 'Alat ' + a.kode + ' dihapus.');
  out.logObjek = a.alat_id + ' ' + a.kode; out.logDetail = n.sesi + ' sesi, ' + n.hasil + ' hasil, ' + n.lampiran + ' lampiran';
  return out;
}
function apiRsHapus_(ctx, d) {
  const rs = baca_('RS').filter(function (r) { return r.rs_id === d.rs_id; })[0];
  if (!rs) return fail_('Rumah sakit tidak ditemukan.');
  if (String(d.konfirmasi || '').trim().toUpperCase() !== kataKonfirmasi_(rs))
    return fail_('Ketik ' + kataKonfirmasi_(rs) + ' untuk menghapus rumah sakit ini.');
  const alatIds = baca_('Alat').filter(function (a) { return a.rs_id === rs.rs_id; }).map(function (a) { return a.alat_id; });
  const n = hapusAlatKaskade_(alatIds);
  // sesi/lampiran yatim milik RS ini (mis. alat sudah terhapus sebelumnya)
  n.sesi += hapusWhere_('SesiQC', function (s) { return s.rs_id === rs.rs_id; });
  n.lampiran += hapusWhere_('Lampiran', function (l) { if (l.rs_id === rs.rs_id) { sampahkan_(l.drive_file_id); return true; } return false; });
  baca_('LaporanTerkirim').filter(function (l) { return l.rs_id === rs.rs_id; }).forEach(function (l) { sampahkan_(l.pdf_file_id); });
  n.laporan = hapusWhere_('LaporanTerkirim', function (l) { return l.rs_id === rs.rs_id; });
  sampahkan_(rs.logo_file_id);
  // folder Drive RS (logo, lampiran, PDF) dipindah ke sampah — bisa dipulihkan dari Drive selama 30 hari
  try {
    const root = DriveApp.getFolderById(prop_('FOLDER_RS_ID') || prop_('ROOT_FOLDER_ID'));
    const it = root.getFoldersByName((rs.nama || rs.rs_id).replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60) + ' (' + rs.rs_id + ')');
    while (it.hasNext()) it.next().setTrashed(true);
  } catch (e) { }
  // lepaskan RS dari akun atasan; atasan tanpa RS tersisa dinonaktifkan
  baca_('Pengguna').forEach(function (u) {
    if (u.peran !== 'ATASAN') return;
    const ids = String(u.rs_ids || '').split(',').map(function (x) { return x.trim(); }).filter(String);
    if (ids.indexOf(rs.rs_id) === -1) return;
    const sisa = ids.filter(function (x) { return x !== rs.rs_id; });
    ubah_('Pengguna', u._baris, Object.assign({}, u, { rs_ids: sisa.join(','), aktif: sisa.length ? u.aktif : 'FALSE' }));
    revokeAll_(String(u.email).toLowerCase());
  });
  lupa_('Pengguna');
  n.rs = hapusWhere_('RS', function (r) { return r.rs_id === rs.rs_id; });
  bump_('ref');
  const out = ok_({ rs_id: rs.rs_id, jumlah: n }, 'Rumah sakit ' + rs.nama + ' dihapus.');
  out.logObjek = rs.rs_id + ' ' + rs.nama; out.logDetail = n.alat + ' alat, ' + n.sesi + ' sesi, ' + n.laporan + ' laporan';
  return out;
}

const TIPE_INPUT_SAH = ['ANGKA', 'HITUNG', 'KUALITATIF'];
const TIPE_TOL_SAH = ['TIDAK_ADA', 'MAKS', 'KURANG', 'MIN', 'LEBIH', 'RENTANG', 'MUTLAK_PM', 'KUALITATIF'];

/** Validasi parameter template. Mengembalikan daftar pesan error (kosong = valid). */
function validasiParams_(params) {
  const err = [], kode = params.map(function (p) { return p.kode; });
  params.forEach(function (p, i) {
    const lbl = (p.kode || ('baris ' + (i + 1))) + ': ';
    if (!/^[A-Z][A-Z0-9_]{0,29}$/.test(p.kode)) err.push(lbl + 'kode harus huruf kapital/angka/garis bawah, diawali huruf');
    if (kode.indexOf(p.kode) !== i) err.push(lbl + 'kode ganda');
    if (!p.nama) err.push(lbl + 'nama wajib diisi');
    if (VR_KATEGORI.indexOf(p.kategori) === -1) err.push(lbl + 'kategori tidak dikenal');
    if (TIPE_INPUT_SAH.indexOf(p.tipe_input) === -1) err.push(lbl + 'tipe input tidak dikenal');
    if (TIPE_TOL_SAH.indexOf(p.tipe_toleransi) === -1) err.push(lbl + 'tipe toleransi tidak dikenal');
    if (p.tipe_input === 'HITUNG') { const m = vrCekRumus(p.formula, kode); if (m) err.push(lbl + 'rumus — ' + m); }
    if (p.tipe_input === 'KUALITATIF') {
      const opsi = String(p.opsi || '').split('|').map(function (x) { return x.trim(); }).filter(String);
      if (opsi.length < 2) err.push(lbl + 'isi minimal 2 pilihan, dipisah "|"');
      if (p.tipe_toleransi === 'KUALITATIF' && opsi.indexOf(String(p.acuan || '').trim()) === -1) err.push(lbl + 'acuan harus salah satu pilihan');
    } else if (p.tipe_toleransi === 'KUALITATIF') err.push(lbl + 'toleransi "harus sama dengan acuan" hanya untuk tipe pilihan');
    ['batas_min', 'batas_maks'].forEach(function (b) {
      const v = String(p[b] || '').trim();
      if (v && vrAngka(v) === null) { const m = vrCekRumus(v, kode); if (m) err.push(lbl + b.replace('_', ' ') + ' — ' + m); }
    });
    const butuhMin = ['MIN', 'LEBIH', 'RENTANG'].indexOf(p.tipe_toleransi) > -1;
    const butuhMaks = ['MAKS', 'KURANG', 'RENTANG', 'MUTLAK_PM'].indexOf(p.tipe_toleransi) > -1;
    if (butuhMin && !String(p.batas_min || '').trim()) err.push(lbl + 'batas minimum wajib diisi');
    if (butuhMaks && !String(p.batas_maks || '').trim()) err.push(lbl + 'batas maksimum wajib diisi');
  });
  if (!err.length) {
    const ev = vrEvaluasi(params, {}, '.');
    Object.keys(ev).forEach(function (k) { if (ev[k].status === 'ERROR' && ev[k].pesan) err.push(k + ': ' + ev[k].pesan); });
  }
  return err;
}

function apiTemplateSimpan_(ctx, d) {
  const t = d.template || {};
  const nama = bersih_(t.nama, 80);
  if (!nama) return fail_('Nama template wajib diisi.');
  const lama = t.template_id ? baca_('TemplateJenis').filter(function (x) { return x.template_id === t.template_id; })[0] : null;
  if (t.template_id && !lama) return fail_('Template tidak ditemukan.');
  const templateId = lama ? lama.template_id : idBaru_('TPL');
  const params = (Array.isArray(d.params) ? d.params : []).slice(0, 200).map(function (p, i) {
    return {
      param_id: templateId + '-' + bersih_(p.kode, 30).toUpperCase(), template_id: templateId,
      kategori: bersih_(p.kategori, 30), kelompok: bersih_(p.kelompok, 80), kode: bersih_(p.kode, 30).toUpperCase(), nama: bersih_(p.nama, 150),
      tipe_input: bersih_(p.tipe_input, 20), satuan: bersih_(p.satuan, 20), tipe_toleransi: bersih_(p.tipe_toleransi, 20) || 'TIDAK_ADA',
      batas_min: bersih_(p.batas_min, 120), batas_maks: bersih_(p.batas_maks, 120), formula: bersih_(p.formula, 400),
      opsi: bersih_(p.opsi, 300), acuan: bersih_(p.acuan, 100), desimal: String(Math.max(0, Math.min(6, parseInt(p.desimal, 10) || 0))),
      urutan: String(parseInt(p.urutan, 10) || (i + 1) * 10), wajib: vrBenar(p.wajib) ? 'TRUE' : 'FALSE',
      boleh_na: vrBenar(p.boleh_na) ? 'TRUE' : 'FALSE', aktif: vrBenar(p.aktif === undefined ? true : p.aktif) ? 'TRUE' : 'FALSE',
      keterangan: bersih_(p.keterangan, 400)
    };
  });
  const aktif = params.filter(function (p) { return p.aktif === 'TRUE'; });
  if (!aktif.length) return fail_('Template perlu minimal satu parameter aktif.');
  const err = validasiParams_(aktif);
  if (err.length) return fail_('Template belum valid:\n• ' + err.slice(0, 12).join('\n• '), { errors: err });
  const versi = lama ? String((parseInt(lama.versi, 10) || 1) + 1) : '1';
  simpanObj_('TemplateJenis', 'template_id', {
    template_id: templateId, nama: nama, singkatan: bersih_(t.singkatan, 6).toUpperCase(), versi: versi,
    aktif: t.aktif === false || t.aktif === 'FALSE' ? 'FALSE' : 'TRUE', diubah: sekarang_()
  });
  hapusWhere_('TemplateParameter', function (p) { return p.template_id === templateId; });
  tambah_('TemplateParameter', params);
  bump_('ref');
  const out = ok_({ template_id: templateId, versi: versi }, 'Template tersimpan (versi ' + versi + '). Sesi final lama tetap memakai toleransi lamanya.');
  out.logObjek = nama; out.logDetail = 'versi ' + versi + ', ' + params.length + ' parameter';
  return out;
}

function apiPenggunaSimpan_(ctx, d) {
  const email = String(d.email || '').trim().toLowerCase();
  if (!emailValid_(email)) return fail_('Email tidak valid.');
  const peran = d.peran === 'FISMED' ? 'FISMED' : 'ATASAN';
  const rsIds = (Array.isArray(d.rs_ids) ? d.rs_ids : String(d.rs_ids || '').split(','))
    .map(function (x) { return String(x).trim(); }).filter(String);
  const semuaRs = baca_('RS').map(function (r) { return r.rs_id; });
  if (peran === 'ATASAN') {
    if (!rsIds.length) return fail_('Pilih minimal satu rumah sakit untuk atasan.');
    if (rsIds.some(function (x) { return semuaRs.indexOf(x) === -1; })) return fail_('Ada rumah sakit yang tidak dikenal.');
  }
  const aktif = !(d.aktif === false || d.aktif === 'FALSE');
  if (email === ctx.me.email && (!aktif || peran !== 'FISMED')) return fail_('Anda tidak bisa menonaktifkan atau menurunkan peran akun Anda sendiri.');
  if (peran === 'FISMED' && email !== ctx.me.email)
    return fail_('Paket VeriRad berlaku untuk 1 fisikawan medis. Tambahkan pengguna lain sebagai Atasan (lihat saja).', { code: 'BATAS_PAKET' });
  const lama = baca_('Pengguna').filter(function (u) { return u.email.toLowerCase() === email; })[0];
  const o = { email: email, nama: bersih_(d.nama, 120), peran: peran, rs_ids: peran === 'ATASAN' ? rsIds.join(',') : '',
    jabatan: bersih_(d.jabatan, 120), aktif: aktif ? 'TRUE' : 'FALSE', dibuat: lama ? lama.dibuat : sekarang_() };
  simpanObj_('Pengguna', 'email', o);
  if (lama && (!aktif || lama.peran !== peran || lama.rs_ids !== o.rs_ids)) revokeAll_(email);
  bump_('ref');
  ctx.after.push(function () { sinkronAtasan_(); });
  const out = ok_(o, 'Pengguna tersimpan.');
  out.logObjek = email; out.logDetail = peran + (aktif ? '' : ' nonaktif');
  return out;
}

function apiPenggunaHapus_(ctx, d) {
  const email = String(d.email || '').toLowerCase();
  if (email === ctx.me.email) return fail_('Anda tidak bisa menghapus akun Anda sendiri.');
  const n = hapusWhere_('Pengguna', function (u) { return u.email.toLowerCase() === email; });
  if (!n) return fail_('Pengguna tidak ditemukan.');
  revokeAll_(email);
  bump_('ref');
  ctx.after.push(function () { sinkronAtasan_(); });
  const out = ok_({ email: email }, 'Pengguna dihapus.');
  out.logObjek = email;
  return out;
}

const PENGATURAN_BOLEH = ['nama_fismed', 'no_izin', 'kota', 'pemisah_desimal', 'toleransi_disetujui'];
function apiPengaturanSimpan_(ctx, d) {
  Object.keys(d || {}).forEach(function (k) {
    if (PENGATURAN_BOLEH.indexOf(k) === -1) return;
    let v = bersih_(d[k], 200);
    if (k === 'pemisah_desimal') v = v === '.' ? '.' : ',';
    if (k === 'toleransi_disetujui') v = sekarang_() + ' oleh ' + ctx.me.email;
    setPengaturan_(k, v);
  });
  bump_('ref');
  const out = ok_(pengaturan_(), 'Pengaturan tersimpan.');
  out.logObjek = 'Pengaturan'; out.logDetail = Object.keys(d || {}).join(',');
  return out;
}

/* ---------------------------------------------------------------------
 * 10. BERKAS (Drive)
 * ------------------------------------------------------------------- */
const MIME_GAMBAR = ['image/png', 'image/jpeg', 'image/webp'];
const MAKS_BERKAS = 8 * 1024 * 1024;

function folderAnak_(induk, nama) {
  const it = induk.getFoldersByName(nama);
  return it.hasNext() ? it.next() : induk.createFolder(nama);
}
function folderRs_(rs) {
  const root = DriveApp.getFolderById(prop_('FOLDER_RS_ID') || prop_('ROOT_FOLDER_ID'));
  const nama = (rs.nama || rs.rs_id).replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60) + ' (' + rs.rs_id + ')';
  return folderAnak_(root, nama);
}

function apiFileUnggah_(ctx, d) {
  const jenis = String(d.jenis || '');
  const mime = String(d.mime || '');
  const b64 = String(d.base64 || '').replace(/^data:[^,]+,/, '');
  if (!b64) return fail_('Berkas kosong.');
  const ukuran = Math.floor(b64.length * 3 / 4);
  if (ukuran > MAKS_BERKAS) return fail_('Ukuran berkas maksimal 8 MB.');
  const gambarSaja = jenis === 'logo' || jenis === 'ttd' || jenis === 'foto';
  if (gambarSaja ? MIME_GAMBAR.indexOf(mime) === -1 : MIME_GAMBAR.concat(['application/pdf']).indexOf(mime) === -1) {
    return fail_(gambarSaja ? 'Gunakan gambar PNG/JPG/WEBP.' : 'Gunakan gambar PNG/JPG/WEBP atau PDF.');
  }
  const nama = bersih_(d.nama, 100).replace(/[\\/:*?"<>|]/g, '_') || ('berkas-' + Date.now());
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, nama);
  let file, hasil = {};
  if (jenis === 'ttd') {
    const folder = DriveApp.getFolderById(prop_('FOLDER_TTD_ID') || prop_('ROOT_FOLDER_ID'));
    const lama = pengaturan_().ttd_file_id;
    file = folder.createFile(blob);
    setPengaturan_('ttd_file_id', file.getId());
    if (lama) try { DriveApp.getFileById(lama).setTrashed(true); } catch (e) { }
  } else if (jenis === 'logo') {
    const rs = baca_('RS').filter(function (r) { return r.rs_id === d.rs_id; })[0];
    if (!rs) return fail_('Rumah sakit tidak ditemukan.');
    file = folderAnak_(folderRs_(rs), 'Logo').createFile(blob);
    if (rs.logo_file_id) try { DriveApp.getFileById(rs.logo_file_id).setTrashed(true); } catch (e) { }
    ubah_('RS', rs._baris, Object.assign({}, rs, { logo_file_id: file.getId(), diubah: sekarang_() }));
  } else if (jenis === 'foto') {
    const alat = baca_('Alat').filter(function (a) { return a.alat_id === d.alat_id; })[0];
    if (!alat) return fail_('Alat tidak ditemukan.');
    const rs = baca_('RS').filter(function (r) { return r.rs_id === alat.rs_id; })[0];
    file = folderAnak_(folderRs_(rs), 'Foto Alat').createFile(blob);
    if (alat.foto_id) try { DriveApp.getFileById(alat.foto_id).setTrashed(true); } catch (e) { }
    ubah_('Alat', alat._baris, Object.assign({}, alat, { foto_id: file.getId(), diubah: sekarang_() }));
  } else if (jenis === 'lampiran') {
    const s = baca_('SesiQC').filter(function (x) { return x.sesi_id === d.sesi_id; })[0];
    if (!s) return fail_('Simpan draf QC dulu sebelum mengunggah lampiran.');
    const rs = baca_('RS').filter(function (r) { return r.rs_id === s.rs_id; })[0];
    file = folderAnak_(folderAnak_(folderRs_(rs), 'Lampiran'), s.periode).createFile(blob);
    hasil.lampiran = { lampiran_id: idBaru_('LP'), sesi_id: s.sesi_id, alat_id: s.alat_id, rs_id: s.rs_id, nama: nama, mime: mime,
      drive_file_id: file.getId(), ukuran: String(ukuran), dibuat: sekarang_() };
    tambah_('Lampiran', [hasil.lampiran]);
  } else return fail_('Jenis berkas tidak dikenal.');
  if (jenis !== 'lampiran') bump_('ref');
  hasil.file_id = file.getId();
  const out = ok_(hasil, 'Berkas terunggah.');
  out.logObjek = jenis; out.logDetail = nama;
  return out;
}

function apiFileAmbil_(ctx, d) {
  const id = String(d.file_id || '');
  if (!id) return fail_('file_id kosong.');
  let boleh = false;
  if (pengaturan_().ttd_file_id === id) boleh = ctx.me.peran === 'FISMED';
  if (!boleh) boleh = baca_('RS').some(function (r) { return r.logo_file_id === id && bolehRs_(ctx, r.rs_id); });
  if (!boleh) boleh = baca_('Alat').some(function (a) { return a.foto_id === id && bolehRs_(ctx, a.rs_id); });
  if (!boleh) boleh = baca_('Lampiran').some(function (l) { return l.drive_file_id === id && bolehRs_(ctx, l.rs_id); });
  if (!boleh) return fail_('Berkas tidak ditemukan atau Anda tidak berhak membukanya.');
  const cacheKey = 'file_' + id;
  const c = CacheX.get(cacheKey);
  if (c) return ok_(c);
  const f = DriveApp.getFileById(id), blob = f.getBlob();
  const out = { file_id: id, nama: f.getName(), mime: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
  if (out.base64.length < 400000) CacheX.put(cacheKey, out, 3600);
  return ok_(out);
}

function apiLampiranHapus_(ctx, d) {
  const l = baca_('Lampiran').filter(function (x) { return x.lampiran_id === d.lampiran_id; })[0];
  if (!l) return fail_('Lampiran tidak ditemukan.');
  try { DriveApp.getFileById(l.drive_file_id).setTrashed(true); } catch (e) { }
  hapusWhere_('Lampiran', function (x) { return x.lampiran_id === l.lampiran_id; });
  const out = ok_({ lampiran_id: l.lampiran_id }, 'Lampiran dihapus.');
  out.logObjek = l.nama;
  return out;
}

/* ---------------------------------------------------------------------
 * TAMBAHAN MODE DRIVE (v3) — ikut dirakit ke js/mesin-kode.js.
 * Fungsi-fungsi ini menggantikan Laporan.gs & Pasang.gs saat Kode.gs
 * dijalankan di browser terhadap salinan sheet di memori.
 * ------------------------------------------------------------------- */
function lisensi_() { return TAMBAHAN.lisensi(); }
function lisensiPublik_() { return TAMBAHAN.lisensi(); }
function apiLisensiSegarkan_() { return fail_('Dijalankan oleh aplikasi.'); }
function apiLisensiPesan_() { return fail_('Dijalankan oleh aplikasi.'); }
function sinkronAtasan_() { TAMBAHAN.atasanBerubah(); }
function pemilikHash_() { return ''; }
function lupaSemua_() { Object.keys(_ROWS).forEach(function (k) { delete _ROWS[k]; }); _PROP_MEMO = null; _SS = null; }

function laporanUntuk_(ctx, rsId) {
  return baca_('LaporanTerkirim')
    .filter(function (l) { return bolehRs_(ctx, l.rs_id) && (!rsId || l.rs_id === rsId); })
    .map(tanpaBaris_)
    .sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; });
}
function apiLaporanList_(ctx, d) { return ok_(laporanUntuk_(ctx, d.rs_id || '')); }
function namaFileLaporan_(rs, periode) {
  return ('Laporan_QC_' + (rs.kode || rs.nama) + '_' + periode).replace(/[^A-Za-z0-9_\-]+/g, '_') + '.pdf';
}
/** v3: PDF dibuat di browser (sama persis dengan pratinjau) dan sudah diunggah ke Drive → d.pdf_file_id. */
function apiLaporanBuat_(ctx, d) {
  const rs = baca_('RS').filter(function (r) { return r.rs_id === d.rs_id; })[0];
  if (!rs) return fail_('Rumah sakit tidak ditemukan.');
  const periode = cekPeriode_(d.periode);
  if (!d.pdf_file_id) return fail_('PDF laporan belum dibuat.');
  const lang = d.bahasa === 'en' ? 'en' : 'id';
  const nama = namaFileLaporan_(rs, periode).replace(/\.pdf$/, lang === 'en' ? '_EN.pdf' : '.pdf');
  const row = { laporan_id: idBaru_('LAP'), rs_id: rs.rs_id, periode: periode, pdf_file_id: String(d.pdf_file_id), nama_file: nama,
    dikirim_ke: '', cc: '', waktu: sekarang_(), status_kirim: 'DIBUAT', pesan_error: '', dibuat_oleh: ctx.me.email };
  tambah_('LaporanTerkirim', [row]);
  const out = ok_({ laporan: row, nama_file: nama }, 'PDF laporan dibuat dan disimpan di Google Drive Anda.');
  out.logObjek = rs.nama + ' ' + periode;
  return out;
}
/** v3: catat bahwa laporan sudah dibagikan (Gmail / WhatsApp / aplikasi lain). */
function apiLaporanTandai_(ctx, d) {
  const l = baca_('LaporanTerkirim').filter(function (x) { return x.laporan_id === d.laporan_id; })[0];
  if (!l) return fail_('Laporan tidak ditemukan.');
  const via = ['gmail', 'email', 'wa', 'bagikan'].indexOf(d.via) > -1 ? d.via : 'bagikan';
  const ke = daftarEmail_(d.penerima).filter(emailValid_), cc = daftarEmail_(d.cc).filter(emailValid_);
  const label = { gmail: 'Gmail', email: 'Email', wa: 'WhatsApp', bagikan: 'Dibagikan' }[via];
  const o = Object.assign({}, l, { dikirim_ke: ke.length ? ke.join(', ') : label, cc: cc.join(', '), waktu: sekarang_(), status_kirim: 'DIBAGIKAN', pesan_error: label });
  ubah_('LaporanTerkirim', l._baris, o);
  return ok_(tanpaBaris_(o), 'Laporan ditandai sudah dibagikan.');
}
function apiLaporanUnduh_() { return fail_('Dijalankan oleh aplikasi.'); }
function apiLaporanKirimUlang_() { return fail_('Kirim ulang lewat tombol Bagikan.'); }
/** Hak membuka berkas (sama dengan apiFileAmbil_). */
function bolehBerkas_(ctx, id) {
  if (!id) return false;
  if (pengaturan_().ttd_file_id === id) return ctx.me.peran === 'FISMED';
  return baca_('RS').some(function (r) { return r.logo_file_id === id && bolehRs_(ctx, r.rs_id); }) ||
    baca_('Alat').some(function (a) { return a.foto_id === id && bolehRs_(ctx, a.rs_id); }) ||
    baca_('Lampiran').some(function (l) { return l.drive_file_id === id && bolehRs_(ctx, l.rs_id); });
}
/** Isi awal database baru (sama dengan langkah 4–5 setupAppEnvironment): template bawaan & pengaturan. */
function isiAwal_() {
  let ubah = false;
  if (!baca_('TemplateJenis').length) {
    const t = vrTemplateBawaan();
    tambah_('TemplateJenis', t.map(function (x) { return { template_id: x.template_id, nama: x.nama, singkatan: x.singkatan, versi: x.versi, aktif: x.aktif, diubah: sekarang_() }; }));
    const ps = [];
    t.forEach(function (x) { x.params.forEach(function (p) { ps.push(Object.assign({ param_id: x.template_id + '-' + p.kode, template_id: x.template_id }, p)); }); });
    tambah_('TemplateParameter', ps);
    ubah = true;
  }
  if (!pengaturan_().pemisah_desimal) { setPengaturan_('pemisah_desimal', ','); ubah = true; }
  return ubah;
}
/** v3: tautan atasan (tanpa akun Google). Peta disimpan di Pengaturan "tautan_atasan" = {email:{id,k,dibuat}}.
 *  d: {email, baru:true → ganti tautan (tautan lama tidak berlaku)} */
function petaTautan_() { try { return JSON.parse(pengaturan_().tautan_atasan || '{}') || {}; } catch (e) { return {}; } }
function apiAtasanTautan_(ctx, d) {
  const email = String(d.email || '').trim().toLowerCase();
  const u = baca_('Pengguna').filter(function (x) { return x.email.toLowerCase() === email && x.peran === 'ATASAN'; })[0];
  if (!u) return fail_('Atasan tidak ditemukan. Simpan dulu atasannya.');
  const peta = petaTautan_(), lama = peta[email];
  if (lama && !d.baru) return ok_({ email: email, id: lama.id, k: lama.k, lama_id: '' });
  peta[email] = { id: TAMBAHAN.acak(16), k: TAMBAHAN.acak(32), dibuat: sekarang_() };
  setPengaturan_('tautan_atasan', JSON.stringify(peta));
  return ok_({ email: email, id: peta[email].id, k: peta[email].k, lama_id: lama ? lama.id : '' }, lama ? 'Tautan baru dibuat. Tautan lama tidak berlaku lagi.' : 'Tautan atasan dibuat.');
}

return { SKEMA: SKEMA, rute_: rute_, penggunaAktif_: penggunaAktif_, baca_: baca_, tambah_: tambah_, ubah_: ubah_, simpanObj_: simpanObj_, hapusWhere_: hapusWhere_, pengaturan_: pengaturan_, lupaSemua_: lupaSemua_, bolehRs_: bolehRs_, bolehBerkas_: bolehBerkas_, dataBoot_: dataBoot_, isiAwal_: isiAwal_, ok_: ok_, fail_: fail_, sekarang_: sekarang_, idBaru_: idBaru_, tanpaBaris_: tanpaBaris_, apiLaporanTandai_: apiLaporanTandai_, apiAtasanTautan_: apiAtasanTautan_, petaTautan_: petaTautan_ };
}
