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
    if (AppState.demo || !AppState.token || navigator.onLine === false || this._jalan) return;
    const l = this.list(); if (!l.length) return;
    this._jalan = true;
    let berhasil = 0;
    for (const it of l) {
      const r = await api(it.action, it.data, { reqId: it.reqId });
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
    pengguna: b.pengguna || [], sesi: b.sesi || [], sesiDari: b.sesiDari || '', laporan: b.laporan || [], hariIni: b.hariIni || ''
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
  if (!AppState.demo) {
    Store.set('sesi', { token: data.token, email: data.boot.me.email, foto: AppState.foto });
    Store.set(userKey('boot'), data.boot);
  }
  renderShell();
  if (!location.hash || location.hash === '#/') location.hash = '#/dasbor'; else rute();
  alurPertama();
  Antrean.flush();
}
async function segarkanBoot(diam) {
  const r = await api('boot', {});
  if (!r.success) { if (!diam) toast(r.message, 'error'); return false; }
  const per = AppState.periode;
  terapkanBoot(r.data);
  AppState.periode = per || r.data.periode;
  if (!AppState.demo) Store.set(userKey('boot'), r.data);
  renderShell(); rute();
  return true;
}
function keluar(semua) {
  const lanjut = async () => {
    if (semua && !AppState.demo) await api('auth.keluarSemua', {});
    if (!AppState.demo) { Store.del(userKey('boot')); Store.del('sesi'); }
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
  document.title = tr('Masuk') + ' — VeriRad';
  const siap = konfigurasiSiap();
  const demoBoleh = !siap || /[?&]demo\b/.test(location.search);
  $('#app').innerHTML =
    '<div class="login">' +
    '<section class="login-art">' +
    '<div><div class="hstack"><div class="brand" style="padding:0;border:0"><div class="logo">' + ic('shield-check') + '</div><div><b>VeriRad</b><span>QC Radiologi</span></div></div></div>' +
    '<h1>Smart QC for <em>Safer Radiology</em></h1><p>QC bulanan alat radiologi di beberapa rumah sakit, dari pengukuran di ruangan sampai laporan PDF untuk atasan.</p>' +
    '<div class="feat">' +
    '<div><div class="ico">' + ic('clipboard-pen-line') + '</div><div><b>Input QC cepat</b><span>Form per kategori dengan nilai hitung otomatis.</span></div></div>' +
    '<div><div class="ico">' + ic('circle-check') + '</div><div><b>Lulus/Gagal otomatis</b><span>Dinilai langsung terhadap toleransi template Anda.</span></div></div>' +
    '<div><div class="ico">' + ic('file-text') + '</div><div><b>Laporan PDF sekali klik</b><span>Berkop RS, bertanda tangan, terkirim ke email atasan.</span></div></div>' +
    '</div></div>' +
    '<p class="small" style="color:#64748B">VeriRad v' + esc(VR_VERSI) + '</p></section>' +
    '<section class="login-form">' + tombolBahasa('login-lang') + '<div class="card login-card">' +
    '<h2>Masuk ke VeriRad</h2><p class="muted" style="margin:0">Gunakan akun Gmail yang terdaftar.</p>' +
    '<div id="gbtn" class="gbtn-wrap">' + (siap ? '<div class="skel" style="width:300px;height:40px"></div>' : '') + '</div>' +
    '<div id="login-msg">' + (pesan || '') + '</div>' +
    (!siap ? '<div class="banner banner-warn" style="margin-top:8px">' + ic('triangle-alert') + '<div class="t small"><b>Konfigurasi belum lengkap.</b> Isi URL Web App di <span class="mono">js/config.js</span>. Sementara itu Anda bisa mencoba Mode Demo.</div></div>' : '') +
    (demoBoleh ? '<div class="divider">atau coba tanpa server</div><div class="stack" style="gap:8px">' +
      '<button class="btn btn-block" data-demo="FISMED">' + ic('flask-conical') + 'Mode Demo — Fisikawan Medis</button>' +
      '<button class="btn btn-block btn-ghost" data-demo="ATASAN">' + ic('eye') + 'Mode Demo — Atasan (lihat saja)</button>' +
      '<p class="hint" style="text-align:center">Data contoh fiktif, hanya di browser ini, hilang saat dimuat ulang.</p></div>' : '') +
    '<div style="margin-top:16px">' + tombolPasang('btn btn-block btn-ghost') + '</div>' +
    '<p class="hint" style="margin-top:20px;text-align:center">Belum terdaftar? Hubungi fisikawan medis Anda.</p>' +
    '</div></section></div>';
  $$('[data-demo]').forEach(b => b.addEventListener('click', () => mulaiDemo(b.dataset.demo)));
  if (siap) pasangGoogle();
}
function mulaiDemo(peran) {
  AppState.demo = true;
  Demo.init(peran);
  masuk(Demo.handle('auth.login', { peran }).data);
  toast('Mode Demo aktif. Data contoh fiktif dan tidak dikirim ke server.', 'info');
}
async function pasangGoogle() {
  const cfg = await api('auth.config', {});
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
  { id: 'dasbor', label: 'Dasbor', ikon: 'layout-dashboard' },
  { id: 'input', label: 'Input QC', ikon: 'clipboard-pen-line', fismed: true, hitung: true },
  { id: 'riwayat', label: 'Riwayat & Tren', ikon: 'chart-line' },
  { id: 'laporan', label: 'Laporan', ikon: 'file-text' },
  { grp: 'Data Master', fismed: true },
  { id: 'kelola', label: 'Kelola RS & Alat', ikon: 'building-2', fismed: true },
  { id: 'template', label: 'Template Toleransi', ikon: 'sliders-horizontal', fismed: true },
  { id: 'pengaturan', label: 'Pengaturan', ikon: 'settings', fismed: true }
];
function hitungBelum() { return alatAktif().filter(a => statusAlat(a.alat_id, AppState.periode).st === 'BELUM' || statusAlat(a.alat_id, AppState.periode).st === 'DRAF').length; }
function renderShell() {
  const me = AppState.me, f = fismed();
  const nav = NAV.filter(n => !n.fismed || f).map(n => n.grp ? '<div class="grp">' + esc(n.grp) + '</div>' :
    '<a href="#/' + n.id + '" data-nav="' + n.id + '">' + ic(n.ikon) + '<span>' + esc(n.label) + '</span>' + (n.hitung && hitungBelum() ? '<span class="cnt">' + hitungBelum() + '</span>' : '') + '</a>').join('');
  const rsAtasan = !f ? rsAktif().map(r => r.nama).join(', ') : '';
  $('#app').classList.toggle('is-demo', !!AppState.demo);
  $('#app').innerHTML = (AppState.demo ? '<div class="demo-ribbon">MODE DEMO — data contoh fiktif, tidak tersimpan ke server</div>' : '') +
    '<div class="shell"><aside class="sidebar" id="sidebar">' +
    '<div class="brand"><div class="logo">' + ic('shield-check') + '</div><div><b>VeriRad</b><span>Smart QC Radiologi</span></div></div>' +
    '<nav class="nav" aria-label="Menu utama">' + nav + tombolPasang('nav-pasang') + '</nav>' +
    '<div class="side-foot">' + (!f ? '<div class="side-card"><b>' + ic('eye') + 'Akses lihat saja</b>Anda memantau hasil QC dan laporan untuk ' + esc(rsAtasan || 'RS Anda') + '.</div>' :
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
    '</header><main class="content" id="page" tabindex="-1"></main></div></div>';
  $('#burger').addEventListener('click', () => toggleSidebar(true));
  $('#btn-keluar').addEventListener('click', () => menuAkun());
  $('#btn-segar').addEventListener('click', async e => { setBusy(e.currentTarget, true, ''); await segarkanBoot(); });
  $('#sel-periode').addEventListener('change', e => { AppState.periode = e.target.value; Store.set(userKey('periode'), AppState.periode); renderShell(); rute(); });
  perbaruiPill();
}
function menuAkun() {
  modal({ judul: 'Akun', ikon: 'user', isi: '<p style="margin:0 0 4px"><b>' + esc(AppState.me.nama || '') + '</b></p><p class="mono small muted" style="margin:0">' + esc(AppState.me.email) + '</p>' +
    (AppState.demo ? '<p class="hint" style="margin-top:12px">Anda sedang di Mode Demo.</p>' : ''),
    tombol: [{ label: 'Batal' }].concat(AppState.demo ? [] : [{ label: 'Keluar dari semua perangkat', kelas: 'btn-danger', aksi: () => keluar(true) }]).concat([{ label: 'Keluar', kelas: 'btn-primary', ikon: 'log-out', aksi: () => keluar(false) }]) });
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
  $('#pill-t').textContent = AppState.demo ? 'Mode demo' : !on ? 'Offline' : n ? n + ' belum terkirim' : 'Tersambung';
}

/* ---------------- Router ---------------- */
function rute() {
  if (!AppState.me) return;
  const [nama, param] = location.hash.replace(/^#\/?/, '').split('/');
  let def = Halaman[nama];
  if (!def || (def.akses === 'fismed' && !fismed())) { if (location.hash !== '#/dasbor') { location.hash = '#/dasbor'; return; } def = Halaman.dasbor; }
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
  if (Date.now() - (window.__terakhirLihat || 0) > 120000) { warmUpServer(); Antrean.flush(); }
  window.__terakhirLihat = Date.now();
});
setInterval(() => Antrean.flush(), 60000);

document.addEventListener('DOMContentLoaded', () => {
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
