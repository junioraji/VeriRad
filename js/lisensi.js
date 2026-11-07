/* =====================================================================
 * VeriRad — lisensi.js
 * Langganan: server lisensi, halaman Berlangganan / Pasang / Pilih RS,
 * kartu Langganan di Pengaturan, banner status, dan Admin Lisensi.
 * Data QC TIDAK pernah lewat server lisensi — hanya email & status paket.
 * ===================================================================== */
'use strict';

const Lis = {
  data: null, idToken: '', _cfg: null, _poll: null,
  sesi() { const s = Store.get('lis', null); return s && s.exp > Date.now() ? s : null; },
  simpan(d) { this.data = d; Store.set('lis', { sesi: d.sesi || (this.sesi() || {}).sesi, email: d.email, admin: !!d.admin, exp: Date.now() + 11.5 * 3600e3 }); },
  lupa() { this.data = null; this.idToken = ''; Store.del('lis'); this.henti(); },
  henti() { if (this._poll) { clearInterval(this._poll); this._poll = null; } },
  async panggil(aksi, data, sesi, ulang) {
    const r = await this._panggil(aksi, data, sesi);
    if (!r.success && r.data && r.data.code === 'AUTH' && !ulang && aksi !== 'masuk' && window.modeRelay && modeRelay() && GAuth.valid()) {   // sesi relay habis → masuk ulang diam-diam
      const m = await this._panggil('masuk', { at: GAuth.tok.at, versi: VR_VERSI });
      if (m.success) { this.simpan(m.data); return this.panggil(aksi, data, '', true); }
    }
    return r;
  },
  async _panggil(aksi, data, sesi) {
    try {
      const res = await fetch(LISENSI_URL, {
        method: 'POST', redirect: 'follow', cache: 'no-store', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ aksi, data: data || {}, sesi: sesi || (this.sesi() || {}).sesi || '' })
      });
      const t = await res.text();
      try { return JSON.parse(t); } catch (e) { return { success: false, message: 'Server lisensi membalas HTTP ' + res.status + '.' }; }
    } catch (e) { return { success: false, network: true, message: 'Server lisensi tidak bisa dihubungi. Periksa koneksi internet.' }; }
  },
  async config() {
    if (this._cfg) return this._cfg;
    try {
      const r = await fetch(LISENSI_URL + '?action=config&t=' + Date.now(), { cache: 'no-store', redirect: 'follow' });
      const j = await r.json();
      if (j.success) this._cfg = j.data;
      return j;
    } catch (e) { return { success: false, message: 'Server lisensi tidak bisa dihubungi.' }; }
  }
};

