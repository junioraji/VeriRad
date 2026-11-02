# Panduan Penjual VeriRad v2.0 — Langganan

**Smart QC for Safer Radiology** · model *backend per pelanggan + server lisensi*

Panduan ini untuk **Anda sebagai penjual/admin**. Pelanggan cukup membaca halaman `panduan.html` (atau PDF *Panduan-Pemasangan-VeriRad.pdf*).

## Gambaran sistem

```
                 verirad-id.vercel.app  (satu frontend untuk semua)
                          │ login Google
                          ▼
              SERVER LISENSI  (Apps Script milik Anda)
              Sheet: Pelanggan · Pesanan · Pembayaran · Akses · Rilis
              ── tidak menyimpan data QC ──
                          │ "email ini aktif, backend-nya di sini"
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   Backend Fismed A  Backend Fismed B  Backend Fismed C
   (salinan TEMPLATE di Google Drive masing-masing pelanggan)
```

| Bagian | Isi | Dipasang oleh |
|---|---|---|
| **Server lisensi** | folder `lisensi/` (`Lisensi.gs`, `appsscript.json`) | Anda, sekali |
| **Template backend** | folder `backend/` (`Kode.gs`, `Bersama.gs`, `Laporan.gs`, `Setup.gs`, `Pasang.gs`, `appsscript.json`) di dalam sebuah Google Sheet | Anda, sekali; pelanggan menyalinnya |
| **Frontend** | `verirad-frontend.zip` → repo Vercel/GitHub | Anda |

Paket bawaan: **3 bulan Rp70.000 · 6 bulan Rp100.000 · Lifetime Rp150.000**. Batas per langganan: **1 fisikawan medis, maksimal 3 rumah sakit**, atasan tidak dibatasi. Masa tenggang setelah jatuh tempo **7 hari**, lalu aplikasi pelanggan menjadi **baca saja**. Datanya tidak pernah dihapus.

Waktu pemasangan pertama: ±60 menit.

---

## Langkah 1 — Server lisensi

1. Buka <https://script.google.com> dengan akun Google **penjual** → **Proyek baru**. Beri nama `VeriRad Lisensi`.
2. Hapus isi `Kode.gs`, lalu tempel seluruh isi **`lisensi/Lisensi.gs`**. (Nama berkas di editor boleh tetap `Kode.gs`.)
3. Buka **⚙️ Setelan proyek** → centang **Tampilkan file manifes "appsscript.json" di editor**. Kembali ke editor → buka `appsscript.json` → ganti isinya dengan **`lisensi/appsscript.json`** → **Simpan** (Ctrl+S).
4. Pilih fungsi **`setupLisensi`** di bilah atas → **Jalankan** → izinkan akses (Lanjutan → Buka … (tidak aman) → Izinkan). Fungsi ini membuat:
   - spreadsheet *VeriRad Lisensi — Database Pelanggan*;
   - folder rilis di Drive;
   - pemicu pengingat harian jam 07.00.
5. **⚙️ Setelan proyek → Properti skrip → Edit properti skrip**, tambahkan:

   | Properti | Contoh nilai | Keterangan |
   |---|---|---|
   | `GOOGLE_CLIENT_ID` | `1234…apps.googleusercontent.com` | **Sama persis** dengan Client ID yang dipakai frontend sekarang |
   | `ADMIN_EMAILS` | `emailanda@gmail.com` | Boleh beberapa, pisahkan koma. Email ini bisa membuka **Admin Lisensi** |
   | `INFO_REKENING` | `BCA 1234567890 a.n. Yanuar A. S. \| BRI 0987654321 a.n. Yanuar A. S.` | Beberapa rekening dipisah ` \| ` |
   | `KONTAK_WA` | `6281234567890` | Nomor WA Anda, format 62… tanpa + |
   | `FRONTEND_URL` | `https://verirad-id.vercel.app` | Tanpa garis miring di akhir |
   | `TEMPLATE_URL` | *(diisi di Langkah 2)* | Tautan `/copy` template |

6. **Terapkan → Penerapan baru** → ⚙️ **Aplikasi web**:
   - **Jalankan sebagai: Saya**;
   - **Yang memiliki akses: Siapa saja**.

   Klik **Terapkan**, lalu salin URL `/exec`. Ini **`LISENSI_URL`**.

