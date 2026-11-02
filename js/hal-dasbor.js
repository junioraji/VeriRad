/* =====================================================================
 * VeriRad — Dasbor: status QC bulan ini di semua RS (atau RS sendiri)
 * ===================================================================== */
'use strict';

daftarHalaman('dasbor', {
  judul: 'Dasbor',
  render(el) {
    const f = fismed(), per = AppState.periode;
    const rsList = rsAktif();
    if (f && !rsList.length) {
      el.innerHTML = '<div class="page-h"><div><h1>Selamat datang di VeriRad</h1><p>Siapkan tiga hal ini sekali saja, lalu QC bulanan tinggal diisi.</p></div></div>' +
        '<div class="card"><div class="list">' +
        langkah(1, 'Lengkapi profil & tanda tangan', 'Nama, nomor izin, dan tanda tangan muncul di laporan PDF.', '#/pengaturan', AppState.pengaturan.nama_fismed) +
        langkah(2, 'Tambah rumah sakit dan alat', 'Daftarkan 2–3 RS yang Anda pegang beserta alat radiologinya.', '#/kelola', false) +
        langkah(3, 'Periksa template toleransi', 'Pastikan batas toleransi sesuai acuan Anda. Butir ⚠ perlu keputusan.', '#/template', false) +
        '</div></div>';
      return;
    }
    const pilihRs = AppState.filterRs && getRs(AppState.filterRs) ? AppState.filterRs : '';
    const jenis = el.dataset.jenis || '';
    let alat = alatAktif(pilihRs).filter(a => !jenis || a.template_id === jenis);
    const st = alat.map(a => Object.assign({ a }, statusAlat(a.alat_id, per)));
    const selesai = st.filter(x => x.sesi && x.sesi.status_sesi === 'FINAL');
    const gagal = selesai.filter(x => x.st === 'GAGAL');
    const draf = st.filter(x => x.st === 'DRAF');
    const belum = st.filter(x => x.st === 'BELUM' || x.st === 'DRAF');
    const rsTampil = pilihRs ? [getRs(pilihRs)] : rsList;
    const lapTerkirim = rsTampil.filter(r => AppState.laporan.some(l => l.rs_id === r.rs_id && l.periode === per && l.status_kirim === 'TERKIRIM'));
    const persen = alat.length ? Math.round(selesai.length / alat.length * 100) : 0;
    const antre = Antrean.list().length;

    el.innerHTML =
      '<div class="page-h"><div><h1>' + (f ? 'Dasbor' : 'Dasbor ' + esc(rsList.map(r => r.nama).join(', '))) + '</h1><p>Status QC ' + esc(vrNamaPeriode(per)) + (f ? ' di semua rumah sakit' : '') + '</p></div>' +
      '<div class="act">' + (f ? '<a class="btn btn-primary" href="#/input">' + ic('plus') + 'Mulai Uji QC</a>' : '') + '</div></div>' +
      (antre ? '<div class="banner banner-dark">' + ic('cloud-off') + '<div class="t"><b>' + antre + ' data QC tersimpan di perangkat ini</b><div class="muted small">Akan dikirim otomatis saat tersambung ke internet.</div></div><button class="btn btn-primary btn-sm" id="kirim-antre">' + ic('cloud-upload') + 'Kirim sekarang</button></div>' : '') +
      '<div class="filters">' +
      (rsList.length > 1 ? '<div class="field"><label for="f-rs">Rumah sakit</label><select class="input" id="f-rs"><option value="">Semua RS (' + rsList.length + ')</option>' + rsList.map(r => '<option value="' + r.rs_id + '"' + (r.rs_id === pilihRs ? ' selected' : '') + '>' + esc(r.nama) + '</option>').join('') + '</select></div>' : '') +
      '<div class="field"><label for="f-jenis">Jenis alat</label><select class="input" id="f-jenis"><option value="">Semua jenis</option>' + AppState.templates.filter(t => vrBenar(t.aktif)).map(t => '<option value="' + t.template_id + '"' + (t.template_id === jenis ? ' selected' : '') + '>' + esc(t.nama) + '</option>').join('') + '</select></div></div>' +
      '<div class="row r-kpi">' +
      kpi('Rumah sakit', rsTampil.length, '', 'building-2', f ? 'aktif dipegang' : 'yang Anda pantau') +
      kpi('Alat selesai', selesai.length, '/ ' + alat.length, 'circle-check', persen + '% dari target bulan ini') +
      kpi('Alat gagal', gagal.length, '', 'triangle-alert', gagal.length ? esc(gagal[0].a.kode + ' ' + (getRs(gagal[0].a.rs_id) || {}).nama) + (gagal.length > 1 ? ' +' + (gagal.length - 1) : '') : 'Tidak ada temuan', gagal.length ? 'is-fail' : '') +
      kpi('Belum dicek', belum.length, '', 'clock', draf.length ? draf.length + ' masih draf' : 'termasuk alat tanpa sesi') +
      '</div>' +
      '<div class="row r-2-1">' +
      '<div class="card"><div class="card-h"><h2>' + ic('chart-line') + 'Tren Kelulusan QC</h2><span class="small muted">6 bulan terakhir</span></div><div class="card-b"><div class="chart" id="tren"></div></div></div>' +
      '<div class="card"><div class="card-h"><h2>' + ic('history') + 'Aktivitas Terbaru</h2></div><div class="list" id="aktivitas"></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-h"><h2>' + ic('table-2') + 'Matriks Status QC</h2><span class="small muted">' + alat.length + ' alat</span></div>' +
      (alat.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Alat</th>' + VR_KATEGORI.map(k => '<th class="c">' + esc(k) + '</th>').join('') + '<th class="c">Status akhir</th><th></th></tr></thead><tbody>' +
        st.map(x => {
          const s = x.sesi, kat = kategoriTpl(x.a.template_id), rs = getRs(x.a.rs_id) || {};
          return '<tr class="' + (x.st === 'GAGAL' ? 'is-fail' : '') + '"><td class="alat-col"><b>' + esc(x.a.kode) + '</b> · ' + esc(x.a.merek + ' ' + x.a.tipe) + '<span class="sub">' + esc((pilihRs ? '' : rs.nama + ' · ') + x.a.ruangan) + '</span></td>' +
            VR_KATEGORI.map(k => '<td class="c">' + (kat.indexOf(k) === -1 ? '<span class="b-none">—</span>' : s ? (s.status_sesi === 'FINAL' ? badge(s[VR_KATEGORI_KOLOM[k]] || 'BELUM') : badge(s[VR_KATEGORI_KOLOM[k]] === 'BELUM' ? 'BELUM' : 'DRAF', s[VR_KATEGORI_KOLOM[k]] === 'BELUM' ? 'Belum' : 'Draf')) : badge('BELUM')) + '</td>').join('') +
            '<td class="c">' + badge(x.st) + '</td>' +
            '<td>' + (f ? '<a class="btn btn-sm" href="#/input/' + x.a.alat_id + '">' + (s ? (s.status_sesi === 'FINAL' ? 'Lihat' : 'Lanjutkan') : 'Isi QC') + '</a>' : '<a class="btn btn-sm btn-ghost" href="#/riwayat/' + x.a.alat_id + '">Riwayat</a>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="tbl-foot"><span>● Lulus · ■ Gagal · ○ Belum · ◇ N/A · ✎ Draf</span><span>— = kategori tidak ada di template alat</span></div>'
        : kosong('Belum ada alat', 'Tambahkan alat di menu Kelola RS & Alat.', f ? '<a class="btn btn-primary" href="#/kelola">' + ic('plus') + 'Tambah alat</a>' : '')) + '</div>' +
      '<div class="row r-1-1">' +
      '<div class="card"><div class="card-h"><h2>' + ic('chart-pie') + 'Komposisi Status</h2><span class="small muted mono">' + esc(singkatBulan(per)) + '</span></div><div class="card-b stack">' +
      '<div class="chart" style="max-width:200px;margin:0 auto">' + grafikDonut([
        { label: 'Lulus', nilai: selesai.length - gagal.length - selesai.filter(x => x.st === 'NA').length, warna: '#15803D' },
        { label: 'Gagal', nilai: gagal.length, warna: '#DC2626' },
        { label: 'Draf', nilai: draf.length, warna: '#F37021' },
        { label: 'Belum', nilai: belum.length - draf.length, warna: '#CBD5E1' }], persen + '%', 'SELESAI') + '</div>' +
      '<div class="legend">' + [['Lulus', selesai.length - gagal.length, '#15803D'], ['Gagal', gagal.length, '#DC2626'], ['Draf', draf.length, '#F37021'], ['Belum diperiksa', belum.length - draf.length, '#CBD5E1']]
        .map(x => '<div class="li"><span class="sw" style="background:' + x[2] + '"></span>' + x[0] + '<b>' + x[1] + '</b></div>').join('') + '</div></div></div>' +
      '<div class="card card-dark"><div class="card-h" style="border-color:rgba(255,255,255,.1)"><h2>' + ic('file-text') + 'Ringkasan Laporan</h2><span class="small muted mono">' + esc(singkatBulan(per)) + '</span></div>' +
      '<div class="card-b stack">' +
      [['Laporan terkirim', lapTerkirim.length + ' / ' + rsTampil.length + ' RS'], ['Alat siap dilaporkan', selesai.length + ' / ' + alat.length], ['Temuan gagal', gagal.length + ' alat']]
        .map(x => '<div class="hstack between" style="border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px"><span class="muted">' + x[0] + '</span><b class="mono">' + x[1] + '</b></div>').join('') +
      '<div><div class="hstack between small" style="margin-bottom:6px"><span class="muted">Kelengkapan QC</span><b class="mono">' + persen + '%</b></div><div class="progress"><i style="width:' + persen + '%"></i></div></div>' +
      (f ? '<a class="btn btn-on-dark btn-block" href="#/laporan">Buka Laporan' + ic('arrow-right') + '</a>' : '<a class="btn btn-on-dark btn-block" href="#/riwayat">Lihat Riwayat & Tren' + ic('arrow-right') + '</a>') + '</div></div>' +
      '</div>' +
      '<div class="card strip">' +
      [['calculator', 'Lulus/Gagal otomatis', 'Dinilai saat nilai diketik, dibulatkan half-up.'], ['cloud-off', 'Simpan draf offline', 'Isi di ruang tanpa sinyal, kirim belakangan.'],
        ['file-text', 'Laporan PDF berkop', 'Logo RS dan tanda tangan, langsung ke email.'], ['lock', 'Data milik Anda', 'Tersimpan di Google Drive & Sheets akun Anda.']]
        .map(x => '<div><div class="ico">' + ic(x[0]) + '</div><div><b>' + x[1] + '</b><span>' + x[2] + '</span></div></div>').join('') + '</div>';

    // Tren 6 bulan
    const bulan = []; for (let i = 5; i >= 0; i--) bulan.push(vrGeserPeriode(per, -i));
    const ids = alat.map(a => a.alat_id);
    const seriParam = [], seriAlat = [];
    bulan.forEach(b => {
      const ss = AppState.sesi.filter(s => s.periode === b && s.status_sesi === 'FINAL' && ids.indexOf(s.alat_id) > -1);
      const nilai = ss.reduce((a, s) => a + Number(s.n_total) - Number(s.n_na), 0);
      seriParam.push(nilai ? ss.reduce((a, s) => a + Number(s.n_lulus), 0) / nilai * 100 : null);
      seriAlat.push(ss.length ? ss.filter(s => s.status_total !== 'GAGAL').length / ss.length * 100 : null);
    });
    const seri = [{ nama: '% parameter lulus', warna: '#F37021', nilai: seriParam }, { nama: '% alat lulus', warna: '#1B2A4A', nilai: seriAlat, putus: true }];
    $('#tren', el).innerHTML = legendaGrafik(seri) + grafikGaris({ labels: bulan.map(singkatBulan), seri, persen: true, lebar: 640, tinggi: 250, judul: 'Tren kelulusan QC' });

    // Aktivitas
    const akt = AppState.sesi.filter(s => ids.indexOf(s.alat_id) > -1).sort((a, b) => a.diubah < b.diubah ? 1 : -1).slice(0, 6);
    $('#aktivitas', el).innerHTML = akt.length ? akt.map(s => {
      const a = getAlat(s.alat_id) || {}, rs = getRs(s.rs_id) || {};
      return '<div class="list-item"><div class="grow"><b>' + esc(a.kode + ' ' + (a.merek || '')) + '</b><span class="sub small muted" style="display:block">' + esc(rs.nama) + ' · ' + esc(vrNamaPeriode(s.periode)) + '</span>' +
        '<div style="margin-top:4px">' + (s.status_sesi === 'FINAL' ? badge(s.status_total) : badge('DRAF')) + '</div></div><span class="tm">' + esc(waktuRelatif(s.diubah)) + '</span></div>';
    }).join('') : '<div class="empty small">Belum ada aktivitas.</div>';

    const fr = $('#f-rs', el);
    if (fr) fr.addEventListener('change', () => { AppState.filterRs = fr.value; rute(); });
    $('#f-jenis', el).addEventListener('change', e => { el.dataset.jenis = e.target.value; Halaman.dasbor.render(el); });
    const ka = $('#kirim-antre', el);
    if (ka) ka.addEventListener('click', async () => { setBusy(ka, true, 'Mengirim…'); await Antrean.flush(); setBusy(ka, false); });
  }
});

function kpi(lbl, val, kecil, ikon, sub, kelas) {
  return '<div class="card kpi ' + (kelas || '') + '"><div class="ico">' + ic(ikon) + '</div><span class="lbl">' + esc(lbl) + '</span>' +
    '<span class="val">' + esc(val) + (kecil ? ' <small>' + esc(kecil) + '</small>' : '') + '</span><span class="sub">' + sub + '</span></div>';
}
function langkah(n, judul, ket, href, selesai) {
  return '<div class="list-item" style="align-items:center"><div class="avatar" style="background:' + (selesai ? 'var(--pass)' : 'var(--navy-700)') + '">' + (selesai ? ic('check') : n) + '</div>' +
    '<div class="grow"><b>' + esc(judul) + '</b><div class="small muted">' + esc(ket) + '</div></div><a class="btn ' + (selesai ? '' : 'btn-primary') + '" href="' + href + '">' + (selesai ? 'Ubah' : 'Mulai') + ic('arrow-right') + '</a></div>';
}
