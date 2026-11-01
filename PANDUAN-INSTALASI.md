# Panduan Instalasi VeriRad

**Smart QC for Safer Radiology** · versi 1.0.0

VeriRad terdiri dari tiga bagian. Pasang berurutan:

| Urutan | Bagian | Hasil yang dicatat |
|---|---|---|
| A | **Backend**: Google Apps Script (database Sheets + Drive) | URL Web App `…/exec` |
| B | **Frontend**: situs GitHub Pages | Alamat situs `https://USERNAME.github.io/NAMA-REPO/` |
| C | **Login Google**: OAuth Client ID di Google Cloud | Client ID `….apps.googleusercontent.com` |
| D | Sambungkan, lalu uji | Bisa masuk dan membuat laporan PDF |

Waktu yang dibutuhkan: sekitar 45–60 menit untuk pertama kali.

> **Ingin melihat aplikasinya dulu?** Buka `index.html` dari folder frontend, atau situs GitHub Pages dengan akhiran `?demo`, lalu pilih **Mode Demo**. Data contohnya fiktif dan hanya tersimpan di browser.

---

## A. Backend: Google Apps Script

Gunakan akun Gmail yang akan menjadi **pemilik data** (akun fisikawan medis). Semua spreadsheet, berkas, dan email laporan berasal dari akun ini.

1. Buka <https://script.google.com>, klik **Proyek baru**, lalu ganti nama proyek menjadi `VeriRad`.
2. Klik **⚙️ Setelan proyek**, lalu:
   - centang **Tampilkan file manifes "appsscript.json" di editor**;
   - pastikan **Zona waktu** = `(GMT+07:00) Jakarta`.
3. Kembali ke **Editor** (ikon `< >`). Buat berkas berikut, lalu tempel isinya dari berkas yang Anda terima:

   | Berkas di editor | Tempel isi dari | Cara membuat |
   |---|---|---|
   | `appsscript.json` | `appsscript.json` | Sudah ada; ganti seluruh isinya |
   | `Kode.gs` | `Kode.gs` | Ganti nama `Code.gs` menjadi `Kode`, lalu ganti isinya |
   | `Bersama.gs` | `Bersama.gs` | **＋ → Skrip**, beri nama `Bersama` |
   | `Laporan.gs` | `Laporan.gs` | **＋ → Skrip**, beri nama `Laporan` |
   | `Setup.gs` | `Setup.gs` | **＋ → Skrip**, beri nama `Setup` |

   Klik **💾 Simpan** (Ctrl+S).
4. Buka `Setup.gs`. Pada menu fungsi di bilah atas, pilih **`setupAppEnvironment`**, lalu klik **▶ Jalankan**.
   - Akan muncul permintaan izin. Klik **Tinjau izin**, pilih akun Anda, lalu klik **Lanjutan → Buka VeriRad (tidak aman)** dan **Izinkan**. Peringatan ini wajar karena skrip dibuat sendiri dan belum diverifikasi Google.
   - Pastikan **Log eksekusi** menampilkan `✅ Setup selesai`, alamat database, dan folder Drive.
   - Fungsi ini aman dijalankan ulang: data dan rahasia yang sudah ada tidak ditimpa.
5. Pilih fungsi **`ujiMesinPenilaian`**, lalu **▶ Jalankan**. Log harus menampilkan **`4/4 lulus`**. Ini membuktikan hasil hitung server sama dengan laporan Desember 2024 Anda, termasuk pembulatan 424,95 → 425,0.
6. Klik **Terapkan → Penerapan baru**:
   - jenis: **Aplikasi web**;
   - **Jalankan sebagai: Saya**;
   - **Siapa yang memiliki akses: Siapa saja**.

   Klik **Terapkan**, lalu **salin URL Aplikasi web** yang berakhiran `/exec`.

> **Mengapa "Siapa saja"?** Frontend di GitHub Pages memanggil API ini tanpa cookie Google. Keamanan tetap terjaga: setiap permintaan wajib membawa token login yang diverifikasi server, dan hanya email yang terdaftar di sheet `Pengguna` yang bisa masuk.

---

## B. Frontend: GitHub Pages

1. Ekstrak `verirad-frontend.zip`. Folder hasil ekstraksi **langsung berisi** `index.html`, `css/`, dan `js/`. **Folder inilah yang nanti di-`git init`**, bukan folder di atasnya.
2. Buka `js/config.js` dengan Notepad, lalu ganti URL-nya dengan URL `/exec` dari langkah A6:
   ```js
   window.APP_CONFIG = {
     GAS_URL: 'https://script.google.com/macros/s/ID_DEPLOYMENT_ANDA/exec'
   };
   ```
