/* =====================================================================
 * VeriRad — app.js : login Google, shell (sidebar/topbar), router hash,
 * antrean sinkron offline, dan alur pertama kali.
 * ===================================================================== */
'use strict';


/* ---------------- Antrean offline ---------------- */
const Antrean = {
  list() { return Store.get(userKey('antrean'), []); },
  simpan(l) { Store.set(userKey('antrean'), l); perbaruiPill(); },
  tambah(item) { const l = this.list().filter(x => x.kunci !== item.kunci); l.push(item); this.simpan(l); },
  async flush() {
    if (AppState.demo || !AppState.token || navigator.onLine === false || this._jalan || AppState.atasanPaket) return;
    if (modeRelay() && !GAuth.valid()) return;                         // tunggu pengguna menyambungkan Google lagi
    const l = this.list(); if (!l.length) return;
    this._jalan = true;
    let berhasil = 0;
    for (const it of l) {
      const r = await api(it.action, it.data, { reqId: it.reqId, diam: true });
      if (r.data && r.data.code === 'LISENSI') {                       // simpan di perangkat, kirim setelah diperpanjang
        if (Date.now() - (window.__antreLis || 0) > 600000) { window.__antreLis = Date.now(); toast('Data QC di perangkat ini disimpan dulu dan dikirim otomatis setelah langganan diperpanjang.', 'warning'); }
        break;
      }
      if (r.success) {
        berhasil++;
        this.simpan(this.list().filter(x => x.reqId !== it.reqId));
        if (it.action === 'sesi.simpan' && r.data) { upsertSesi(r.data.sesi); AppState.hasil[r.data.sesi.sesi_id] = r.data.hasil; Store.del(userKey('draf:' + it.data.alat_id + ':' + it.data.periode)); }
      } else if (!r.network) {
        toast('Data "' + it.label + '" ditolak server: ' + r.message, 'error');
        this.simpan(this.list().filter(x => x.reqId !== it.reqId));
      } else break;
    }
    this._jalan = false;
    if (berhasil) { toast(berhasil + ' data dari perangkat berhasil dikirim ke server.', 'success'); rute(); }
  }
};