> Spreadsheet *Database Pelanggan* hanya untuk Anda. Jangan dibagikan. Anda boleh melihatnya, tetapi **ubah data lewat halaman Admin Lisensi**, bukan langsung di sheet.

---

## Langkah 2 — Template backend (yang disalin pelanggan)

1. Buat **Google Sheet baru** dengan akun penjual, beri nama **`VeriRad (Template)`**.
2. **Ekstensi → Apps Script**. Di editor:
   1. Ganti isi `Kode.gs` dengan **`backend/Kode.gs`**.
   2. Klik **＋ → Skrip** untuk membuat berkas `Bersama`, `Laporan`, `Setup`, `Pasang`, lalu tempel isinya masing-masing dari folder `backend/`.
   3. **⚙️ Setelan proyek** → tampilkan `appsscript.json`, lalu ganti isinya dengan **`backend/appsscript.json`**.
3. Di **`Pasang.gs`** baris paling atas, ganti `VR_LISENSI_URL` dengan **LISENSI_URL** dari Langkah 1:
   ```js
   const VR_LISENSI_URL = 'https://script.google.com/macros/s/ID_SERVER_LISENSI/exec';
   ```
   **Simpan** (Ctrl+S).
4. Pilih fungsi **`siapkanTemplate`** → **Jalankan** → izinkan. Template mendapat lembar **MULAI DI SINI** berisi petunjuk, dan properti skrip dibersihkan.
   **Jangan** menjalankan *Aktifkan VeriRad* di template, dan **jangan** membuat penerapan web app dari template.
5. Kembali ke Sheet → **Bagikan** → *Akses umum*: **Siapa saja yang memiliki link → Pelihat** → **Salin link**.
6. Ubah akhir tautan dari `/edit?usp=sharing` menjadi **`/copy`**, contohnya `https://docs.google.com/spreadsheets/d/1AbC…xyz/copy`. Isikan sebagai `TEMPLATE_URL` di properti skrip server lisensi.

Pelanggan **tidak bisa** mengubah template Anda; mereka hanya mendapat salinan milik mereka sendiri.

---

## Langkah 3 — Frontend

1. Ekstrak `verirad-frontend.zip` ke folder repo Anda, **kecuali `js/config.js`**. Berkas baru: `js/lisensi.js` dan `panduan.html`.
2. Buka **`js/config.js` milik Anda** dan tambahkan baris `LISENSI_URL`:
   ```js
   window.APP_CONFIG = {
     LISENSI_URL: 'https://script.google.com/macros/s/ID_SERVER_LISENSI/exec',
     GAS_URL: ''   // kosongkan; backend tiap pelanggan ditemukan otomatis
   };
   ```
3. `git add .` → `git commit -m "v2.0 langganan"` → `git push`. Tunggu Vercel selesai, lalu tekan Ctrl+Shift+R.
4. Di Google Cloud → **Google Auth Platform → Klien**, pastikan **Asal JavaScript yang diizinkan** berisi `https://verirad-id.vercel.app`. Client ID-nya sama dengan `GOOGLE_CLIENT_ID` di server lisensi.

---

## Langkah 4 — Pindahkan instalasi lama Anda (data yang sudah ada)

Backend lama Anda kini juga harus terdaftar ke server lisensi. Daftarkan diri Anda sendiri sebagai pelanggan **Lifetime** dengan nominal 0.

1. Buka **verirad-id.vercel.app/#/admin**, lalu masuk dengan email admin. Klik **Tambah / aktifkan manual**:
   - email = akun Google pemilik backend lama;
   - paket **Lifetime**;
   - nominal **0**;
   - catatan "milik sendiri".
2. Di **proyek Apps Script lama**, ganti/tambahkan berkas `Kode.gs`, `Bersama.gs`, `Laporan.gs`, `Setup.gs`, **`Pasang.gs`** (baru), dan `appsscript.json`, lalu isi `VR_LISENSI_URL`. **Simpan.**
3. **Terapkan → Kelola penerapan → ✏️ → Versi: Versi baru → Terapkan.** URL `/exec` tetap sama. Langkah ini wajib **sebelum** aktivasi, karena server lisensi memeriksa web app Anda.
4. Buka **verirad-id.vercel.app**, lalu masuk dengan akun pemilik backend. Muncul halaman **Pasang VeriRad**; **salin kode aktivasinya**.
5. Di proyek lama, buka **⚙️ Setelan proyek → Properti skrip** dan tambahkan:
   - `AKTIVASI_KODE` = kode tadi;
   - `WEBAPP_URL` = URL `/exec` lama Anda.