3. Unggah folder itu ke GitHub Pages lewat terminal (`git init` → `git add .` → `git commit` → `git push`). Saya pandu langkah demi langkah di percakapan. Repository harus **Public**, dan di **Settings → Pages** pilih **main / (root)** serta centang **Enforce HTTPS**.
4. Catat alamat situsnya, misalnya `https://USERNAME.github.io/verirad/`.

Jangan unggah lewat tombol "Upload files" di web GitHub, karena struktur folder `css/` dan `js/` akan rusak.

---

## C. Login Google: OAuth Client ID

Client ID bukan rahasia. Fungsinya hanya memberi tahu Google bahwa tombol "Masuk dengan Google" di situs Anda sah.

1. Buka <https://console.cloud.google.com>, lalu buat project baru bernama `VeriRad`.
2. Buka menu **Google Auth Platform** (di versi lama: *APIs & Services → OAuth consent screen*) dan klik **Mulai**:
   - Nama aplikasi `VeriRad`, email dukungan Anda;
   - Audiens **Eksternal**;
   - email kontak Anda. Lalu klik **Buat**.
3. Buka **Audiens**, lalu klik **Publikasikan aplikasi** (status *Dalam produksi*). Dengan begitu atasan dengan Gmail apa pun bisa masuk. VeriRad hanya meminta nama dan email, jadi tidak perlu proses verifikasi Google.
   *Alternatif:* biarkan status *Pengujian* dan tambahkan setiap email pengguna sebagai **Pengguna uji**.
4. Buka **Klien → Buat klien**:
   - Jenis aplikasi: **Aplikasi web**;
   - **Asal JavaScript yang diizinkan**: `https://USERNAME.github.io`. Tulis tanpa garis miring di akhir dan **tanpa** nama repo.
   - (opsional, untuk uji di komputer) `http://localhost:8000`.

   Klik **Buat**, lalu **salin Client ID**.
5. Kembali ke Apps Script, lalu buka **⚙️ Setelan proyek → Properti skrip → Tambahkan properti skrip**:
   - Properti: `GOOGLE_CLIENT_ID`
   - Nilai: Client ID tadi

   Klik **Simpan**. Tidak perlu deploy ulang.
6. Jalankan fungsi **`cekKonfigurasi`**. Semua baris harus bertanda ✅.

---

## D. Sambungkan & uji

1. Buka alamat situs, lalu klik **Masuk dengan Google** memakai akun pemilik skrip. Akun ini otomatis terdaftar sebagai Fisikawan Medis.
2. Baca dan setujui pernyataan tanggung jawab toleransi.
3. Lakukan urutan berikut:
   1. **Pengaturan**: isi nama & gelar, nomor izin, dan kota, lalu unggah tanda tangan (PNG transparan).
   2. **Kelola RS & Alat**: tambah 2–3 RS (logo, alamat, penandatangan "Mengetahui", email atasan), lalu tambah alatnya.
   3. **Template Toleransi**: periksa setiap batas. Butir bertanda **⚠** masih menunggu keputusan Anda (lihat bagian H).
   4. **Input QC**: isi satu alat sampai **Simpan hasil QC (final)**.
   5. **Laporan**: klik **Unduh PDF**, lalu periksa hasilnya (ukuran kertas, logo, tanda tangan, tabel). Setelah itu coba **Kirim ke atasan** ke email Anda sendiri dulu.
4. **Menautkan atasan:** buka **Pengaturan → Tautkan atasan**, isi Gmail atasan, centang RS-nya, lalu kirim alamat situs kepadanya. Atasan hanya melihat dasbor, riwayat, dan laporan RS yang dicentang.

---

## E. Memperbarui aplikasi

| Yang diubah | Cara |
|---|---|
| Kode backend (`.gs`) | Tempel kode baru, lalu **Terapkan → Kelola penerapan → ✏️ Edit → Versi: Versi baru → Terapkan**. URL `/exec` tetap sama. **Jangan** membuat "Penerapan baru", karena URL akan berubah dan frontend berhenti bekerja. |
| Frontend | Di folder frontend: `git add .` → `git commit -m "update"` → `git push`. Tunggu 1–2 menit, lalu tekan Ctrl+Shift+R. |
| `Bersama.gs` / `js/bersama.js` | Kedua berkas **harus identik**. Bila mengubah satu, salin ke yang lain. |
| Aplikasi terpasang (PWA) | Setelah `git push`, aplikasi di HP otomatis memakai versi baru saat dibuka dengan internet. Bila menambah/mengganti nama berkas JS/CSS, naikkan `VERSI` di `sw.js`. |
| Toleransi & parameter | Tidak perlu ubah kode. Cukup lewat menu **Template Toleransi** (tersimpan sebagai versi baru). |