/* ---------------- Boot & sesi login ---------------- */
function terapkanBoot(b) {
  Object.assign(AppState, {
    me: b.me, pengaturan: b.pengaturan || {}, rs: b.rs || [], alat: b.alat || [], templates: b.templates || [], params: b.params || [],
    pengguna: b.pengguna || [], sesi: b.sesi || [], sesiDari: b.sesiDari || '', laporan: b.laporan || [], hariIni: b.hariIni || '',
    lisensi: b.lisensi || null
  });
  AppState.hasil = {}; AppState.lampiran = {};
  if (!AppState.periode) AppState.periode = Store.get(userKey('periode'), '') || b.periode;
  AppState.periodeSekarang = b.periode;
}
function tokenKedaluwarsa(t) {
  try { const p = JSON.parse(atob(t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); return !p.x || p.x < Date.now() + 60000; } catch (e) { return true; }
}
async function masuk(data) {
  AppState.token = data.token;
  AppState.foto = data.foto || '';
  AppState.periode = '';
  terapkanBoot(data.boot);
  if (!AppState.demo && !modeRelay()) {
    Store.set('sesi', { token: data.token, email: data.boot.me.email, foto: AppState.foto });
    Store.set(userKey('boot'), data.boot);
  }
  renderShell();
  if (!location.hash || location.hash === '#/') location.hash = '#/dasbor'; else rute();
  alurPertama();
  Antrean.flush();
}
async function segarkanBoot(diam) {
  if (AppState.atasanPaket) return PaketAtasan.segarkan();
  if (modeRelay() && !AppState.demo && GAuth.valid() && !diam) { try { if (await Mesin.adaBaru()) await Mesin.muat(AppState.me.email); } catch (e) { } }
  const r = await api('boot', {});
  if (!r.success) { if (!diam) toast(r.message, 'error'); return false; }
  const per = AppState.periode;
  terapkanBoot(r.data);
  AppState.periode = per || r.data.periode;
  if (!AppState.demo && !modeRelay()) Store.set(userKey('boot'), r.data);
  renderShell(); rute();
  return true;
}
function keluar(semua) {
  const lanjut = async () => {
    if (semua && !AppState.demo) await api('auth.keluarSemua', {});
    if (!AppState.demo) { Store.del(userKey('boot')); Store.del('sesi'); }
    if (modeLisensi() && !AppState.demo) { Lis.lupa(); setBackend(''); }
    if (modeRelay() && !AppState.demo) {
      if (AppState.atasanPaket) PaketAtasan.lupa();
      else { Lis.lupa(); Store.del('sesi3'); GAuth.keluar(); Mesin.reset(); if (semua) DB.cacheHapus(String((AppState.me || {}).email || '').toLowerCase()); }
    }
    AppState.atasanPaket = null;
    try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch (e) { }
    AppState.token = ''; AppState.me = null; AppState.demo = false;
    history.replaceState(null, '', location.pathname);
    renderLogin();
  };
  if (Antrean.list().length && !AppState.demo) {
    konfirmasi('Ada data belum terkirim', 'Masih ada ' + Antrean.list().length + ' data QC yang belum terkirim ke server. Data tetap tersimpan di perangkat ini dan akan dikirim saat Anda masuk lagi.', 'Tetap keluar').then(ok => ok && lanjut());
  } else lanjut();
}
function onSessionExpired() {
  if (!AppState.token) return;
  AppState.token = '';
  Store.del('sesi');
  toast('Sesi Anda berakhir. Silakan masuk lagi.', 'warning');
  renderLogin();
}

/* ---------------- Tampilan login ---------------- */
function renderLogin(pesan) {
  window.__halLis = null; if (window.Lis) Lis.henti();
  document.title = tr('Masuk') + ' — VeriRad';
  const siap = modeRelay() || modeLisensi() || konfigurasiSiap();
  const demoBoleh = !siap || modeRelay() || modeLisensi() || /[?&]demo\b/.test(location.search);
  $('#app').innerHTML =
    '<div class="login">' +
    '<section class="login-art">' +
    '<div><div class="hstack"><div class="brand" style="padding:0;border:0"><div class="logo">' + logoVR() + '</div><div><b>Veri<em>Rad</em></b><span>QC Radiologi</span></div></div></div>' +
    '<h1>Smart QC for <em>Safer Radiology</em></h1><p>QC bulanan alat radiologi di beberapa rumah sakit, dari pengukuran di ruangan sampai laporan PDF untuk atasan.</p>' +
    '<div class="feat">' +
    '<div><div class="ico">' + ic('clipboard-pen-line') + '</div><div><b>Input QC cepat</b><span>Form per kategori dengan nilai hitung otomatis.</span></div></div>' +
    '<div><div class="ico">' + ic('circle-check') + '</div><div><b>Lulus/Gagal otomatis</b><span>Dinilai langsung terhadap toleransi template Anda.</span></div></div>' +
    '<div><div class="ico">' + ic('file-text') + '</div><div><b>Laporan PDF sekali klik</b><span>Berkop RS, bertanda tangan, terkirim ke email atasan.</span></div></div>' +
    '</div></div>' +
    '<p class="small" style="color:#64748B">VeriRad v' + esc(VR_VERSI) + ' · <a href="privasi.html" target="_blank" rel="noopener" style="color:#94A3B8">Kebijakan Privasi</a> · <a href="panduan.html" target="_blank" rel="noopener" style="color:#94A3B8">Panduan</a></p></section>' +
    '<section class="login-form">' + tombolBahasa('login-lang') + '<div class="card login-card">' +
    '<h2>Masuk ke VeriRad</h2><p class="muted" style="margin:0">' + (modeRelay() ? 'Gunakan akun Google tempat data QC Anda disimpan.' : 'Gunakan akun Gmail yang terdaftar.') + '</p>' +
    (modeRelay() ? '<div class="gbtn-wrap"><button class="btn btn-primary btn-block btn-lg" id="btn-masuk-g">' + ic('log-in') + 'Masuk dengan Google</button></div>' :
      '<div id="gbtn" class="gbtn-wrap">' + (siap ? '<div class="skel" style="width:300px;height:40px"></div>' : '') + '</div>') +
    '<div id="login-msg">' + (pesan || '') + '</div>' +
    (!siap ? '<div class="banner banner-warn" style="margin-top:8px">' + ic('triangle-alert') + '<div class="t small"><b>Konfigurasi belum lengkap.</b> Isi RELAY_URL dan GOOGLE_CLIENT_ID di <span class="mono">js/config.js</span>. Sementara itu Anda bisa mencoba Mode Demo.</div></div>' : '') +
    (demoBoleh ? '<div class="divider">atau coba tanpa server</div><div class="stack" style="gap:8px">' +
      '<button class="btn btn-block" data-demo="FISMED">' + ic('flask-conical') + 'Mode Demo — Fisikawan Medis</button>' +
      '<button class="btn btn-block btn-ghost" data-demo="ATASAN">' + ic('eye') + 'Mode Demo — Atasan (lihat saja)</button>' +
      '<p class="hint" style="text-align:center">Data contoh fiktif, hanya di browser ini, hilang saat dimuat ulang.</p></div>' : '') +
    '<div style="margin-top:16px">' + tombolPasang('btn btn-block btn-ghost') + '</div>' +
    (modeRelay() ? '<p class="hint" style="margin-top:20px;text-align:center">Fisikawan medis: masuk dengan akun Google untuk berlangganan atau membuka data QC Anda. Atasan: buka tautan yang dikirim fisikawan medis Anda — tidak perlu masuk.</p>' :
      modeLisensi() ? '<p class="hint" style="margin-top:20px;text-align:center">Fisikawan medis: masuk untuk berlangganan atau memasang VeriRad. Atasan: masuk dengan email yang ditautkan fisikawan medis Anda.</p>' :
      '<p class="hint" style="margin-top:20px;text-align:center">Belum terdaftar? Hubungi fisikawan medis Anda.</p>') +
    '</div></section></div>';
  $$('[data-demo]').forEach(b => b.addEventListener('click', () => mulaiDemo(b.dataset.demo)));
  const bg = $('#btn-masuk-g'); if (bg) bg.addEventListener('click', () => masukRelay(bg, 'select_account'));
  if (siap && !modeRelay()) pasangGoogle();
}
function mulaiDemo(peran) {
  AppState.demo = true;
  Demo.init(peran);
  masuk(Demo.handle('auth.login', { peran }).data);
  toast('Mode Demo aktif. Data contoh fiktif dan tidak dikirim ke server.', 'info');
}
/* ---------------- Mode Drive v3: login Google (token drive.file) → relay → database di Drive ---------------- */
async function masukRelay(btn, prompt) {
  const msg = $('#login-msg');
  const tulis = h => { const m = $('#login-msg'); if (m) m.innerHTML = h; };
  if (btn) setBusy(btn, true, 'Menghubungkan ke Google…');
  try { await GAuth.minta(prompt == null ? '' : prompt); }
  catch (e) { if (btn) setBusy(btn, false); tulis('<div class="banner banner-fail small">' + ic('circle-x') + '<div class="t">' + esc(e.message) + '</div></div>'); return; }
  tulis('<p class="hint" style="text-align:center">' + ic('loader-circle', 'spin') + ' Memeriksa langganan…</p>');
  const [r, prof] = await Promise.all([Lis.panggil('masuk', { at: GAuth.tok.at, versi: VR_VERSI }), GAuth.profil().catch(() => ({}))]);
  if (btn) setBusy(btn, false);
  if (!r.success) { tulis('<div class="banner banner-fail small">' + ic('circle-x') + '<div class="t">' + esc(r.message) + '</div></div>'); return; }
  r.data.nama_google = prof.name || ''; r.data.foto = prof.picture || '';
  return lanjutRelay(r.data);
}
function lanjutRelay(d) {
  Lis.simpan(d); Lis.data = d;
  Store.set('email3', d.email);
  if (window.__setelahMasukLisensi) { const f = window.__setelahMasukLisensi; window.__setelahMasukLisensi = null; return f(d); }
  if (/^#\/admin\b/.test(location.hash)) return renderAdmin();
  if (!d.pelanggan) return renderBeli(d);
  return bukaDataDrive(d);
}
async function bukaDataDrive(d) {
  AppState.demo = false; AppState.token = 'drive'; AppState.atasanPaket = null;
  AppState.me = { email: d.email, nama: d.nama_google || (d.pelanggan && d.pelanggan.nama) || '' };
  AppState.foto = d.foto || AppState.foto || '';
  terapkanLisensi(d);
  $('#app').innerHTML = '<div class="boot-load">' + ic('loader-circle', 'spin') + '&nbsp; Membuka data QC di Google Drive Anda…</div>';
  try { await Mesin.muat(d.email, { nama: AppState.me.nama }); }
  catch (e) {
    console.error(e);
    $('#app').innerHTML = '<div class="boot-load"><div class="card card-b" style="max-width:460px"><h2 style="margin-top:0">' + ic('circle-x') + ' Data belum bisa dibuka</h2><p>' + esc(e.message) + '</p>' +
      '<div class="hstack" style="gap:8px"><button class="btn btn-primary" id="ul">' + ic('refresh-cw') + 'Coba lagi</button><button class="btn btn-ghost" id="kl">Keluar</button></div></div></div>';
    $('#ul').addEventListener('click', () => bukaDataDrive(d)); $('#kl').addEventListener('click', () => keluar(false));
    return;
  }
  Store.set('sesi3', { email: d.email, nama: AppState.me.nama, foto: AppState.foto, t: Date.now() });
  const b = await api('boot', {});
  masuk({ token: 'drive', foto: AppState.foto, boot: b.data });
  if (d.pelanggan && d.pelanggan.status === 'AKTIF' && Mesin.tabel('RS').length !== Number(d.pelanggan.jumlah_rs || -1)) Lis.panggil('masuk', { at: GAuth.tok && GAuth.tok.at, versi: VR_VERSI, jumlah_rs: Mesin.tabel('RS').length }).catch(() => { });
  PaketAtasan.mungkinTerbit();
}
/** Buka lagi tanpa klik: tampil dari salinan di perangkat, lalu sinkron di latar bila token Google masih berlaku. */
async function mulaiRelayTersimpan(s) {
  Store.set('email3', s.email);
  AppState.demo = false; AppState.token = 'drive';
  AppState.me = { email: s.email, nama: s.nama || '' }; AppState.foto = s.foto || '';
  AppState.lisensi = Store.get(userKey('lisensi3'), null);
  if (AppState.lisensi && Date.now() - (AppState.lisensi.diperiksa || 0) > 7 * 864e5) AppState.lisensi = Object.assign({}, AppState.lisensi, { boleh_tulis: false, pesan: 'Status langganan perlu diperiksa ulang. Sambungkan ke internet lalu klik "Sambungkan lagi".' });
  const ada = await Mesin.muat(s.email, { dariCache: true });
  if (!ada) return layarLanjutkan(s);
  const b = await api('boot', {});
  masuk({ token: 'drive', foto: AppState.foto, boot: b.data });
  if (GAuth.valid()) sinkronRelay(); else onGoogleTerputus();
}
function layarLanjutkan(s) {
  renderLogin('<div class="card card-b" style="margin-top:12px;text-align:center"><p style="margin:0 0 8px">Lanjutkan sebagai <b class="mono">' + esc(s.email) + '</b>?</p><button class="btn btn-primary btn-block" id="btn-lanjut">' + ic('arrow-right') + 'Lanjutkan</button></div>');
  $('#btn-lanjut').addEventListener('click', e => masukRelay(e.currentTarget, ''));
}
/** Periksa langganan & perubahan dari perangkat lain (token Google harus berlaku). */
async function sinkronRelay() {
  if (!modeRelay() || !AppState.me || AppState.atasanPaket || AppState.demo || !GAuth.valid()) return;
  const r = await Lis.panggil('masuk', { at: GAuth.tok.at, versi: VR_VERSI });
  if (r.success) {
    Lis.simpan(r.data);
    if (!r.data.pelanggan) { toast('Langganan untuk akun ini tidak ditemukan.', 'warning'); }
    terapkanLisensi(r.data); bannerLisensi();
  }
  try {
    if (Antrean.list().length === 0 && await Mesin.adaBaru()) {
      await Mesin.muat(AppState.me.email);
      const b = await api('boot', {}); const per = AppState.periode;
      terapkanBoot(b.data); AppState.periode = per || b.data.periode; renderShell(); rute();
    }
  } catch (e) { console.warn('Sinkron:', e.message); }
  const gb = $('#g-banner'); if (gb) gb.innerHTML = '';
  Antrean.flush(); PaketAtasan.mungkinTerbit();
}
window.onGoogleTerputus = function () {
  if (!modeRelay() || !AppState.me || AppState.atasanPaket || AppState.demo) return;
  const box = $('#g-banner'); if (!box) return;
  box.innerHTML = '<div class="banner banner-warn">' + ic('cloud-off') + '<div class="t small"><b>Belum tersambung ke Google Drive.</b> Anda melihat data yang tersimpan di perangkat ini; data QC baru disimpan di perangkat dulu.</div>' +
    '<button class="btn btn-sm btn-primary" id="g-sambung">' + ic('refresh-cw') + 'Sambungkan lagi</button></div>';
  $('#g-sambung', box).addEventListener('click', async e => {
    setBusy(e.currentTarget, true, 'Menghubungkan…');
    try { await GAuth.minta(''); box.innerHTML = ''; await sinkronRelay(); }
    catch (er) { setBusy(e.currentTarget, false); toast(er.message, 'error'); }
  });
};

async function pasangGoogle() {
  const cfg = modeLisensi() ? await Lis.config() : await api('auth.config', {});
  const box = $('#gbtn');
  if (!box) return;
  if (!cfg.success) { box.innerHTML = ''; $('#login-msg').innerHTML = '<div class="banner banner-fail small">' + ic('circle-x') + '<div class="t">Server tidak bisa dihubungi: ' + esc(cfg.message) + '</div></div>'; return; }
  if (!cfg.data.googleClientId) { box.innerHTML = ''; $('#login-msg').innerHTML = '<div class="banner banner-warn small">' + ic('triangle-alert') + '<div class="t">GOOGLE_CLIENT_ID belum diisi di Script Properties. Lihat panduan instalasi.</div></div>'; return; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => {
    google.accounts.id.initialize({ client_id: cfg.data.googleClientId, callback: onGoogleCredential, auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup' });
    box.innerHTML = '';
    google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 320, locale: 'id' });
  };
  s.onerror = () => { box.innerHTML = '<p class="err-msg">Tombol Google gagal dimuat. Periksa koneksi internet.</p>'; };
  document.head.appendChild(s);
}
async function onGoogleCredential(resp) {
  const msg = $('#login-msg');
  if (modeRelay()) return;
  if (modeLisensi()) {
    if (window.__setelahMasukLisensi) {                                  // login dari halaman Admin
      const r = await Lis.panggil('masuk', { idToken: resp.credential });
      if (!r.success) { if (msg) msg.innerHTML = '<div class="banner banner-fail small">' + ic('circle-x') + '<div class="t">' + esc(r.message) + '</div></div>'; return; }
      Lis.idToken = resp.credential; return window.__setelahMasukLisensi(r.data);
    }
    return masukLisensi(resp.credential);
  }
  msg.innerHTML = '<p class="hint" style="text-align:center">' + ic('loader-circle', 'spin') + ' Memverifikasi akun…</p>';
  const r = await api('auth.login', { idToken: resp.credential });
  if (r.success) return masuk(r.data);
  if (r.data && r.data.code === 'NOT_REGISTERED') {
    msg.innerHTML = '<div class="banner banner-fail" style="align-items:flex-start">' + ic('lock') + '<div class="t"><b>Akses ditolak</b><p class="small" style="margin:4px 0 0">Email <span class="mono">' + esc(r.data.email) +
      '</span> belum terdaftar di VeriRad. Minta fisikawan medis Anda menambahkan email ini di menu Pengaturan.</p></div></div>' +
      '<button class="btn btn-block" style="margin-top:12px" id="ganti-akun">' + ic('refresh-cw') + 'Ganti Akun Google</button>';
    $('#ganti-akun').addEventListener('click', () => { google.accounts.id.disableAutoSelect(); google.accounts.id.prompt(); });
    return;
  }
  msg.innerHTML = '<div class="banner banner-fail small">' + ic('circle-x') + '<div class="t">' + esc(r.message) + '</div></div>';
}

/* ---------------- Shell ---------------- */
const NAV = [
  { id: 'dasbor', label: 'Dasbor', ikon: 'layout-dashboard', atasan: true },
  { id: 'input', label: 'Input QC', ikon: 'clipboard-pen-line', fismed: true, hitung: true },
  { id: 'riwayat', label: 'Riwayat & Tren', ikon: 'chart-line', atasan: true },
  { id: 'laporan', label: 'Laporan', ikon: 'file-text' },
  { grp: 'Data Master', fismed: true },
  { id: 'kelola', label: 'Kelola RS & Alat', ikon: 'building-2', fismed: true },
  { id: 'template', label: 'Template Toleransi', ikon: 'sliders-horizontal', fismed: true },
  { id: 'pengaturan', label: 'Pengaturan', ikon: 'settings', fismed: true }
];
function hitungBelum() { return alatAktif().filter(a => statusAlat(a.alat_id, AppState.periode).st === 'BELUM' || statusAlat(a.alat_id, AppState.periode).st === 'DRAF').length; }
function renderShell() {
  window.__halLis = null;
  const me = AppState.me, f = fismed();
  const nav = NAV.filter(n => f ? true : n.atasan).map(n => n.grp ? '<div class="grp">' + esc(n.grp) + '</div>' :
    '<a href="#/' + n.id + '" data-nav="' + n.id + '">' + ic(n.ikon) + '<span>' + esc(n.label) + '</span>' + (n.hitung && hitungBelum() ? '<span class="cnt">' + hitungBelum() + '</span>' : '') + '</a>').join('');
  const rsAtasan = !f ? rsAktif().map(r => r.nama).join(', ') : '';
  $('#app').classList.toggle('is-demo', !!AppState.demo);
  $('#app').innerHTML = (AppState.demo ? '<div class="demo-ribbon">MODE DEMO — data contoh fiktif, tidak tersimpan ke server</div>' : '') +
    '<div class="shell"><aside class="sidebar" id="sidebar">' +
    '<div class="brand"><div class="logo">' + logoVR() + '</div><div><b>Veri<em>Rad</em></b><span>Smart QC Radiologi</span></div></div>' +
    '<nav class="nav" aria-label="Menu utama">' + nav + (f && (Lis.sesi() || {}).admin && !AppState.demo ? '<a href="#/admin" data-nav="admin">' + ic('shield-check') + '<span>Admin Lisensi</span></a>' : '') + tombolPasang('nav-pasang') + '</nav>' +
    '<div class="side-foot">' + (!f ? '<div class="side-card"><b>' + ic('eye') + 'Akses lihat saja</b>Anda memantau hasil QC untuk ' + esc(rsAtasan || 'RS Anda') + '.' + (AppState.atasanPaket ? '<span class="small" style="display:block;margin-top:6px;opacity:.8">' + esc(PaketAtasan.info()) + '</span>' : '') + '</div>' :
      '<div class="side-card"><b>' + ic('shield-check') + 'QC tepat, laporan cepat</b>Toleransi mengikuti template yang Anda tetapkan.</div>') +
    '<div class="user-box"><div class="avatar">' + (AppState.foto ? '<img src="' + esc(AppState.foto) + '" alt="">' : esc(inisial(me.nama || me.email))) + '</div>' +
    '<div style="min-width:0;flex:1"><div class="nm">' + esc(me.nama || me.email) + '</div><div class="rl">' + (f ? 'Fisikawan Medis' : esc(me.jabatan || 'Atasan')) + '</div></div>' +
    '<button class="btn btn-ghost btn-icon btn-sm" style="color:#94A3B8" id="btn-keluar" title="Keluar" aria-label="Keluar">' + ic('log-out') + '</button></div></div></aside>' +
    '<div class="main"><header class="topbar"><button class="btn btn-ghost btn-icon burger" id="burger" aria-label="Buka menu">' + ic('menu') + '</button>' +
    '<div class="crumb"><span class="hide-sm">VeriRad</span><span class="hide-sm">' + ic('chevron-right') + '</span><b id="crumb-t"></b></div><div class="sp"></div>' +
    tombolBahasa() + '<label class="sr-only" for="sel-periode">Periode</label><select class="input" id="sel-periode" title="Periode QC">' +
    daftarPeriode().map(p => '<option value="' + p + '"' + (p === AppState.periode ? ' selected' : '') + '>' + esc(vrNamaPeriode(p)) + '</option>').join('') + '</select>' +
    '<span class="pill hide-sm" id="pill-sync"><span class="dot"></span><span id="pill-t">Tersambung</span></span>' +
    '<button class="btn btn-ghost btn-icon" id="btn-segar" title="Muat ulang data" aria-label="Muat ulang data">' + ic('refresh-cw') + '</button>' +
    '</header><div id="g-banner" class="lis-banner"></div><div id="lis-banner" class="lis-banner"></div><main class="content" id="page" tabindex="-1"></main></div></div>';
  $('#burger').addEventListener('click', () => toggleSidebar(true));
  $('#btn-keluar').addEventListener('click', () => menuAkun());
  $('#btn-segar').addEventListener('click', async e => { setBusy(e.currentTarget, true, ''); await segarkanBoot(); });
  $('#sel-periode').addEventListener('change', e => { AppState.periode = e.target.value; Store.set(userKey('periode'), AppState.periode); renderShell(); rute(); });
  perbaruiPill();
  bannerLisensi();
}
function menuAkun() {
  const atasan = !!AppState.atasanPaket, relay = modeRelay() && !AppState.demo && !atasan;
  modal({ judul: 'Akun', ikon: 'user', isi: '<p style="margin:0 0 4px"><b>' + esc(AppState.me.nama || '') + '</b></p><p class="mono small muted" style="margin:0">' + esc(AppState.me.email) + '</p>' +
    (AppState.demo ? '<p class="hint" style="margin-top:12px">Anda sedang di Mode Demo.</p>' : '') +
    (atasan ? '<p class="hint" style="margin-top:12px">' + esc(PaketAtasan.info()) + '. Keluar akan menghapus tautan dari perangkat ini; buka lagi tautan dari fisikawan medis untuk masuk kembali.</p>' : '') +
    (relay ? '<p class="hint" style="margin-top:12px">Data QC tersimpan di Google Drive akun ini (folder <b>VeriRad</b>). "Keluar & hapus salinan" juga menghapus salinan data di perangkat ini.</p>' : ''),
    tombol: [{ label: 'Batal' }].concat(AppState.demo || atasan ? [] : [{ label: relay ? 'Keluar & hapus salinan' : 'Keluar dari semua perangkat', kelas: 'btn-danger', aksi: () => keluar(true) }]).concat([{ label: 'Keluar', kelas: 'btn-primary', ikon: 'log-out', aksi: () => keluar(false) }]) });
}
function toggleSidebar(buka) {
  const sb = $('#sidebar'); if (!sb) return;
  sb.classList.toggle('open', buka);
  let sc = $('.scrim');
  if (buka && !sc) { sc = document.createElement('div'); sc.className = 'scrim'; sc.addEventListener('click', () => toggleSidebar(false)); document.body.appendChild(sc); }
  if (!buka && sc) sc.remove();
}
function perbaruiPill() {
  const p = $('#pill-sync'); if (!p) return;
  const n = Antrean.list().length, on = navigator.onLine !== false;
  p.className = 'pill hide-sm' + (!on ? ' off' : n ? ' wait' : '');
  $('#pill-t').textContent = AppState.demo ? 'Mode demo' : AppState.atasanPaket ? 'Lihat saja' : !on ? 'Offline' : n ? n + ' belum terkirim' : 'Tersambung';
}

/* ---------------- Router ---------------- */
const HAL_ATASAN = ['dasbor', 'riwayat'];
function rute() {
  if (/^#\/admin\b/.test(location.hash)) return renderAdmin();
  if (!AppState.me) return;
  if (!$('#page')) { renderShell(); }
  const [nama, param] = location.hash.replace(/^#\/?/, '').split('/');
  let def = Halaman[nama];
  if (!def || (def.akses === 'fismed' && !fismed()) || (!fismed() && HAL_ATASAN.indexOf(nama) === -1)) { if (location.hash !== '#/dasbor') { location.hash = '#/dasbor'; return; } def = Halaman.dasbor; }
  $$('[data-nav]').forEach(a => a.toggleAttribute('aria-current', false));
  const aktif = $('[data-nav="' + (Halaman[nama] ? nama : 'dasbor') + '"]');
  if (aktif) aktif.setAttribute('aria-current', 'page');
  toggleSidebar(false);
  const el = $('#page');
  if (!el) return;
  $('#crumb-t').textContent = def.judul;
  document.title = tr(def.judul) + ' — VeriRad';
  el.innerHTML = '';
  if (window.__keluarHalaman) { try { window.__keluarHalaman(); } catch (e) { } window.__keluarHalaman = null; }
  try { def.render(el, param ? decodeURIComponent(param) : ''); }
  catch (e) { console.error(e); el.innerHTML = '<div class="banner banner-fail">' + ic('circle-x') + '<div class="t">Halaman gagal ditampilkan: ' + esc(e.message) + '</div></div>'; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', rute);

/* ---------------- Alur pertama kali ---------------- */
function alurPertama() {
  if (!fismed() || AppState.pengaturan.toleransi_disetujui) return;
  modal({
    judul: 'Sebelum mulai', ikon: 'shield-check', wajib: true,
    isi: '<p style="margin-top:0">VeriRad menyediakan <b>template toleransi bawaan</b> dari contoh laporan QC sebagai titik awal.</p>' +
      '<div class="banner banner-warn small" style="align-items:flex-start">' + ic('triangle-alert') + '<div class="t"><b>Nilai toleransi adalah tanggung jawab fisikawan medis.</b> Periksa setiap batas di menu <b>Template Toleransi</b> terhadap acuan yang berlaku sebelum laporan dikirim. Butir bertanda ⚠ masih perlu keputusan Anda.</div></div>' +
      '<p class="small muted" style="margin-bottom:0">Perubahan template hanya berlaku untuk sesi QC baru; sesi final lama tetap memakai toleransi saat diuji.</p>',
    tombol: [{ label: 'Saya mengerti, lanjutkan', kelas: 'btn-primary', aksi: async () => {
      const r = await api('pengaturan.simpan', { toleransi_disetujui: '1' });
      if (r.success) AppState.pengaturan = Object.assign(AppState.pengaturan, r.data);
      else toast(r.message, 'error');
    } }]
  });
}

/* ---------------- Mulai ---------------- */
window.addEventListener('online', () => { perbaruiPill(); Antrean.flush(); });
window.addEventListener('offline', perbaruiPill);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !AppState.token || AppState.demo) return;
  if (Date.now() - (window.__terakhirLihat || 0) > 120000) { if (modeRelay()) { if (!AppState.atasanPaket) { if (GAuth.valid()) sinkronRelay(); else onGoogleTerputus(); } } else { warmUpServer(); Antrean.flush(); } }
  window.__terakhirLihat = Date.now();
});
setInterval(() => Antrean.flush(), 60000);

document.addEventListener('DOMContentLoaded', () => {
  if (modeRelay()) {
    if (PaketAtasan.dariHash()) return PaketAtasan.mulai();
    if (/^#\/admin\b/.test(location.hash)) return renderAdmin();
    const s3 = Store.get('sesi3', null);
    if (s3 && s3.email) return mulaiRelayTersimpan(s3);
    if (PaketAtasan.adaTersimpan()) return PaketAtasan.mulai();
    return renderLogin();
  }
  if (/^#\/admin\b/.test(location.hash)) return renderAdmin();
  const s = Store.get('sesi', null);
  if (konfigurasiSiap() && s && s.token && !tokenKedaluwarsa(s.token)) {
    AppState.token = s.token; AppState.foto = s.foto || '';
    AppState.me = { email: s.email };
    const boot = Store.get(userKey('boot'), null);
    if (boot) {
      terapkanBoot(boot); renderShell();
      if (!location.hash || location.hash === '#/') location.hash = '#/dasbor'; else rute();
      segarkanBoot(true);                                    // SWR: tampil dari cache, segarkan di latar
    } else {
      $('#app').innerHTML = '<div class="boot-load">' + ic('loader-circle', 'spin') + '&nbsp; Memuat data…</div>';
      api('boot', {}).then(r => { if (r.success) masuk({ token: s.token, boot: r.data, foto: s.foto }); else renderLogin(); });
    }
    Antrean.flush();
    return;
  }
  renderLogin();
  warmUpServer();
});
