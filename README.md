# VeriRad — Smart QC for Safer Radiology

Aplikasi web QC bulanan alat radiologi untuk fisikawan medis yang memegang beberapa rumah sakit.

- **Frontend:** HTML/CSS/JS murni (tanpa framework), di-host di GitHub Pages.
- **Backend:** Google Apps Script sebagai REST API (berkas `.gs` terpisah, tidak ada di repo ini). Database di Google Sheets, berkas di Google Drive, email lewat Gmail.
- **Login:** Google Sign-In. Token diverifikasi di server, lalu dibuatkan token sesi HMAC 12 jam. Peran: Fisikawan Medis (penuh) dan Atasan (lihat saja, per RS).

## Struktur

```
index.html
manifest.webmanifest ← identitas aplikasi PWA (nama, ikon, warna)
sw.js               ← service worker: aplikasi tetap terbuka saat sinyal hilang
icons/              ← ikon aplikasi (Android, iPhone, favicon)
css/style.css
js/config.js        ← isi URL /exec Web App di sini
js/bersama.js       ← mesin penilaian & laporan (identik dengan Bersama.gs di backend)
js/core.js          ← API, penyimpanan lokal, grafik, helper UI
js/app.js           ← login, shell, router, antrean offline
js/editor-foto.js    ← editor foto lampiran (putar, potong, coret, teks, cahaya)
js/pwa.js           ← daftar service worker & tombol "Pasang aplikasi"
js/i18n.js          ← penerjemah antarmuka Indonesia ⇄ English (tombol ID/EN)
js/i18n-en.js       ← kamus istilah antarmuka berbahasa Inggris
js/hal-*.js         ← halaman: dasbor, input, riwayat, laporan, kelola, template, pengaturan
js/demo.js          ← backend tiruan untuk Mode Demo
js/icons.js         ← subset ikon Lucide (ISC License)
```

Bahasa: tombol **ID / EN** di bilah atas dan halaman masuk. Pilihan tersimpan per browser. Laporan PDF punya pilihan bahasa sendiri di menu Laporan (berkas EN berakhiran `_EN.pdf`). Data yang Anda ketik (nama RS, ruangan, catatan) tidak diterjemahkan.

Pasang di HP: buka situs di Chrome (Android) lalu ketuk **Pasang aplikasi** di menu samping; di iPhone buka di Safari → Bagikan → **Tambah ke Layar Utama**. Bila daftar berkas JS/CSS berubah, naikkan `VERSI` di `sw.js`.

Mode Demo: buka situs dengan akhiran `?demo`.

Panduan lengkap ada di **PANDUAN-INSTALASI.md**.