6. Pilih fungsi **`aktifkanLewatEditor`** → **Jalankan** → izinkan akses baru. Log harus menampilkan **✅ VeriRad aktif untuk …**.
7. Kembali ke tab aplikasi, lalu klik **Periksa sekarang**. Anda masuk ke dasbor dengan data lama utuh.

> Bila backend lama Anda adalah skrip *terikat spreadsheet*, Anda juga bisa memakai menu **VeriRad → ① Aktifkan VeriRad** dari spreadsheet itu, alih-alih langkah 5–6.

---

## Langkah 5 — Uji sebagai pembeli

Pakai **akun Gmail kedua** di jendela penyamaran:

1. Buka situs, masuk, pilih paket, lalu catat nominal unik. Anda menerima email *"Pesanan baru VeriRad"*.
2. Di **Admin Lisensi → Pesanan**, klik **Konfirmasi lunas**. Akun kedua menerima email *"Langganan VeriRad Anda aktif"*.
3. Dengan akun kedua, ikuti halaman **Pasang** sampai selesai. Masukkan 1 RS, 1 alat, dan isi QC, lalu kirim laporan ke email Anda.
4. Tautkan akun ketiga sebagai **atasan**, lalu masuk dengan akun itu. Pastikan hanya menu **Dasbor** dan **Riwayat & Tren** yang muncul.
5. Di Admin, buka **Ubah** → ganti **Berlaku sampai** ke tanggal lampau. Dalam ±5 menit (atau setelah klik *Periksa status*), aplikasi akun kedua menjadi **baca saja**. Kembalikan tanggalnya setelah selesai.

---

## Operasional harian — Admin Lisensi

Buka lewat menu **Admin Lisensi** di sidebar (khusus email di `ADMIN_EMAILS`) atau langsung **`/#/admin`**. Halaman ini nyaman dibuka dari HP.

| Tugas | Caranya |
|---|---|
| **Pesanan masuk** | Email *Pesanan baru* masuk ke Anda. Cocokkan nominal unik (mis. Rp100.137) dengan mutasi rekening, lalu klik **Konfirmasi lunas**. Pelanggan otomatis aktif dan menerima email. |
| **Pembayaran di luar sistem** | **Tambah / aktifkan manual**: isi email, paket, dan nominal. Berlaku juga untuk promo/gratis (nominal 0). |
| **Perpanjang** | Tab **Pelanggan** → **Perpanjang**. Masa aktif baru ditambahkan setelah tanggal berakhir saat ini. |
| **Koreksi tanggal** | ⚙️ di baris pelanggan → **Berlaku sampai** → **Simpan**. |
| **Pelanggan pindah akun / pasang ulang** | ⚙️ → **Lepas sambungan backend**, lalu pelanggan memasang ulang dari halaman Pasang. |
| **Blokir sementara** | ⚙️ → **Nonaktifkan akun**. Aplikasi pelanggan menjadi baca saja; data mereka tetap utuh. |
| **Laporan pendapatan** | Tab **Pembayaran** → **Ekspor CSV**. |

Server lisensi mengirim **email pengingat otomatis** 7 hari dan 1 hari sebelum jatuh tempo, saat masuk masa tenggang, dan saat menjadi baca saja. Kuota email akun Gmail biasa ±100 per hari.

---

## Merilis pembaruan backend ke semua pelanggan

1. Ubah kode di folder `backend/`. Naikkan `VR_VERSI` di **`backend/Bersama.gs` dan `frontend/js/bersama.js`** (keduanya harus identik), misalnya `2.0.1`.
2. Jalankan:
   ```
   node tools/build-rilis.js https://script.google.com/macros/s/ID_SERVER_LISENSI/exec
   ```
   Hasilnya: `dist/verirad-rilis-2.0.1.json`. Alamat server lisensi otomatis dimasukkan ke `Pasang.gs` di berkas rilis.
