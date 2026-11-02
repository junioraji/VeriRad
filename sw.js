/* =====================================================================
 * VeriRad — Service worker (PWA)
 * - Berkas aplikasi (HTML/CSS/JS/ikon) disimpan agar bisa dibuka tanpa sinyal.
 * - Strategi "jaringan dulu": selalu ambil versi terbaru dari server; bila
 *   offline atau lambat (> 4 dtk), pakai salinan tersimpan.
 * - Panggilan API Google Apps Script & login Google TIDAK pernah disimpan.
 * Naikkan VERSI bila daftar berkas berubah.
 * ===================================================================== */
const VERSI = 'verirad-v2.0.0';
const CACHE_APP = VERSI + '-app', CACHE_FONT = 'verirad-font';
const ASET = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/config.js', 'js/icons.js', 'js/bersama.js', 'js/core.js', 'js/editor-foto.js', 'js/pwa.js', 'js/i18n.js', 'js/i18n-en.js', 'js/demo.js',
  'js/hal-dasbor.js', 'js/hal-input.js', 'js/hal-riwayat.js', 'js/hal-laporan.js', 'js/hal-kelola.js', 'js/hal-template.js', 'js/hal-pengaturan.js', 'js/lisensi.js', 'js/app.js', 'panduan.html',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_APP).then(c => Promise.all(ASET.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('verirad-v') && !k.startsWith(VERSI)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function jaringanDulu(req, kunci) {
  return caches.open(CACHE_APP).then(cache => {
    const dariJaringan = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(kunci || req, res.clone());
      return res;
    });
    const cadangan = () => cache.match(kunci || req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? cache.match('index.html') : null));
    const batas = new Promise(res => setTimeout(res, 4000)).then(() => cadangan());
    return Promise.race([dariJaringan.catch(() => cadangan()), batas.then(r => r || dariJaringan)])
      .then(r => r || dariJaringan)
      .catch(() => cadangan().then(r => r || new Response('Offline', { status: 503, statusText: 'Offline' })));
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                                  // POST API → langsung ke jaringan
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') return e.respondWith(jaringanDulu(req, 'index.html'));
    return e.respondWith(jaringanDulu(req));
  }
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {   // font: simpan sekali, pakai ulang
    e.respondWith(caches.open(CACHE_FONT).then(c => c.match(req).then(r => r || fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
  }
  // lainnya (script.google.com, accounts.google.com, dll.) tidak disentuh
});