/* ---------------- Format ---------------- */
function rupiah(n) { return 'Rp' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function tglIndo(s) { return s ? vrTanggalPanjang(s) : ''; }
function salinTeks(teks, btn) {
  const ok = () => { toast('Disalin: ' + teks, 'success'); if (btn) { const h = btn.innerHTML; btn.innerHTML = ic('check') + 'Disalin'; setTimeout(() => { btn.innerHTML = h; }, 1500); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(teks).then(ok, () => fallback());
  else fallback();
  function fallback() { const t = document.createElement('textarea'); t.value = teks; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { } t.remove(); }
}
function tautanWa(nomor, teks) { return 'https://wa.me/' + String(nomor || '').replace(/[^\d]/g, '') + '?text=' + encodeURIComponent(teks); }
const STATUS_LIS = {
  AKTIF: ['Aktif', 'lulus'], TENGGANG: ['Masa tenggang', 'draf'], HABIS: ['Berakhir', 'gagal'], NONAKTIF: ['Dinonaktifkan', 'gagal'],
  BELUM: ['Belum berlangganan', 'belum'], BELUM_AKTIF: ['Belum diaktifkan', 'belum'], TIDAK_SAH: ['Perlu aktivasi ulang', 'gagal'], TIDAK_TERHUBUNG: ['Server lisensi tak terjangkau', 'draf']
};
function badgeLis(st) { const s = STATUS_LIS[st] || [st, 'belum']; return '<span class="badge b-' + s[1] + '">' + esc(s[0]) + '</span>'; }

/* ---------------- Alur setelah login Google (mode lisensi) ---------------- */
async function masukLisensi(idToken) {
  const msg = $('#login-msg');
  if (msg) msg.innerHTML = '<p class="hint" style="text-align:center">' + ic('loader-circle', 'spin') + ' Memeriksa langganan…</p>';
  const r = await Lis.panggil('masuk', { idToken });
  if (!r.success) { if (msg) msg.innerHTML = '<div class="banner banner-fail small">' + ic('circle-x') + '<div class="t">' + esc(r.message) + '</div></div>'; return; }
  Lis.idToken = idToken;
  return lanjutLisensi(r.data);
}
function lanjutLis(d) { return modeRelay() ? lanjutRelay(d) : lanjutLisensi(d); }
function lanjutLisensi(d) {
  Lis.simpan(d);
  const p = d.pelanggan;
  if (p && p.terpasang) return masukBackend(p.backend_url);
  if (p && ['AKTIF', 'TENGGANG'].indexOf(p.status) > -1) return renderPasang(d);
  if (!p && d.atasan && d.atasan.length === 1) return masukBackend(d.atasan[0].backend_url);
  if (!p && d.atasan && d.atasan.length > 1) return renderPilihBackend(d);
  return renderBeli(d);
}
async function masukBackend(url) {
  Lis.henti();
  setBackend(url);
  $('#app').innerHTML = '<div class="boot-load">' + ic('loader-circle', 'spin') + '&nbsp; Menghubungkan ke data Anda…</div>';
  const r = await api('auth.login', { idToken: Lis.idToken });
  if (r.success) return masuk(r.data);
  renderLogin('<div class="banner banner-fail small">' + ic('circle-x') + '<div class="t">' + esc(r.data && r.data.code === 'NOT_REGISTERED' ? 'Email Anda belum ditautkan oleh fisikawan medis.' : r.message) +
    (/kedaluwarsa|tidak valid/i.test(r.message) ? ' Silakan masuk lagi.' : '') + '</div></div>');
}

/* ---------------- Kerangka halaman mandiri ---------------- */
function halamanLisensi(judul, isi, opsi) {
  opsi = opsi || {};
  Lis.henti();
  window.__halLis = opsi.ulang || null;
  document.title = tr(judul) + ' — VeriRad';
  const s = Lis.sesi();
  $('#app').classList.remove('is-demo');
  $('#app').innerHTML = '<div class="lis-page"><header class="lis-top">' +
    '<div class="brand" style="padding:0;border:0"><div class="logo">' + logoVR() + '</div><div><b>Veri<em>Rad</em></b><span>Smart QC Radiologi</span></div></div>' +
    '<div class="sp"></div>' + tombolBahasa('lis-lang') +
    (s ? '<span class="small mono hide-sm lis-email">' + esc(s.email) + '</span>' : '') +
    (opsi.kembali ? '<button class="btn btn-sm btn-on-dark" id="lis-kembali">' + ic('arrow-left') + '<span>Kembali ke aplikasi</span></button>' :
      '<button class="btn btn-sm btn-on-dark" id="lis-keluar">' + ic('log-out') + '<span>Keluar</span></button>') +
    '</header><main class="lis-main' + (opsi.lebar ? ' lebar' : '') + '"' + (opsi.noI18n ? ' data-no-i18n' : '') + '>' + isi + '</main></div>';
  const k = $('#lis-keluar'); if (k) k.addEventListener('click', () => keluar(false));
  const kb = $('#lis-kembali'); if (kb) kb.addEventListener('click', () => {
    if (AppState.me) { history.replaceState(null, '', '#/dasbor'); renderShell(); rute(); }
    else { history.replaceState(null, '', location.pathname + location.search); if (Lis.data && Lis.sesi()) lanjutLis(Lis.data); else renderLogin(); }
  });
  window.scrollTo(0, 0);
}

/* ---------------- Berlangganan (belum ada / berakhir) ---------------- */
function kartuPaket(cfg, pilihan) {
  const ps = cfg.paket || [];
  const bulanan = ps.filter(p => p.bulan > 0).map(p => p.harga / p.bulan);
  const termahal = bulanan.length ? Math.max.apply(null, bulanan) : 0;
  return '<div class="paket-grid">' + ps.map(p => {
    const life = !p.bulan, perBln = p.bulan ? p.harga / p.bulan : 0;
    const hemat = p.bulan && termahal && perBln < termahal ? Math.round((1 - perBln / termahal) * 100) : 0;
    return '<div class="paket' + (life ? ' unggul' : '') + '">' + (life ? '<span class="pita">Paling hemat</span>' : hemat ? '<span class="pita pita-soft">Hemat ' + hemat + '%</span>' : '') +
      '<h3>' + esc(p.label) + '</h3><div class="harga">' + esc(rupiah(p.harga)) + '</div>' +
      '<div class="small muted">' + (life ? 'Sekali bayar, berlaku selamanya' : '≈ ' + esc(rupiah(Math.round(perBln / 100) * 100)) + ' per bulan') + '</div>' +
      '<button class="btn btn-block ' + (life ? 'btn-primary' : '') + '" data-paket="' + esc(p.kode) + '"' + (pilihan === p.kode ? ' aria-pressed="true"' : '') + '>Pilih ' + esc(p.label) + '</button></div>';
  }).join('') + '</div>' +
    '<ul class="paket-fitur">' + ['1 fisikawan medis', 'Maksimal ' + ((cfg.batas || {}).batas_rs || 3) + ' rumah sakit', 'Atasan/kepala instalasi tidak dibatasi', 'Semua fitur: input QC, grafik, foto, laporan PDF ke email',
      'Data QC tersimpan di Google Drive akun Anda sendiri'].map(x => '<li>' + ic('circle-check') + '<span>' + esc(x) + '</span></li>').join('') + '</ul>';
}
function kartuBayar(pes, bayar, email) {
  const pk = ((Lis._cfg || {}).paket || []).find(p => p.kode === pes.paket) || { label: pes.paket };
  const teksWa = 'Halo, saya sudah transfer ' + rupiah(pes.total) + ' untuk VeriRad paket ' + pk.label + '.\nEmail Google: ' + (email || pes.email) + '\nKode pesanan: ' + pes.pesanan_id;
  return '<div class="card bayar"><div class="card-h"><h2>' + ic('clock') + 'Menunggu pembayaran</h2><span class="mono small muted">' + esc(pes.pesanan_id) + '</span></div><div class="card-b stack">' +
    '<div class="hstack between"><span class="muted">Paket</span><b>' + esc(pk.label) + '</b></div>' +
    '<div class="total"><span class="muted small">Transfer tepat</span><div class="hstack" style="gap:10px;justify-content:center"><b class="mono">' + esc(rupiah(pes.total)) + '</b>' +
    '<button class="btn btn-sm" data-salin="' + esc(pes.total) + '">' + ic('copy') + 'Salin</button></div>' +
    '<span class="hint">3 digit terakhir (' + esc(pes.kode_unik) + ') adalah kode unik agar pembayaran Anda mudah dikenali.</span></div>' +
    '<div class="field"><span class="lbl">Ke rekening</span>' + ((bayar && bayar.rekening) || []).map(r => '<div class="rek"><span class="mono">' + esc(r) + '</span><button class="btn btn-sm btn-ghost" data-salin="' + esc((r.match(/\d[\d\s.-]{5,}\d/) || [r])[0].replace(/[\s.-]/g, '')) + '">' + ic('copy') + 'Salin no.</button></div>').join('') +
    ((bayar && bayar.rekening && bayar.rekening.length) ? '' : '<div class="small muted">Nomor rekening akan dikirim lewat WhatsApp.</div>') + '</div>' +
    '<ol class="langkah-bayar"><li>Transfer <b>tepat ' + esc(rupiah(pes.total)) + '</b> ke salah satu rekening di atas.</li><li>Kirim bukti transfer lewat WhatsApp.</li><li>Setelah dikonfirmasi (biasanya kurang dari 1×24 jam), klik <b>Periksa status</b>.</li></ol>' +
    (bayar && bayar.wa ? '<a class="btn btn-primary btn-block" target="_blank" rel="noopener" href="' + esc(tautanWa(bayar.wa, teksWa)) + '">' + ic('message-circle') + 'Kirim bukti via WhatsApp</a>' : '') +
    '</div></div>';
}
async function renderBeli(d) {
  const cfgR = await Lis.config(); const cfg = Lis._cfg || (d && d.konfig) || {};
  const p = d && d.pelanggan, pes = d && d.pesanan && d.pesanan[0];
  const habis = p && ['HABIS', 'NONAKTIF'].indexOf(p.status) > -1;
  halamanLisensi('Berlangganan',
    '<div class="page-h"><div><h1>' + (habis ? 'Perpanjang langganan VeriRad' : 'Berlangganan VeriRad') + '</h1><p>' +
    (p && p.status === 'NONAKTIF' ? 'Akun Anda dinonaktifkan. Hubungi penjual bila ini keliru.' :
      habis ? 'Langganan Anda berakhir ' + esc(tglIndo(p.berlaku_sampai)) + '. Pilih paket untuk melanjutkan.' :
        'Akun <b class="mono">' + esc((d && d.email) || '') + '</b> belum punya langganan. Pilih paket, transfer, lalu ' + (modeRelay() ? 'langsung pakai — tanpa pemasangan.' : 'pasang sekali saja.')) + '</p></div></div>' +
    (!cfgR.success && !cfg.paket ? '<div class="banner banner-fail">' + ic('circle-x') + '<div class="t">' + esc(cfgR.message) + '</div></div>' : '') +
    (pes ? kartuBayar(pes, cfg.bayar, d.email) + '<div class="hstack" style="justify-content:center;gap:8px;margin:4px 0 24px"><button class="btn btn-primary" id="cek-status">' + ic('refresh-cw') + 'Periksa status</button><button class="btn btn-ghost" id="ganti-paket">Ganti paket</button></div>' : '') +
    '<div id="pilih-paket"' + (pes ? ' class="hidden"' : '') + '>' + kartuPaket(cfg, pes && pes.paket) + '</div>' +
    '<div class="row r-1-1" style="margin-top:8px">' +
    '<div class="card card-b small"><b>' + ic('eye') + ' Anda atasan / kepala instalasi?</b><p class="muted" style="margin:6px 0 0">' + (modeRelay() ? 'Atasan tidak perlu berlangganan maupun masuk. Minta fisikawan medis Anda mengirim <b>tautan atasan</b> (Pengaturan → Pengguna → Tautan), lalu buka tautan itu.' :
      'Atasan tidak perlu berlangganan. Minta fisikawan medis Anda menambahkan email ini di VeriRad (Pengaturan → Tautkan atasan), lalu masuk lagi.') + '</p></div>' +
    '<div class="card card-b small"><b>' + ic('flask-conical') + ' Ingin mencoba dulu?</b><p class="muted" style="margin:6px 0 8px">Mode Demo memakai data contoh di browser ini, tanpa berlangganan.</p><button class="btn btn-sm" id="coba-demo">Buka Mode Demo</button></div></div>' +
    (d && d.admin ? '<div style="text-align:center;margin-top:16px"><a class="btn btn-ghost" href="#/admin">' + ic('shield-check') + 'Buka Admin Lisensi</a></div>' : ''), { ulang: () => renderBeli(d) });
  $$('[data-salin]').forEach(b => b.addEventListener('click', () => salinTeks(b.dataset.salin, b)));
  $('#coba-demo').addEventListener('click', () => mulaiDemo('FISMED'));
  const gp = $('#ganti-paket'); if (gp) gp.addEventListener('click', () => { $('#pilih-paket').classList.remove('hidden'); $('#pilih-paket').scrollIntoView({ behavior: 'smooth' }); });
  const cs = $('#cek-status'); if (cs) cs.addEventListener('click', async () => { setBusy(cs, true, 'Memeriksa…'); const r = await Lis.panggil('status'); setBusy(cs, false); if (!r.success) return gagalLis(r); if (r.data.pelanggan && ['AKTIF', 'TENGGANG'].indexOf(r.data.pelanggan.status) > -1) { toast('Pembayaran dikonfirmasi. Langganan aktif!', 'success'); return lanjutLis(Object.assign({}, Lis.data || {}, r.data)); } toast('Pembayaran belum dikonfirmasi. Coba lagi nanti.', 'info'); });
  $$('[data-paket]').forEach(b => b.addEventListener('click', () => modalPesan(b.dataset.paket, d)));
}
function gagalLis(r) { if (r.data && r.data.code === 'AUTH') { toast('Sesi berakhir, silakan masuk lagi.', 'warning'); Lis.lupa(); return renderLogin(); } toast(r.message, 'error'); }
function modalPesan(kode, d) {
  const pk = ((Lis._cfg || {}).paket || []).find(p => p.kode === kode) || {};
  modal({
    judul: 'Pesan paket ' + (pk.label || kode), ikon: 'receipt',
    isi: '<div class="stack"><div class="hstack between"><span class="muted">Harga</span><b class="mono">' + esc(rupiah(pk.harga)) + '</b></div>' +
      '<div class="field"><label for="ps-nama">Nama lengkap</label><input class="input" id="ps-nama" placeholder="mis. Andi Pratama, S.Si." value="' + esc((d && d.nama_google) || '') + '"></div>' +
      '<div class="field"><label for="ps-wa">Nomor WhatsApp</label><input class="input mono" id="ps-wa" inputmode="tel" placeholder="08…"><span class="hint">Untuk konfirmasi pembayaran dan bantuan pemasangan.</span></div>' +
      '<p class="hint" style="margin:0">Dengan memesan, Anda menyetujui <a href="privasi.html" target="_blank" rel="noopener">Kebijakan Privasi</a> VeriRad.</p>' +
      '<p class="small muted" style="margin:0">Setelah ini Anda mendapat nominal transfer (dengan kode unik) dan nomor rekening.</p></div>',
    tombol: [{ label: 'Batal' }, { label: 'Lanjut ke pembayaran', kelas: 'btn-primary', ikon: 'arrow-right', aksi: async (bg) => {
      const r = await Lis.panggil('pesan', { paket: kode, nama: $('#ps-nama', bg).value, wa: $('#ps-wa', bg).value });
      if (!r.success) { gagalLis(r); return false; }
      const s = await Lis.panggil('status');
      if (s.success) { Lis.simpan(Object.assign(s.data, { sesi: Lis.sesi().sesi })); renderBeli(s.data); }
    } }]
  });
}

/* ---------------- Pasang (langganan aktif, backend belum terpasang) ---------------- */
function renderPasang(d) {
  const p = d.pelanggan, cfg = d.konfig || {};
  const kode = d.kode_aktivasi || '';
  const tpl = cfg.template_url || '#';
  const EN = I18N.lang === 'en', L = (id, en) => EN ? en : id, em = '<b class="mono">' + esc(p.email) + '</b>';
  halamanLisensi('Pasang VeriRad',
    '<div class="page-h"><div data-no-i18n><h1>' + L('Pasang VeriRad <span class="muted" style="font-weight:500">— sekali saja</span>', 'Install VeriRad <span class="muted" style="font-weight:500">— one time only</span>') + '</h1>' +
    '<p>' + L('Langganan <b>' + esc(p.paket_label) + '</b> aktif' + (p.berlaku_sampai ? ' sampai ' + esc(tglIndo(p.berlaku_sampai)) : ' selamanya') + '. Ikuti 3 langkah ini di <b>laptop/PC dengan Chrome</b> (±10 menit). Data QC Anda akan tersimpan di Google Drive akun ' + em + '.',
      'Your <b>' + esc(tr(p.paket_label)) + '</b> subscription is active' + (p.berlaku_sampai ? ' until ' + esc(tr(tglIndo(p.berlaku_sampai))) : ' forever') + '. Follow these 3 steps on a <b>laptop/PC with Chrome</b> (about 10 minutes). Your QC data will be stored in the Google Drive of ' + em + '.') + '</p></div>' +
    '<div class="act"><a class="btn" href="panduan.html" target="_blank" rel="noopener">' + ic('file-text') + 'Panduan bergambar</a></div></div>' +
    '<div class="banner banner-info only-sm">' + ic('smartphone') + '<div class="t small">Pemasangan jauh lebih mudah dari laptop/PC. Setelah terpasang, VeriRad bisa dipakai penuh di HP.</div></div>' +
    '<div class="card kode-card"><div><span class="lbl">Kode aktivasi Anda</span><div class="kode mono" id="kode-akt" data-no-i18n>' + esc(kode || '— — — —') + '</div>' +
    '<span class="hint">Dipakai di langkah 3. Berlaku 48 jam.</span></div><div class="hstack" style="gap:8px"><button class="btn btn-primary" id="salin-kode"' + (kode ? '' : ' disabled') + '>' + ic('copy') + 'Salin kode</button>' +
    '<button class="btn btn-ghost btn-sm" id="kode-baru">' + ic('refresh-cw') + 'Kode baru</button></div></div>' +
    '<div class="pasang-langkah" data-no-i18n>' +
    langkahPasang(1, L('Salin VeriRad ke Google Drive Anda', 'Copy VeriRad to your Google Drive'), EN ? [
      'Make sure the browser is signed in with the Google account ' + em + ' (check the profile photo at the top right of Google).',
      'Click <b>Make a copy of VeriRad</b> below → on the Google page click the blue <b>Make a copy</b> button.',
      'A new spreadsheet named <b>Copy of VeriRad…</b> opens. Keep this tab open.'] : [
      'Pastikan browser masuk dengan akun Google ' + em + ' (lihat foto profil di pojok kanan atas Google).',
      'Klik tombol <b>Buat salinan VeriRad</b> di bawah → di halaman Google klik tombol biru <b>Buat salinan</b>.',
      'Spreadsheet baru bernama <b>Salinan VeriRad…</b> terbuka. Biarkan tab ini tetap terbuka.'],
      '<a class="btn btn-primary" target="_blank" rel="noopener" href="' + esc(tpl) + '" id="btn-salin-tpl">' + ic('copy') + L('Buat salinan VeriRad', 'Make a copy of VeriRad') + '</a>',
      mockSalin(EN)) +
    langkahPasang(2, L('Jalankan menu Aktifkan & beri izin', 'Run the Activate menu & grant permission'), EN ? [
      'In the copied spreadsheet, wait about 5 seconds until the <b>VeriRad</b> menu appears next to the Help menu.',
      'Click <b>VeriRad → ① Aktifkan VeriRad</b> → <b>Authorization required</b> → click <b>OK/Continue</b> → choose your account.',
      'See <b>"Google hasn\'t verified this app"</b>? That is normal because the script belongs to you: click <b>Advanced</b> → <b>Go to VeriRad (unsafe)</b> → <b>Allow</b>.',
      'Click <b>VeriRad → ① Aktifkan VeriRad</b> again. The <b>Aktifkan VeriRad</b> panel opens on the right.'] : [
      'Di spreadsheet salinan, tunggu ±5 detik sampai menu <b>VeriRad</b> muncul di sebelah menu Bantuan.',
      'Klik <b>VeriRad → ① Aktifkan VeriRad</b> → jendela <b>Otorisasi diperlukan</b> → klik <b>OK/Lanjutkan</b> → pilih akun Anda.',
      'Muncul <b>"Google belum memverifikasi aplikasi ini"</b>? Ini normal karena skripnya milik Anda sendiri: klik <b>Lanjutan</b> → <b>Buka VeriRad (tidak aman)</b> → <b>Izinkan</b>.',
      'Klik lagi <b>VeriRad → ① Aktifkan VeriRad</b>. Panel <b>Aktifkan VeriRad</b> muncul di kanan.'],
      '', mockMenu(EN)) +
    langkahPasang(3, L('Terapkan sebagai aplikasi web, lalu tempel', 'Deploy as a web app, then paste'), EN ? [
      'In the right-hand panel click <b>Buka editor Apps Script</b> (open the Apps Script editor).',
      'In the editor click the blue <b>Deploy → New deployment</b> → ⚙️ icon → <b>Web app</b>.',
      '<b>Execute as:</b> Me · <b>Who has access:</b> <u>Anyone</u> → <b>Deploy</b> (click <b>Authorize access</b> if asked).',
      'Click <b>Copy</b> under <b>Web app URL</b> (ends with <span class="mono">/exec</span>) → go back to the spreadsheet tab → paste it in the panel.',
      'Also paste the <b>activation code</b> above → click <b>Aktifkan VeriRad</b>.'] : [
      'Di panel kanan klik <b>Buka editor Apps Script</b>.',
      'Di editor klik tombol biru <b>Terapkan → Penerapan baru</b> → ikon ⚙️ → <b>Aplikasi web</b>.',
      '<b>Jalankan sebagai:</b> Saya · <b>Yang memiliki akses:</b> <u>Siapa saja</u> → <b>Terapkan</b> (klik <b>Izinkan akses</b> bila diminta).',
      'Klik <b>Salin</b> pada <b>URL aplikasi web</b> (berakhiran <span class="mono">/exec</span>) → kembali ke tab spreadsheet → tempel di panel.',
      'Tempel juga <b>kode aktivasi</b> di atas → klik <b>Aktifkan VeriRad</b>.'],
      '', mockTerapkan(EN)) +
    '</div>' +
    '<div class="card tunggu" id="tunggu"><div class="hstack" style="gap:12px">' + ic('loader-circle', 'spin') + '<div class="grow"><b>Menunggu aktivasi…</b><div class="small muted">Halaman ini lanjut otomatis begitu langkah 3 selesai.</div></div>' +
    '<button class="btn" id="cek-pasang">' + ic('refresh-cw') + 'Periksa sekarang</button></div></div>' +
    (d.admin ? '<div style="text-align:center;margin-top:16px"><a class="btn btn-ghost" href="#/admin">' + ic('shield-check') + 'Buka Admin Lisensi</a></div>' : ''), { ulang: () => renderPasang(Object.assign({}, d, { kode_aktivasi: $('#kode-akt') ? $('#kode-akt').textContent : d.kode_aktivasi })) });
  const sk = $('#salin-kode'); sk.addEventListener('click', () => salinTeks($('#kode-akt').textContent, sk));
  $('#kode-baru').addEventListener('click', async e => {
    setBusy(e.currentTarget, true, ''); const r = await Lis.panggil('kode'); setBusy(e.currentTarget, false);
    if (!r.success) return gagalLis(r);
    $('#kode-akt').textContent = r.data.kode_aktivasi; sk.disabled = false; toast('Kode aktivasi baru dibuat. Kode lama tidak berlaku.', 'info');
  });
  if (tpl === '#') $('#btn-salin-tpl').addEventListener('click', e => { e.preventDefault(); toast('Penjual belum mengisi TEMPLATE_URL di server lisensi.', 'error'); });
  const cek = async (diam) => {
    const r = await Lis.panggil('status');
    if (!r.success) { if (!diam) gagalLis(r); return; }
    if (r.data.pelanggan && r.data.pelanggan.terpasang) { Lis.henti(); toast('VeriRad berhasil diaktifkan!', 'success'); Lis.simpan(Object.assign(r.data, { sesi: Lis.sesi().sesi })); return masukBackend(r.data.pelanggan.backend_url); }
    if (!diam) toast('Belum aktif. Selesaikan langkah 3 di panel spreadsheet.', 'info');
  };
  $('#cek-pasang').addEventListener('click', e => { cek(false); });
  Lis._poll = setInterval(() => { if (document.visibilityState === 'visible') cek(true); }, 8000);
}
function langkahPasang(n, judul, butir, tombol, gambar) {
  return '<section class="card langkah"><div class="langkah-h"><span class="no">' + n + '</span><h2>' + esc(judul) + '</h2></div><div class="langkah-b">' +
    '<div><ol>' + butir.map(b => '<li>' + b + '</li>').join('') + '</ol>' + (tombol ? '<div style="margin-top:12px">' + tombol + '</div>' : '') + '</div>' +
    (gambar ? '<div class="mock" aria-hidden="true">' + gambar + '</div>' : '') + '</div></section>';
}
/* Ilustrasi skematis (bukan tangkapan layar asli) */
function mockSalin(EN) {
  return '<div class="mk-win"><div class="mk-bar"><i></i><i></i><i></i></div><div class="mk-dlg"><b>' + (EN ? 'Copy document' : 'Salin dokumen') + '</b><span>' + (EN ? 'Would you like to make a copy of <u>VeriRad (Template)</u>?' : 'Apakah Anda ingin membuat salinan <u>VeriRad (Template)</u>?') + '</span>' +
    '<small>' + (EN ? 'The attached Apps Script file will also be copied.' : 'File Apps Script yang terlampir juga akan disalin.') + '</small><div class="mk-btns"><span class="mk-b mk-p">' + (EN ? 'Make a copy' : 'Buat salinan') + '</span></div></div></div>';
}
function mockMenu(EN) {
  return '<div class="mk-win"><div class="mk-bar"><i></i><i></i><i></i></div><div class="mk-menu">' + (EN ? '<span>File</span><span>Edit</span><span>View</span><span>…</span><span>Help</span>' : '<span>File</span><span>Edit</span><span>Lihat</span><span>…</span><span>Bantuan</span>') + '<span class="mk-on">VeriRad</span></div>' +
    '<div class="mk-drop"><span class="mk-sel">① Aktifkan VeriRad</span><span>Perbarui backend</span><span>Status &amp; bantuan</span></div>' +
    '<div class="mk-warn"><b>' + (EN ? 'Google hasn’t verified this app' : 'Google belum memverifikasi aplikasi ini') + '</b><span class="mk-link">' + (EN ? 'Advanced' : 'Lanjutan') + '</span><span class="mk-link">' + (EN ? 'Go to VeriRad (unsafe)' : 'Buka VeriRad (tidak aman)') + '</span></div></div>';
}
function mockTerapkan(EN) {
  const T = EN ? ['Deploy ▾', 'New deployment', 'Select type', 'Web app', 'Execute as', 'Me', 'Who has access', 'Anyone', 'Copy'] : ['Terapkan ▾', 'Penerapan baru', 'Pilih jenis', 'Aplikasi web', 'Jalankan sebagai', 'Saya', 'Yang memiliki akses', 'Siapa saja', 'Salin'];
  return '<div class="mk-win"><div class="mk-bar"><i></i><i></i><i></i><span class="mk-b mk-p" style="margin-left:auto">' + T[0] + '</span></div><div class="mk-dlg"><b>' + T[1] + '</b>' +
    '<span class="mk-row"><small>' + T[2] + '</small> ⚙️ ' + T[3] + '</span><span class="mk-row"><small>' + T[4] + '</small> ' + T[5] + '</span><span class="mk-row"><small>' + T[6] + '</small> <u>' + T[7] + '</u></span>' +
    '<div class="mk-url">https://script.google.com/macros/s/AKfy…/exec <span class="mk-b">' + T[8] + '</span></div></div></div>';
}

/* ---------------- Atasan dari beberapa fisikawan medis ---------------- */
function renderPilihBackend(d) {
  halamanLisensi('Pilih data',
    '<div class="page-h"><div><h1>Pilih data yang ingin dibuka</h1><p>Email Anda ditautkan oleh lebih dari satu fisikawan medis.</p></div></div>' +
    '<div class="stack">' + d.atasan.map((a, i) => '<button class="card card-b pilih-be" data-i="' + i + '"><div class="hstack between"><div style="text-align:left"><b>' + esc(a.nama_fismed) + '</b>' +
      '<div class="small muted mono">' + esc(a.email_fismed) + '</div></div>' + ic('arrow-right') + '</div></button>').join('') + '</div>', { ulang: () => renderPilihBackend(d) });
  $$('[data-i]').forEach(b => b.addEventListener('click', () => masukBackend(d.atasan[Number(b.dataset.i)].backend_url)));
}

/* ---------------- Di dalam aplikasi: banner & kartu Langganan ---------------- */
function bannerLisensi() {
  const box = $('#lis-banner'); if (!box) return;
  const L = AppState.lisensi;
  if (!L || !fismed() || AppState.demo) { box.innerHTML = ''; return; }
  let kls = '', ikon = 'info', teks = '', tombol = '<button class="btn btn-sm btn-primary" data-perpanjang>' + ic('receipt') + 'Perpanjang</button>';
  if (!L.boleh_tulis) { kls = 'banner-fail'; ikon = 'lock'; teks = '<b>Mode baca saja.</b> ' + esc(L.pesan || 'Langganan tidak aktif.'); }
  else if (L.status === 'TENGGANG') { kls = 'banner-warn'; ikon = 'clock'; teks = '<b>Langganan lewat jatuh tempo.</b> Masa tenggang sampai ' + esc(tglIndo(L.tenggang_sampai)) + '.'; }
  else if (L.status === 'AKTIF' && L.sisa_hari !== null && L.sisa_hari !== undefined && L.sisa_hari <= 14) { kls = 'banner-info'; ikon = 'calendar-days'; teks = 'Langganan berakhir dalam <b>' + L.sisa_hari + ' hari</b> (' + esc(tglIndo(L.berlaku_sampai)) + ').'; }
  else if (L.versi_terbaru && vrBandingVersi(L.versi_terbaru, L.versi_backend) > 0) { kls = 'banner-info'; ikon = 'cloud-upload'; teks = 'Pembaruan backend <b>v' + esc(L.versi_terbaru) + '</b> tersedia.'; tombol = '<button class="btn btn-sm" data-cara-perbarui>Cara memperbarui</button>'; }
  if (['BELUM_AKTIF', 'TIDAK_SAH'].indexOf(L.status) > -1) tombol = '<a class="btn btn-sm" href="panduan.html#aktivasi" target="_blank" rel="noopener">Panduan aktivasi</a>';
  if (L.status === 'NONAKTIF') tombol = '';
  box.innerHTML = teks ? '<div class="banner ' + kls + '">' + ic(ikon) + '<div class="t small">' + teks + '</div>' + tombol + '</div>' : '';
  const pp = $('[data-perpanjang]', box); if (pp) pp.addEventListener('click', () => modalPerpanjang());
  const cp = $('[data-cara-perbarui]', box); if (cp) cp.addEventListener('click', () => modalCaraPerbarui());
}
function vrBandingVersi(a, b) {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}
function batasRs() { return (AppState.lisensi && Number(AppState.lisensi.batas_rs)) || 3; }
function rsPenuh() { return fismed() && AppState.rs.length >= batasRs(); }

function kartuLangganan() {
  const L = AppState.lisensi || {};
  const life = L.paket === 'LIFE';
  const update = L.versi_terbaru && vrBandingVersi(L.versi_terbaru, L.versi_backend) > 0;
  return '<div class="card"><div class="card-h"><h2>' + ic('receipt') + 'Langganan</h2>' + badgeLis(L.status || 'BELUM_AKTIF') + '</div><div class="card-b"><div class="lang-grid">' +
    '<div><span class="lbl">Paket</span><b>' + esc(L.paket_label || (AppState.demo ? '6 bulan (demo)' : '—')) + '</b></div>' +
    '<div><span class="lbl">Berlaku sampai</span><b>' + (life ? 'Selamanya' : esc(tglIndo(L.berlaku_sampai) || '—')) + '</b>' +
    (!life && L.sisa_hari !== null && L.sisa_hari !== undefined ? '<span class="small muted">' + (L.sisa_hari >= 0 ? 'sisa ' + L.sisa_hari + ' hari' : 'lewat ' + (-L.sisa_hari) + ' hari') + '</span>' : '') + '</div>' +
    '<div><span class="lbl">Rumah sakit</span><b class="mono">' + AppState.rs.length + ' / ' + batasRs() + '</b><span class="small muted">batas paket</span></div>' +
    '<div><span class="lbl">Fisikawan medis</span><b class="mono">1 / ' + esc(L.batas_fismed || 1) + '</b><span class="small muted">atasan tidak dibatasi</span></div>' +
    (modeRelay() && !AppState.demo ? '<div><span class="lbl">Penyimpanan data</span><b>Google Drive Anda</b><span class="small muted">folder VeriRad</span></div></div>' :
      '<div><span class="lbl">Versi backend</span><b class="mono">' + esc(L.versi_backend || VR_VERSI) + '</b>' + (update ? '<span class="small" style="color:var(--orange-text)">v' + esc(L.versi_terbaru) + ' tersedia</span>' : '') + '</div></div>') +
    (L.pesan ? '<div class="banner ' + (L.boleh_tulis === false ? 'banner-fail' : 'banner-warn') + ' small" style="margin-top:12px">' + ic('info') + '<div class="t">' + esc(L.pesan) + '</div></div>' : '') +
    '</div><div class="card-f" style="justify-content:flex-start;flex-wrap:wrap">' +
    (life ? '' : '<button class="btn btn-primary" data-perpanjang>' + ic('receipt') + 'Perpanjang / ganti paket</button>') +
    '<button class="btn" id="lis-segar">' + ic('refresh-cw') + 'Periksa status</button>' +
    (update ? '<button class="btn" data-cara-perbarui>' + ic('cloud-upload') + 'Cara memperbarui</button>' : '') +
    (L.spreadsheet_url ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + esc(L.spreadsheet_url) + '">' + ic('table-2') + 'Buka spreadsheet data</a>' : '') +
    (L.folder_url ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + esc(L.folder_url) + '">' + ic('folder-open') + 'Buka folder Drive</a>' : '') +
    ((Lis.sesi() || {}).admin ? '<a class="btn btn-ghost" href="#/admin">' + ic('shield-check') + 'Admin Lisensi</a>' : '') + '</div></div>';
}
function pasangKartuLangganan(el) {
  $$('[data-perpanjang]', el).forEach(b => b.addEventListener('click', () => modalPerpanjang()));
  $$('[data-cara-perbarui]', el).forEach(b => b.addEventListener('click', () => modalCaraPerbarui()));
  const s = $('#lis-segar', el);
  if (s) s.addEventListener('click', async () => {
    setBusy(s, true, 'Memeriksa…');
    const r = await api('lisensi.segarkan', {});
    setBusy(s, false);
    if (!r.success) return toast(r.message, 'error');
    AppState.lisensi = r.data; toast('Status: ' + (STATUS_LIS[r.data.status] || [r.data.status])[0], r.data.boleh_tulis ? 'success' : 'warning');
    renderShell(); rute();
  });
}
async function modalPerpanjang() {
  if (AppState.demo) return toast('Di Mode Demo tidak ada pembayaran sungguhan.', 'info');
  const cfgR = await Lis.config(); const cfg = Lis._cfg;
  if (!cfg) return toast(cfgR.message || 'Server lisensi tidak bisa dihubungi.', 'error');
  const m = modal({
    judul: 'Perpanjang langganan', ikon: 'receipt', lebar: true,
    isi: '<div id="pp-isi"><p class="small muted" style="margin-top:0">Masa aktif baru ditambahkan setelah tanggal berakhir saat ini, jadi tidak ada hari yang hilang.</p>' + kartuPaket(cfg) + '</div>'
  });
  $$('[data-paket]', m).forEach(b => b.addEventListener('click', async () => {
    setBusy(b, true, 'Membuat pesanan…');
    const r = await api('lisensi.pesan', { paket: b.dataset.paket });
    setBusy(b, false);
    if (!r.success) return toast(r.message, 'error');
    $('#pp-isi', m).innerHTML = kartuBayar(r.data.pesanan, r.data.bayar, AppState.me.email) +
      '<p class="small muted" style="text-align:center">Setelah dikonfirmasi, buka Pengaturan → Langganan → <b>Periksa status</b>.</p>';
    $$('[data-salin]', m).forEach(x => x.addEventListener('click', () => salinTeks(x.dataset.salin, x)));
  }));
}
function modalCaraPerbarui() {
  const L = AppState.lisensi || {};
  modal({
    judul: 'Memperbarui backend', ikon: 'cloud-upload',
    isi: '<ol class="stack" style="padding-left:18px;margin:0"><li>Buka <b>spreadsheet data VeriRad</b> Anda di laptop' + (L.spreadsheet_url ? ' (<a href="' + esc(L.spreadsheet_url) + '" target="_blank" rel="noopener">buka</a>)' : '') + '.</li>' +
      '<li>Klik menu <b>VeriRad → Perbarui backend</b> → OK.</li>' +
      '<li>Pertama kali, Anda diminta menyalakan <b>Google Apps Script API</b> di <a href="https://script.google.com/home/usersettings" target="_blank" rel="noopener">script.google.com/home/usersettings</a>, lalu ulangi langkah 2.</li>' +
      '<li>Muat ulang VeriRad di browser/HP.</li></ol><p class="small muted">Data Anda tidak berubah saat memperbarui.</p>',
    tombol: [{ label: 'Tutup', kelas: 'btn-primary' }]
  });
}
let _modalLisensiTerbuka = false;
window.onLisensiDitolak = function (res) {
  window.__lisMsg = { m: res.message, t: Date.now() };
  if (_modalLisensiTerbuka || !fismed()) return;
  _modalLisensiTerbuka = true;
  modal({
    judul: 'Mode baca saja', ikon: 'lock', onClose: () => { _modalLisensiTerbuka = false; },
    isi: '<p style="margin-top:0">' + esc(res.message) + '</p><p class="small muted" style="margin-bottom:0">Semua data tetap aman dan bisa dilihat, diekspor CSV, dan laporan lama bisa diunduh.</p>',
    tombol: [{ label: 'Tutup' }].concat(['HABIS', 'TENGGANG'].indexOf((AppState.lisensi || {}).status) > -1 || (res.data && res.data.lisensi && res.data.lisensi.status === 'HABIS') ?
      [{ label: 'Perpanjang', kelas: 'btn-primary', ikon: 'receipt', aksi: () => { setTimeout(modalPerpanjang, 50); } }] : [])
  });
};

/* =====================================================================
 * ADMIN LISENSI (khusus email di ADMIN_EMAILS server lisensi)
 * ===================================================================== */
const ADM = { tab: 'pesanan', cari: '', filter: '', data: null };
async function renderAdmin() {
  if (!modeLisensi() && !modeRelay()) { halamanLisensi('Admin Lisensi', kosong('Mode lisensi belum aktif', 'Isi RELAY_URL di js/config.js.'), { kembali: true }); return; }
  const s = Lis.sesi();
  if (!s) {
    halamanLisensi('Admin Lisensi', '<div class="card card-b" style="max-width:420px;margin:40px auto;text-align:center"><h2>Masuk sebagai admin</h2><p class="muted">Sesi admin berakhir. Masuk dengan akun Google admin.</p>' +
      '<div id="gbtn" class="gbtn-wrap"></div><div id="login-msg"></div></div>', { kembali: true });
    window.__setelahMasukLisensi = d => { window.__setelahMasukLisensi = null; Lis.simpan(d); renderAdmin(); };
    if (modeRelay()) {
      $('#gbtn').innerHTML = '<button class="btn btn-primary btn-block" id="btn-masuk-g">' + ic('log-in') + 'Masuk dengan Google</button>';
      $('#btn-masuk-g').addEventListener('click', e => masukRelay(e.currentTarget, 'select_account'));
    } else pasangGoogle();
    return;
  }
  if (!s.admin) { halamanLisensi('Admin Lisensi', kosong('Khusus admin', 'Akun ' + s.email + ' bukan admin lisensi.'), { kembali: true }); return; }
  halamanLisensi('Admin Lisensi', '<div class="boot-load" style="min-height:40vh">' + ic('loader-circle', 'spin') + '&nbsp; Memuat data pelanggan…</div>', { kembali: true, lebar: true, noI18n: true, ulang: () => renderAdmin() });
  const r = await Lis.panggil('admin.data');
  if (!r.success) { if (r.data && r.data.code === 'AUTH') { Lis.lupa(); return renderAdmin(); } $('.lis-main').innerHTML = '<div class="banner banner-fail">' + ic('circle-x') + '<div class="t">' + esc(r.message) + '</div></div>'; return; }
  ADM.data = r.data; Lis._cfg = r.data.konfig;
  gambarAdmin();
}
function gambarAdmin() {
  const d = ADM.data, rg = d.ringkasan;
  const main = $('.lis-main');
  main.innerHTML = '<div class="page-h"><div><h1>Admin Lisensi</h1><p>' + (d.rilis ? 'Pesanan, pelanggan, pembayaran via rekening, dan rilis backend.' : 'Pesanan, pelanggan, dan pembayaran via rekening. Data QC pelanggan tetap di Google Drive mereka.') + '</p></div>' +
    '<div class="act"><button class="btn" id="adm-segar">' + ic('refresh-cw') + 'Muat ulang</button><button class="btn btn-primary" id="adm-tambah">' + ic('user-plus') + 'Tambah / aktifkan manual</button></div></div>' +
    (d.belum_diisi.length ? '<div class="banner banner-warn">' + ic('triangle-alert') + '<div class="t small"><b>Script Properties server lisensi belum lengkap:</b> ' + esc(d.belum_diisi.join(', ')) + '</div></div>' : '') +
    '<div class="row r-kpi">' +
    kpi('Pelanggan aktif', rg.aktif + rg.tenggang, '', 'users', rg.lifetime + ' lifetime · ' + rg.tenggang + ' tenggang') +
    kpi('Akan habis ≤14 hari', rg.akan_habis, '', 'calendar-days', rg.habis + ' sudah berakhir', rg.akan_habis ? 'is-warn' : '') +
    kpi('Menunggu bayar', rg.menunggu, '', 'clock', 'pesanan terbuka', rg.menunggu ? 'is-warn' : '') +
    kpi('Pendapatan bulan ini', rupiah(rg.pendapatan_bulan), '', 'receipt', 'total ' + esc(rupiah(rg.pendapatan_total))) + '</div>' +
    '<div class="tabs" role="tablist">' + [['pesanan', 'Pesanan', rg.menunggu], ['pelanggan', 'Pelanggan', rg.total], ['bayar', 'Pembayaran', d.pembayaran.length]].concat(d.rilis ? [['rilis', 'Rilis backend', d.rilis.length]] : [])
      .map(t => '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (ADM.tab === t[0]) + '">' + t[1] + ' <span class="cnt">' + t[2] + '</span></button>').join('') + '</div>' +
    '<div id="adm-isi" class="stack"></div>';
  $('#adm-segar').addEventListener('click', () => renderAdmin());
  $('#adm-tambah').addEventListener('click', () => modalAdmAktifkan(null));
  $$('[data-tab]', main).forEach(b => b.addEventListener('click', () => { ADM.tab = b.dataset.tab; gambarAdmin(); }));
  if (ADM.tab === 'rilis' && !d.rilis) ADM.tab = 'pesanan';
  ({ pesanan: tabPesanan, pelanggan: tabPelanggan, bayar: tabBayar, rilis: tabRilis })[ADM.tab]($('#adm-isi'));
}
async function admAksi(aksi, data, btn) {
  if (btn) setBusy(btn, true, '');
  const r = await Lis.panggil(aksi, data);
  if (btn) setBusy(btn, false);
  if (!r.success) { toast(r.message, 'error'); return null; }
  toast(r.message || 'Tersimpan.', 'success');
  await renderAdmin();
  return r;
}
function paketLabel(k) { return (((Lis._cfg || {}).paket || []).find(p => p.kode === k) || { label: k }).label; }
function tabPesanan(box) {
  const d = ADM.data, tunggu = d.pesanan.filter(x => x.status === 'MENUNGGU'), lain = d.pesanan.filter(x => x.status !== 'MENUNGGU').slice(0, 40);
  box.innerHTML = (tunggu.length ? '<div class="adm-pesanan">' + tunggu.map(x => '<div class="card"><div class="card-b stack" style="gap:8px">' +
    '<div class="hstack between"><b class="mono">' + esc(x.pesanan_id) + '</b><span class="small muted">' + esc(waktuRelatif(x.dibuat)) + '</span></div>' +
    '<div><b>' + esc(x.nama || '—') + '</b><div class="mono small">' + esc(x.email) + '</div>' + (x.wa ? '<a class="small" target="_blank" rel="noopener" href="' + esc(tautanWa(x.wa, 'Halo ' + (x.nama || '') + ', terkait pesanan VeriRad ' + x.pesanan_id)) + '">' + ic('message-circle') + ' ' + esc(x.wa) + '</a>' : '') + '</div>' +
    '<div class="hstack between"><span>' + esc(paketLabel(x.paket)) + '</span><b class="mono" style="font-size:18px">' + esc(rupiah(x.total)) + '</b></div>' +
    '<div class="hstack" style="gap:8px;flex-wrap:nowrap"><button class="btn btn-primary" style="flex:1" data-konfirmasi="' + esc(x.pesanan_id) + '">' + ic('circle-check') + 'Konfirmasi lunas</button><button class="btn btn-ghost" data-batal="' + esc(x.pesanan_id) + '">Batalkan</button></div>' +
    '</div></div>').join('') + '</div>' : '<div class="card">' + kosong('Tidak ada pesanan menunggu', 'Pesanan baru dari calon pelanggan muncul di sini.') + '</div>') +
    (lain.length ? '<div class="card"><div class="card-h"><h2>Riwayat pesanan</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pesanan</th><th>Email</th><th>Paket</th><th class="c">Total</th><th class="c">Status</th><th>Waktu</th></tr></thead><tbody>' +
      lain.map(x => '<tr><td class="m">' + esc(x.pesanan_id) + '</td><td class="m">' + esc(x.email) + '</td><td>' + esc(paketLabel(x.paket)) + '</td><td class="num">' + esc(rupiah(x.total)) + '</td><td class="c">' +
        '<span class="badge b-' + ({ LUNAS: 'lulus', BATAL: 'na', DIGANTI: 'na' }[x.status] || 'belum') + '">' + esc(x.status) + '</span></td><td class="small">' + esc(jamTgl(x.dikonfirmasi || x.dibuat)) + '</td></tr>').join('') + '</tbody></table></div></div>' : '');
  $$('[data-konfirmasi]', box).forEach(b => b.addEventListener('click', async () => {
    const x = d.pesanan.find(p => p.pesanan_id === b.dataset.konfirmasi);
    if (await konfirmasi('Konfirmasi pembayaran?', 'Pastikan dana ' + rupiah(x.total) + ' dari ' + x.email + ' sudah masuk ke rekening. Langganan ' + paketLabel(x.paket) + ' langsung aktif dan pelanggan menerima email.', 'Ya, sudah masuk'))
      admAksi('admin.konfirmasi', { pesanan_id: x.pesanan_id }, b);
  }));
  $$('[data-batal]', box).forEach(b => b.addEventListener('click', async () => { if (await konfirmasi('Batalkan pesanan?', 'Pesanan ' + b.dataset.batal + ' dibatalkan.', 'Batalkan', true)) admAksi('admin.batalPesanan', { pesanan_id: b.dataset.batal }, b); }));
}
function tabPelanggan(box) {
  const d = ADM.data;
  const v3 = !d.rilis;
  const F = [['', 'Semua'], ['AKTIF', 'Aktif'], ['TENGGANG', 'Tenggang'], ['HABIS', 'Berakhir'], ['LIFE', 'Lifetime'], ['BELUMPASANG', v3 ? 'Belum pernah masuk' : 'Belum pasang'], ['NONAKTIF', 'Nonaktif']];
  box.innerHTML = '<div class="card card-b"><div class="filters" style="align-items:flex-end"><div class="field" style="flex:1;min-width:220px"><label for="adm-cari">Cari</label><input class="input" id="adm-cari" placeholder="email, nama, WA…" value="' + esc(ADM.cari) + '"></div>' +
    '<div class="hstack">' + F.map(f => '<button class="chip" data-f="' + f[0] + '" aria-pressed="' + (ADM.filter === f[0]) + '">' + f[1] + '</button>').join('') + '</div></div></div>' +
    '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pelanggan</th><th>Paket</th><th class="c">Status</th><th>Berlaku</th><th>' + (v3 ? 'Pemakaian' : 'Backend') + '</th><th></th></tr></thead><tbody id="adm-tb"></tbody></table></div></div>';
  const isi = () => {
    const q = ADM.cari.toLowerCase();
    const rows = d.pelanggan.filter(p => (!q || [p.email, p.nama, p.wa, p.catatan].join(' ').toLowerCase().indexOf(q) > -1) &&
      (!ADM.filter || (ADM.filter === 'LIFE' ? p.paket === 'LIFE' : ADM.filter === 'BELUMPASANG' ? (v3 ? !p.terakhir_masuk : !p.terpasang) : p.status === ADM.filter)))
      .sort((a, b) => (a.berlaku_sampai || '9999') < (b.berlaku_sampai || '9999') ? -1 : 1);
    $('#adm-tb', box).innerHTML = rows.map(p => '<tr><td><b>' + esc(p.nama || '—') + '</b><span class="sub mono">' + esc(p.email) + '</span>' + (p.wa ? '<a class="sub" target="_blank" rel="noopener" href="' + esc(tautanWa(p.wa, 'Halo ' + (p.nama || ''))) + '">WA ' + esc(p.wa) + '</a>' : '') + (p.catatan ? '<span class="sub">' + esc(p.catatan) + '</span>' : '') + '</td>' +
      '<td>' + esc(p.paket_label) + '</td><td class="c">' + badgeLis(p.status) + '</td>' +
      '<td class="small">' + (p.paket === 'LIFE' ? 'Selamanya' : esc(tglIndo(p.berlaku_sampai)) + (p.sisa_hari !== null ? '<span class="sub">' + (p.sisa_hari >= 0 ? 'sisa ' + p.sisa_hari + ' hr' : 'lewat ' + (-p.sisa_hari) + ' hr') + '</span>' : '')) + '</td>' +
      '<td class="small">' + (v3 ? (p.terakhir_masuk ? '<span class="mono">RS ' + esc(p.jumlah_rs || 0) + '/' + p.batas_rs + '</span>' + (p.app_versi ? '<span class="sub mono">v' + esc(p.app_versi) + '</span>' : '') + '<span class="sub">masuk ' + esc(waktuRelatif(p.terakhir_masuk)) + '</span>' : '<span class="badge b-belum">Belum pernah masuk</span>') : p.terpasang ? '<span class="badge b-lulus">Terpasang</span><span class="sub mono">v' + esc(p.backend_versi || '?') + ' · RS ' + esc(p.jumlah_rs || 0) + '/' + p.batas_rs + '</span><span class="sub">cek ' + esc(waktuRelatif(p.terakhir_cek)) + '</span>' : '<span class="badge b-belum">Belum pasang</span>') + '</td>' +
      '<td><div class="hstack" style="flex-wrap:nowrap;gap:4px"><button class="btn btn-sm btn-primary" data-pp="' + esc(p.email) + '"' + (p.paket === 'LIFE' ? ' disabled' : '') + '>Perpanjang</button>' +
      '<button class="btn btn-sm btn-ghost btn-icon" data-menu="' + esc(p.email) + '" aria-label="Lainnya">' + ic('settings') + '</button></div></td></tr>').join('') ||
      '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Tidak ada pelanggan yang cocok.</td></tr>';
    $$('[data-pp]', box).forEach(b => b.addEventListener('click', () => modalAdmAktifkan(d.pelanggan.find(p => p.email === b.dataset.pp))));
    $$('[data-menu]', box).forEach(b => b.addEventListener('click', () => modalAdmPelanggan(d.pelanggan.find(p => p.email === b.dataset.menu))));
  };
  isi();
  $('#adm-cari', box).addEventListener('input', debounce(e => { ADM.cari = e.target.value; isi(); }, 200));
  $$('[data-f]', box).forEach(b => b.addEventListener('click', () => { ADM.filter = b.dataset.f; tabPelanggan(box); }));
}
function modalAdmAktifkan(p) {
  const ps = (Lis._cfg || {}).paket || [];
  modal({
    judul: p ? 'Perpanjang ' + p.email : 'Tambah / aktifkan pelanggan', ikon: 'user-plus',
    isi: '<div class="stack"><div class="field"><label for="aa-email">Email Google pelanggan <span class="req">*</span></label><input class="input mono" id="aa-email" value="' + esc(p ? p.email : '') + '"' + (p ? ' readonly' : '') + ' placeholder="nama@gmail.com"></div>' +
      '<div class="grid-2"><div class="field"><label for="aa-nama">Nama</label><input class="input" id="aa-nama" value="' + esc(p ? p.nama : '') + '"></div><div class="field"><label for="aa-wa">WhatsApp</label><input class="input mono" id="aa-wa" value="' + esc(p ? p.wa : '') + '"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="aa-paket">Paket</label><select class="input" id="aa-paket">' + ps.map(x => '<option value="' + x.kode + '" data-h="' + x.harga + '">' + esc(x.label + ' — ' + rupiah(x.harga)) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="aa-nom">Nominal diterima (Rp)</label><input class="input mono" id="aa-nom" inputmode="numeric" value="' + (ps[0] ? ps[0].harga : '') + '"><span class="hint">Isi 0 untuk gratis/promosi.</span></div></div>' +
      '<div class="field"><label for="aa-cat">Catatan</label><input class="input" id="aa-cat" placeholder="mis. transfer BCA 12/11"></div>' +
      (p && p.berlaku_sampai ? '<p class="small muted" style="margin:0">Masa aktif ditambahkan setelah ' + esc(tglIndo(p.berlaku_sampai)) + ' (atau dari hari ini bila sudah lewat).</p>' : '') + '</div>',
    tombol: [{ label: 'Batal' }, { label: 'Aktifkan', kelas: 'btn-primary', ikon: 'circle-check', aksi: async (bg) => {
      const email = $('#aa-email', bg).value.trim().toLowerCase();
      if (!emailOk(email)) { toast('Email tidak valid.', 'warning'); return false; }
      const r = await admAksi('admin.aktifkan', { email, nama: $('#aa-nama', bg).value, wa: $('#aa-wa', bg).value, paket: $('#aa-paket', bg).value, nominal: Number($('#aa-nom', bg).value.replace(/[^\d]/g, '')) || 0, catatan: $('#aa-cat', bg).value });
      return !!r;
    } }]
  });
  const sel = $('#aa-paket'); sel.addEventListener('change', () => { $('#aa-nom').value = sel.selectedOptions[0].dataset.h; });
}
function modalAdmPelanggan(p) {
  const m = modal({
    judul: p.email, ikon: 'user',
    isi: '<div class="stack"><div class="grid-2"><div class="field"><label for="ap-nama">Nama</label><input class="input" id="ap-nama" value="' + esc(p.nama) + '"></div><div class="field"><label for="ap-wa">WhatsApp</label><input class="input mono" id="ap-wa" value="' + esc(p.wa) + '"></div></div>' +
      (p.paket !== 'LIFE' ? '<div class="field"><label for="ap-tgl">Berlaku sampai (koreksi manual)</label><input class="input mono" type="date" id="ap-tgl" value="' + esc(p.berlaku_sampai) + '"></div>' : '') +
      '<div class="field"><label for="ap-cat">Catatan</label><input class="input" id="ap-cat" value="' + esc(p.catatan || '') + '"></div>' +
      '<div class="divider">tindakan lain</div><div class="stack" style="gap:8px">' +
      '<button class="btn btn-block" id="ap-email">' + ic('mail') + 'Kirim ulang email aktivasi</button>' +
      (p.terpasang ? '<button class="btn btn-block" id="ap-reset">' + ic('rotate-ccw') + 'Lepas sambungan backend (pasang ulang)</button>' : '') +
      '<button class="btn btn-block ' + (p.status === 'NONAKTIF' ? '' : 'btn-danger') + '" id="ap-non">' + ic(p.status === 'NONAKTIF' ? 'circle-check' : 'lock') + (p.status === 'NONAKTIF' ? 'Aktifkan kembali akun' : 'Nonaktifkan akun') + '</button></div>' +
      '<p class="hint" style="margin:0">Menonaktifkan membuat aplikasi pelanggan menjadi baca saja. Data pelanggan tetap di Drive mereka.</p></div>',
    tombol: [{ label: 'Tutup' }, { label: 'Simpan', kelas: 'btn-primary', ikon: 'save', aksi: async (bg) => {
      const data = { email: p.email, nama: $('#ap-nama', bg).value, wa: $('#ap-wa', bg).value, catatan: $('#ap-cat', bg).value };
      const t = $('#ap-tgl', bg); if (t && t.value && t.value !== p.berlaku_sampai) data.berlaku_sampai = t.value;
      return !!(await admAksi('admin.ubah', data));
    } }]
  });
  $('#ap-email', m).addEventListener('click', e => admAksi('admin.kirimEmail', { email: p.email }, e.currentTarget));
  const rs = $('#ap-reset', m);
  if (rs) rs.addEventListener('click', async () => { if (await konfirmasi('Lepas sambungan backend?', 'Pelanggan harus memasang/aktivasi ulang dari halaman Pasang. Data di Drive mereka tidak terhapus.', 'Lepas', true)) { m.close(); admAksi('admin.resetBackend', { email: p.email }); } });
  $('#ap-non', m).addEventListener('click', async () => {
    const non = p.status !== 'NONAKTIF';
    if (await konfirmasi(non ? 'Nonaktifkan akun?' : 'Aktifkan kembali?', non ? 'Aplikasi ' + p.email + ' menjadi baca saja dalam ±5 menit.' : 'Akun kembali mengikuti masa berlaku paketnya.', non ? 'Nonaktifkan' : 'Aktifkan', non)) { m.close(); admAksi('admin.nonaktif', { email: p.email, nonaktif: non }); }
  });
}
function tabBayar(box) {
  const b = ADM.data.pembayaran;
  box.innerHTML = '<div class="card"><div class="card-h"><h2>' + ic('receipt') + 'Pembayaran tercatat</h2><button class="btn btn-sm" id="adm-csv">' + ic('download') + 'Ekspor CSV</button></div>' +
    (b.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Email</th><th>Paket</th><th class="c">Nominal</th><th>Berlaku</th><th>Catatan</th></tr></thead><tbody>' +
      b.map(x => '<tr><td class="small">' + esc(jamTgl(x.waktu)) + '</td><td class="m">' + esc(x.email) + '</td><td>' + esc(paketLabel(x.paket)) + '</td><td class="num">' + esc(rupiah(x.nominal)) + '</td>' +
        '<td class="small mono">' + esc((x.berlaku_sebelum || '—') + ' → ' + x.berlaku_sesudah) + '</td><td class="small">' + esc(x.catatan || x.pesanan_id) + '</td></tr>').join('') + '</tbody></table></div>' : kosong('Belum ada pembayaran', 'Pembayaran tercatat saat pesanan dikonfirmasi atau pelanggan diaktifkan manual.')) + '</div>';
  $('#adm-csv', box).addEventListener('click', () => unduhCsv('VeriRad_pembayaran.csv', [['Waktu', 'Email', 'Paket', 'Nominal', 'Berlaku sebelum', 'Berlaku sesudah', 'Pesanan', 'Admin', 'Catatan']]
    .concat(b.map(x => [x.waktu, x.email, x.paket, x.nominal, x.berlaku_sebelum, x.berlaku_sesudah, x.pesanan_id, x.admin, x.catatan]))));
}
function tabRilis(box) {
  const r = ADM.data.rilis.slice().sort((a, b) => vrBandingVersi(b.versi, a.versi));
  box.innerHTML = '<div class="row r-1-1"><div class="card"><div class="card-h"><h2>' + ic('cloud-upload') + 'Unggah rilis backend</h2></div><div class="card-b stack">' +
    '<p class="small muted" style="margin:0">Pilih berkas <span class="mono">verirad-rilis-x.y.z.json</span> (dibuat oleh <span class="mono">tools/build-rilis.js</span>). Pelanggan lalu melihat tombol pembaruan dan memperbarui lewat menu <b>VeriRad → Perbarui backend</b>.</p>' +
    '<label class="btn">' + ic('upload') + 'Pilih berkas rilis<input type="file" class="sr-only" id="rl-file" accept=".json,application/json"></label><div id="rl-info" class="small"></div>' +
    '<div class="field"><label for="rl-cat">Catatan rilis (tampil ke pelanggan)</label><input class="input" id="rl-cat" placeholder="mis. Perbaikan laporan PDF"></div>' +
    '<button class="btn btn-primary" id="rl-kirim" disabled>' + ic('cloud-upload') + 'Terbitkan rilis</button></div></div>' +
    '<div class="card"><div class="card-h"><h2>Daftar rilis</h2></div>' + (r.length ? '<div class="list">' + r.map((x, i) => '<div class="list-item"><div class="grow"><b class="mono">v' + esc(x.versi) + '</b>' + (i === 0 ? ' <span class="badge b-lulus">terbaru</span>' : '') +
      '<div class="small muted">' + esc(x.catatan || '') + '</div></div><span class="tm">' + esc(jamTgl(x.dibuat)) + '</span></div>').join('') + '</div>' : kosong('Belum ada rilis', 'Pelanggan memakai versi template saat mereka memasang.')) + '</div></div>';
  let berkas = null;
  $('#rl-file', box).addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j.versi || !Array.isArray(j.files)) throw new Error('Bukan berkas rilis VeriRad.');
      berkas = j; $('#rl-info', box).innerHTML = '<span class="badge b-info">v' + esc(j.versi) + '</span> ' + esc(j.files.map(x => x.name + (x.type === 'JSON' ? '.json' : '.gs')).join(', '));
      $('#rl-kirim', box).disabled = false;
    } catch (er) { berkas = null; $('#rl-info', box).innerHTML = '<span style="color:var(--fail)">' + esc(er.message) + '</span>'; $('#rl-kirim', box).disabled = true; }
  });
  $('#rl-kirim', box).addEventListener('click', e => { if (berkas) admAksi('admin.rilis', { versi: berkas.versi, catatan: $('#rl-cat', box).value, files: berkas.files }, e.currentTarget); });
}