3. Buka **Admin Lisensi → Rilis backend** → **Pilih berkas rilis** → isi catatan → **Terbitkan rilis**.
4. Perbarui juga kode di **proyek template** supaya pelanggan baru langsung mendapat versi terbaru.
5. Pelanggan melihat spanduk *"Pembaruan backend tersedia"* dan memperbarui lewat menu **VeriRad → Perbarui backend**. Pertama kali, mereka diminta menyalakan *Google Apps Script API* di `script.google.com/home/usersettings`. Bila ada pelanggan yang gagal, kirimkan berkas `.gs` terbaru untuk ditempel manual. Setelah itu mereka harus memilih **Kelola penerapan → Versi baru**.

Perubahan **frontend** cukup lewat `git push`; semua pelanggan langsung mendapatkannya.

---

## Mengubah harga, batas, atau tenggang

Semua diatur lewat **Properti skrip server lisensi**, tanpa mengubah kode:

| Properti | Contoh |
|---|---|
| `PAKET_JSON` | `{"3B":{"label":"3 bulan","harga":70000,"bulan":3},"6B":{"label":"6 bulan","harga":100000,"bulan":6},"LIFE":{"label":"Lifetime","harga":150000,"bulan":0}}` |
| `BATAS_RS` | `3` |
| `BATAS_FISMED` | `1` *(frontend & backend saat ini dibuat untuk 1 fisikawan medis)* |
| `TENGGANG_HARI` | `7` |

Perubahan harga hanya berlaku untuk pesanan baru. Bila mengubah harga, perbarui juga tabel harga di `panduan.html`.

---

## Privasi & keamanan

- Server lisensi hanya menyimpan: email, nama, nomor WA, paket, masa berlaku, alamat web app pelanggan, versi, dan jumlah RS. **Tidak ada hasil QC.**
- Kunci lisensi tiap backend disimpan sebagai *hash* (SHA-256). Kode aktivasi berlaku 48 jam dan hanya sekali pakai.
- Saat aktivasi, server lisensi memastikan web app benar-benar dijalankan oleh akun Google pelanggan yang membayar (sidik email pemilik). Web app milik akun lain ditolak.
- Saat langganan berakhir, aplikasi pelanggan menjadi **baca saja**. Data tidak pernah dihapus dan tetap bisa diekspor. Bila server lisensi tidak bisa dihubungi, aplikasi pelanggan memakai status terakhir hingga 7 hari.
- Rahasia (`SESSION_SECRET`) dibuat otomatis di Properti skrip, tidak pernah ada di kode atau Sheets.
- Kode backend memang berada di akun pelanggan, jadi pelanggan yang paham teknis bisa saja mengubahnya. Nilai yang mereka bayar adalah pembaruan, template, dan dukungan Anda; tuliskan juga di **Syarat Layanan**.

## Administrasi usaha (bukan nasihat hukum)

- Layanan digital berbayar untuk pengguna Indonesia wajib terdaftar sebagai **PSE Lingkup Privat** lewat OSS.
- Siapkan **Syarat Layanan** dan **Kebijakan Privasi** (UU PDP). Data pribadi yang diproses: nama, email, nomor WA, dan nomor SIP.
- Catat pendapatan untuk keperluan pajak (tab Pembayaran → Ekspor CSV).

## Mengatasi masalah

| Gejala | Penyebab & solusi |
|---|---|
| Halaman masuk: "Server lisensi tidak bisa dihubungi" | `LISENSI_URL` di `config.js` salah, atau web app server lisensi belum diterapkan dengan akses **Siapa saja**. |
| "Token Google bukan untuk aplikasi ini" | `GOOGLE_CLIENT_ID` di server lisensi berbeda dengan Client ID frontend. |
| Pelanggan: "Alamat server lisensi belum diisi oleh penjual" | `VR_LISENSI_URL` di `Pasang.gs` template masih `GANTI_…`. Perbaiki di template, lalu minta pelanggan mengisinya di salinan mereka (atau kirim berkas `Pasang.gs` baru). |
| Tombol "Buat salinan VeriRad" tidak berfungsi | `TEMPLATE_URL` kosong, atau template belum dibagikan sebagai *Pelihat*. |
| Admin Lisensi: "Khusus admin" | Email Anda belum ada di `ADMIN_EMAILS`. |
| Email pengingat tidak terkirim | Jalankan `setupLisensi` sekali lagi untuk memastikan pemicu `harian` ada (lihat ⏰ **Pemicu** di editor). |