---

## F. Keamanan & rahasia

| Nilai | Disimpan di | Diisi oleh |
|---|---|---|
| `SESSION_SECRET` (penanda tangan token login) | Script Properties | Otomatis oleh `setupAppEnvironment()` |
| `SPREADSHEET_ID`, `ROOT_FOLDER_ID`, `FOLDER_RS_ID`, `FOLDER_TTD_ID` | Script Properties | Otomatis |
| `GOOGLE_CLIENT_ID` | Script Properties | Anda (langkah C5) |
| URL `/exec` | `js/config.js` | Anda (langkah B2). Bukan rahasia. |

- **Jangan membagikan** spreadsheet database atau folder Drive VeriRad, dan **jangan menambah editor** proyek Apps Script. Editor bisa melihat Script Properties.
- Bila perangkat hilang: buka **Pengaturan → Keluar dari semua perangkat**.
- Untuk mengeluarkan semua pengguna sekaligus: jalankan **`rotasiSecretSesi`** di editor.
- Pengguna yang dinonaktifkan atau dihapus langsung kehilangan akses, termasuk sesi yang sedang aktif.

---

## G. Mengatasi masalah

| Gejala | Penyebab & solusi |
|---|---|
| Layar login: "Konfigurasi belum lengkap" | `GAS_URL` di `js/config.js` masih `GANTI_…`. Isi, lalu push ulang. |
| "Server tidak bisa dihubungi" / "bukan JSON" | URL `/exec` salah, atau akses penerapan bukan **Siapa saja**. |
| "GOOGLE_CLIENT_ID belum diisi" | Kerjakan langkah C5. |
| Tombol Google muncul, tetapi popup menolak (`origin_mismatch`) | Asal JavaScript di Google Cloud harus persis `https://USERNAME.github.io`. |
| "Email … belum terdaftar" | Tambahkan email itu di **Pengaturan → Pengguna**. Pemilik skrip terdaftar otomatis saat setup. |
| Atasan tidak bisa masuk (status aplikasi *Pengujian*) | Publikasikan aplikasi (C3) atau tambahkan email atasan sebagai pengguna uji. |
| Email laporan gagal | Kuota Gmail biasa ±100 penerima/hari. Lihat sisanya lewat `cekKonfigurasi`. PDF tetap tersimpan di Drive dan bisa **Kirim ulang**. |
| Perubahan kode tidak berpengaruh | Anda lupa membuat **Versi baru** di Kelola penerapan (bagian E). |
| Situs masih tampil versi lama | Cache browser. Tekan Ctrl+Shift+R. |

---

## H. Keputusan yang masih terbuka (dari Lampiran B PRD)

Semua butir ini diatur di menu **Template Toleransi** dan tidak perlu mengubah kode:

1. **Panoramik:** kolimasi panjang ≥ 149 mm, padahal laporan Des 2024 menulis 142 mm sebagai Lulus.
2. **CT geometri:** nominal 50 mm diasumsikan (`GEO_DEV = GEO_UKUR - 50`).
3. **CT keseragaman noise:** rumus bawaan `SD maks − SD min`. Bila acuan Anda membagi √2, tambahkan `/ sqrt(2)`.
4. **CT keseragaman pusat–tepi:** rumus bawaan = selisih terbesar pusat vs tepi; batas 2 HU (tabel lain memakai 4 HU).
5. **Acuan batas kolimasi, ketegaklurusan, dan posisi meja:** pilih satu acuan, lalu sesuaikan.
6. **Iluminasi:** "≥ 100" (bawaan, tipe *Minimum*) atau "> 100" (ganti ke tipe *Lebih dari*).

---

## I. Yang perlu Anda uji di server asli

Mesin penilaian, alur data, dan hak akses sudah diuji otomatis (81 kasus) dengan simulasi layanan Google. Tiga hal berikut hanya bisa dipastikan di akun Google Anda:

- **Tampilan PDF dari konverter Google**: ukuran halaman A4, logo, dan tanda tangan. Konverter HTML→PDF Google tidak mendukung semua CSS. Bila ada yang bergeser, kirim tangkapan layarnya.
- **Email dengan lampiran**: masuk ke kotak masuk dan bukan ke folder spam.
- **Login Google** dari situs GitHub Pages Anda.
