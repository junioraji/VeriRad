/* =====================================================================
 * VeriRad — KONFIGURASI FRONTEND (v3)
 * RELAY_URL        : URL /exec relay VeriRad milik penjual (relay/Relay.gs, akun juniorlabs.id).
 * GOOGLE_CLIENT_ID : OAuth Client ID (Aplikasi web) milik penjual, berakhiran .apps.googleusercontent.com.
 * Dengan dua nilai ini pelanggan cukup "Masuk dengan Google": data QC langsung
 * tersimpan di Google Drive mereka sendiri — tanpa memasang backend.
 * Keduanya bukan rahasia (sama seperti alamat situs).
 *
 * (Lama, v2) LISENSI_URL / GAS_URL hanya dipakai bila RELAY_URL kosong.
 * Selama nilai masih "GANTI_...", aplikasi hanya bisa dibuka dalam Mode Demo.
 * ===================================================================== */
window.APP_CONFIG = {
  RELAY_URL: 'https://script.google.com/macros/s/GANTI_DENGAN_ID_RELAY/exec',
  GOOGLE_CLIENT_ID: 'GANTI_DENGAN_CLIENT_ID.apps.googleusercontent.com',
  LISENSI_URL: '',
  GAS_URL: ''
};
