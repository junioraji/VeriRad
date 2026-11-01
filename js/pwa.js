/* =====================================================================
 * VeriRad — PWA: daftarkan service worker & tombol "Pasang aplikasi"
 * Android/Chrome/Edge: memakai dialog pasang bawaan browser.
 * iPhone/iPad (Safari): menampilkan petunjuk "Bagikan → Tambah ke Layar Utama".
 * ===================================================================== */
'use strict';

const PWA = {
  prompt: null,
  standalone: (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true,
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  bisa() { return !this.standalone && (!!this.prompt || this.ios); }
};

if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(e => console.warn('[PWA] service worker gagal:', e && e.message)); });
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); PWA.prompt = e; perbaruiTombolPasang(); });
window.addEventListener('appinstalled', () => { PWA.prompt = null; PWA.standalone = true; perbaruiTombolPasang(); toast('VeriRad terpasang di perangkat Anda.', 'success'); });

function tombolPasang(kelas) {
  return '<button type="button" class="' + (kelas || 'btn btn-block') + '" data-pasang' + (PWA.bisa() ? '' : ' hidden') + '>' + ic('download') + '<span>Pasang aplikasi</span></button>';
}
function perbaruiTombolPasang() { $$('[data-pasang]').forEach(b => { b.hidden = !PWA.bisa(); }); }
async function pasangAplikasi() {
  if (PWA.prompt) {
    const p = PWA.prompt; PWA.prompt = null;
    p.prompt();
    try { await p.userChoice; } catch (e) { }
    perbaruiTombolPasang();
    return;
  }
  modal({
    judul: 'Pasang VeriRad di iPhone / iPad', ikon: 'smartphone',
    isi: '<ol class="pasang-ios"><li>Buka VeriRad di <b>Safari</b>.</li>' +
      '<li>Ketuk tombol <b>Bagikan</b> ' + ic('share') + ' di bilah bawah (iPhone) atau atas (iPad).</li>' +
      '<li>Pilih <b>Tambah ke Layar Utama</b> ' + ic('square-plus') + '.</li>' +
      '<li>Ketuk <b>Tambah</b>. Ikon VeriRad muncul di layar utama dan terbuka layar penuh seperti aplikasi.</li></ol>' +
      '<p class="hint" style="margin:12px 0 0">Setelah terpasang, masuk sekali lagi dengan akun Google di aplikasi tersebut.</p>',
    tombol: [{ label: 'Mengerti', kelas: 'btn-primary' }]
  });
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-pasang]'); if (b) pasangAplikasi(); });
