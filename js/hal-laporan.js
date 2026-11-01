/* =====================================================================
 * VeriRad — Laporan bulanan: pratinjau (HTML sama dengan PDF server),
 * unduh PDF, kirim ke atasan, dan riwayat laporan.
 * ===================================================================== */
'use strict';

const LP = { rs: '', periode: '', grafik: true, penerima: null, cc: null, subjek: '', pesan: '', rsEmail: '' };

daftarHalaman('laporan', {
  judul: 'Laporan',
  render(el) {
    if (!fismed()) return renderLaporanAtasan(el);
    const rsList = rsAktif();
    if (!rsList.length) { el.innerHTML = kosong('Belum ada rumah sakit', 'Tambahkan rumah sakit terlebih dahulu.', '<a class="btn btn-primary" href="#/kelola">Kelola RS & Alat</a>'); return; }
    if (!LP.rs || !getRs(LP.rs)) LP.rs = (AppState.filterRs && getRs(AppState.filterRs)) ? AppState.filterRs : rsList[0].rs_id;
    if (!LP.periode) LP.periode = AppState.periode;
    const rs = getRs(LP.rs);
    if (LP.rsEmail !== LP.rs) { LP.penerima = vrDaftarEmail(rs.email_atasan); LP.cc = vrDaftarEmail(rs.email_cc); LP.rsEmail = LP.rs; LP.subjek = ''; LP.pesan = ''; }
    const subjekBawaan = '[VeriRad] Laporan QC Radiologi ' + rs.nama + ' — ' + vrNamaPeriode(LP.periode);
    const pesanBawaan = 'Yth. ' + (rs.nama_penandatangan || 'Bapak/Ibu Kepala Instalasi Radiologi') + ',\n\nBersama ini kami sampaikan laporan quality control bulanan alat radiologi ' + rs.nama + ' periode ' + vrNamaPeriode(LP.periode) + '. Laporan lengkap terlampir dalam bentuk PDF.\n\nHormat kami,\n' + (AppState.pengaturan.nama_fismed || AppState.me.nama || '');
    const alat = alatAktif(LP.rs);
    const final = alat.filter(a => { const s = sesiAlat(a.alat_id, LP.periode); return s && s.status_sesi === 'FINAL'; });
    const gagal = final.filter(a => sesiAlat(a.alat_id, LP.periode).status_total === 'GAGAL');
    const profilKurang = !AppState.pengaturan.nama_fismed || !AppState.pengaturan.ttd_file_id;
    el.innerHTML = '<div class="page-h"><div><h1>Laporan Quality Control Bulanan</h1><p>Pratinjau di bawah sama persis dengan PDF yang dibuat server.</p></div>' +
      '<div class="act"><button class="btn" id="lp-csv">' + ic('download') + 'Ekspor CSV</button><button class="btn" id="lp-cetak">' + ic('printer') + 'Cetak</button></div></div>' +
      (profilKurang ? '<div class="banner banner-warn">' + ic('triangle-alert') + '<div class="t small">Profil fisikawan medis atau tanda tangan belum lengkap, sehingga blok tanda tangan di PDF masih kosong.</div><a class="btn btn-sm" href="#/pengaturan">Lengkapi</a></div>' : '') +
      '<div class="row r-1-2"><div class="stack">' +
      '<div class="card"><div class="card-h"><h2>' + ic('sliders-horizontal') + 'Konfigurasi laporan</h2></div><div class="card-b stack">' +
      '<div class="field"><label for="lp-rs">Rumah sakit</label><select class="input" id="lp-rs">' + rsList.map(r => '<option value="' + r.rs_id + '"' + (r.rs_id === LP.rs ? ' selected' : '') + '>' + esc(r.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="lp-per">Periode</label><select class="input" id="lp-per">' + daftarPeriode().map(p => '<option value="' + p + '"' + (p === LP.periode ? ' selected' : '') + '>' + esc(vrNamaPeriode(p)) + '</option>').join('') + '</select></div>' +
      '<label class="check"><input type="checkbox" id="lp-grafik"' + (LP.grafik ? ' checked' : '') + '><span>Sertakan grafik tren<span class="hint" style="display:block">Kelulusan 6 bulan dan tren setiap parameter yang gagal.</span></span></label>' +
      '<div class="banner ' + (final.length === alat.length ? 'banner-info' : 'banner-warn') + ' small">' + ic(final.length === alat.length ? 'circle-check' : 'clock') + '<div class="t"><b>' + final.length + ' dari ' + alat.length + ' alat sudah final.</b> ' +
      (final.length < alat.length ? 'Alat lain tercantum "belum diuji" atau "draf".' : 'Laporan siap dikirim.') + (gagal.length ? ' <b style="color:var(--fail)">' + gagal.length + ' alat gagal.</b>' : '') + '</div></div>' +
      '</div></div>' +
      '<div class="card"><div class="card-h"><h2>' + ic('mail') + 'Penerima & email</h2></div><div class="card-b stack">' +
      '<div class="field"><span class="lbl">Kepada (atasan) <span class="req">*</span></span><div class="emails" id="lp-ke"></div></div>' +
      '<div class="field"><span class="lbl">Tembusan (CC)</span><div class="emails" id="lp-cc"></div></div>' +
      '<div class="field"><label for="lp-subjek">Subjek</label><input class="input" id="lp-subjek" value="' + esc(LP.subjek || subjekBawaan) + '"></div>' +
      '<div class="field"><label for="lp-pesan">Pesan pengantar</label><textarea class="input" id="lp-pesan" rows="7">' + esc(LP.pesan || pesanBawaan) + '</textarea></div>' +
      '<p class="hint" style="margin:0">Dikirim dari akun Gmail Anda dengan PDF terlampir. Kuota Gmail biasa ±100 penerima/hari.</p>' +
      '</div><div class="card-f"><button class="btn" id="lp-unduh">' + ic('file-down') + 'Unduh PDF</button><button class="btn btn-primary" id="lp-kirim">' + ic('send') + 'Kirim ke atasan</button></div></div>' +
      '</div><div class="card"><div class="card-h"><h2>' + ic('eye') + 'Pratinjau dokumen</h2><span class="small muted mono">A4 potret</span></div><div class="preview-wrap" id="lp-prev"><div class="skel" style="width:100%;max-width:820px;height:900px"></div></div></div></div>' +
      '<div class="card" id="lp-riwayat"></div>';
    emailChips($('#lp-ke', el), LP.penerima, v => { LP.penerima = v; });
    emailChips($('#lp-cc', el), LP.cc, v => { LP.cc = v; });
    $('#lp-rs', el).addEventListener('change', e => { LP.rs = e.target.value; Halaman.laporan.render(el); });
    $('#lp-per', el).addEventListener('change', e => { LP.periode = e.target.value; LP.subjek = ''; LP.pesan = ''; Halaman.laporan.render(el); });
    $('#lp-grafik', el).addEventListener('change', e => { LP.grafik = e.target.checked; pratinjau(el); });
    $('#lp-subjek', el).addEventListener('input', e => { LP.subjek = e.target.value; });
    $('#lp-pesan', el).addEventListener('input', e => { LP.pesan = e.target.value; });
    $('#lp-cetak', el).addEventListener('click', () => { const f = $('#lp-prev iframe'); if (f) f.contentWindow.print(); });
    $('#lp-csv', el).addEventListener('click', () => eksporCsvPeriode(rs, LP.periode));
    $('#lp-unduh', el).addEventListener('click', e => buatLaporan(el, false, e.currentTarget));
    $('#lp-kirim', el).addEventListener('click', e => buatLaporan(el, true, e.currentTarget));
    gambarRiwayatLaporan($('#lp-riwayat', el), true);
    pratinjau(el);
  }
});

function vrDaftarEmail(v) { return String(v || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean); }
function emailOk(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function emailChips(box, list, onChange) {
  list = list || [];
  function gambar() {
    box.innerHTML = list.map((e, i) => '<span class="em ' + (emailOk(e) ? '' : 'bad') + '">' + esc(e) + '<button type="button" data-i="' + i + '" aria-label="Hapus ' + esc(e) + '">' + ic('x') + '</button></span>').join('') +
      '<input type="email" placeholder="' + (list.length ? '' : 'ketik email lalu Enter') + '" aria-label="Tambah email">';
    const inp = $('input', box);
    const tambah = () => { vrDaftarEmail(inp.value).forEach(x => { if (list.indexOf(x) === -1) list.push(x); }); inp.value = ''; onChange(list); gambar(); $('input', box).focus(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); if (inp.value.trim()) tambah(); } else if (e.key === 'Backspace' && !inp.value && list.length) { list.pop(); onChange(list); gambar(); $('input', box).focus(); } });
    inp.addEventListener('blur', () => { if (inp.value.trim()) tambah(); });
    $$('[data-i]', box).forEach(b => b.addEventListener('click', () => { list.splice(Number(b.dataset.i), 1); onChange(list); gambar(); }));
  }
  box.addEventListener('click', e => { if (e.target === box) $('input', box).focus(); });
  gambar();
}

async function dataLaporan(rs, per, grafik) {
  if (per < AppState.sesiDari && !(await muatSesiSejak(per))) return null;
  const sesi = AppState.sesi.filter(s => s.rs_id === rs.rs_id && s.periode === per);
  if (!(await muatHasil(sesi.map(s => s.sesi_id)))) return null;
  const hasil = [];
  sesi.forEach(s => (AppState.hasil[s.sesi_id] || []).forEach(h => hasil.push(h)));
  const p = AppState.pengaturan;
  return {
    rs, alat: AppState.alat, sesi, hasil, periode: per, templates: AppState.templates,
    profil: { nama: p.nama_fismed || '', no_izin: p.no_izin || '', kota: p.kota || '' },
    logo: await dataUriBerkas(rs.logo_file_id), ttd: fismed() ? await dataUriBerkas(p.ttd_file_id) : '',
    grafik: grafik ? await buatGrafikLaporan(rs, per, sesi) : [], tanggal: AppState.hariIni || new Date().toISOString().slice(0, 10), sep: sep()
  };
}

const pratinjau = debounce(async function (el) {
  const box = $('#lp-prev', el); if (!box) return;
  const rs = getRs(LP.rs);
  const d = await dataLaporan(rs, LP.periode, LP.grafik);
  if (!d || !document.body.contains(box)) return;
  const f = document.createElement('iframe');
  f.title = 'Pratinjau laporan';
  f.srcdoc = vrLaporanHtml(d).replace('<body>', '<body style="padding:14mm;max-width:210mm;margin:auto">');
  box.innerHTML = '';
  box.appendChild(f);
}, 250);

async function buatGrafikLaporan(rs, per, sesiPer) {
  const out = [], bulan = [];
  for (let i = 5; i >= 0; i--) bulan.push(vrGeserPeriode(per, -i));
  if (bulan[0] < AppState.sesiDari) await muatSesiSejak(bulan[0]);
  const ids = alatAktif(rs.rs_id).map(a => a.alat_id);
  const persen = bulan.map(b => {
    const ss = AppState.sesi.filter(s => s.periode === b && s.status_sesi === 'FINAL' && ids.indexOf(s.alat_id) > -1);
    const n = ss.reduce((a, s) => a + Number(s.n_total) - Number(s.n_na), 0);
    return n ? ss.reduce((a, s) => a + Number(s.n_lulus), 0) / n * 100 : null;
  });
  if (persen.some(v => v !== null)) {
    const svg = grafikGaris({ labels: bulan.map(singkatBulan), seri: [{ nama: '% lulus', warna: '#F37021', nilai: persen }], persen: true, lebar: 640, tinggi: 200, labelNilai: true, desimal: 0 });
    const png = await svgKePng(svg, 640, 200);
    if (png) out.push({ judul: 'Persentase parameter lulus — ' + rs.nama + ' (6 bulan)', src: png });
  }
  const gagal = [];
  sesiPer.filter(s => s.status_sesi === 'FINAL').forEach(s => (AppState.hasil[s.sesi_id] || []).forEach(h => { if (h.status === 'GAGAL' && h.tipe_input !== 'KUALITATIF') gagal.push({ s, h }); }));
  for (const g of gagal.slice(0, 5)) {
    const ss = AppState.sesi.filter(s => s.alat_id === g.s.alat_id && s.status_sesi === 'FINAL' && s.periode >= bulan[0] && s.periode <= per);
    await muatHasil(ss.map(s => s.sesi_id));
    const nilai = bulan.map(b => { const s = ss.find(x => x.periode === b); const h = s && (AppState.hasil[s.sesi_id] || []).find(x => x.kode === g.h.kode); return h && h.status !== 'NA' ? vrAngka(h.nilai) : null; });
    const st = bulan.map(b => { const s = ss.find(x => x.periode === b); const h = s && (AppState.hasil[s.sesi_id] || []).find(x => x.kode === g.h.kode); return !!(h && h.status === 'GAGAL'); });
    const garis = [];
    if (g.h.min_terpakai !== '') garis.push({ y: vrAngka(g.h.min_terpakai), label: 'Batas min ' + vrAngkaRingkas(g.h.min_terpakai, sep()) });
    if (g.h.maks_terpakai !== '') garis.push({ y: g.h.tipe_toleransi === 'MUTLAK_PM' ? Math.abs(vrAngka(g.h.maks_terpakai)) : vrAngka(g.h.maks_terpakai), label: 'Batas maks ' + vrAngkaRingkas(g.h.maks_terpakai, sep()) });
    const svg = grafikGaris({ labels: bulan.map(singkatBulan), seri: [{ nama: g.h.nama, warna: '#1B2A4A', nilai, tandaGagal: st }], garis, lebar: 640, tinggi: 200, labelNilai: true, desimal: Number(g.h.desimal) });
    const png = await svgKePng(svg, 640, 200);
    const a = getAlat(g.s.alat_id) || {};
    if (png) out.push({ judul: a.kode + ' — ' + g.h.nama + (g.h.satuan ? ' (' + g.h.satuan + ')' : ''), src: png });
  }
  return out;
}

async function buatLaporan(el, kirim, btn) {
  const rs = getRs(LP.rs);
  if (kirim) {
    const ke = (LP.penerima || []).filter(Boolean);
    if (!ke.length) return toast('Isi minimal satu email penerima.', 'warning');
    const salah = ke.concat(LP.cc || []).filter(e => !emailOk(e));
    if (salah.length) return toast('Email tidak valid: ' + salah.join(', '), 'warning');
    const ok = await konfirmasi('Kirim laporan?', 'Laporan ' + rs.nama + ' periode ' + vrNamaPeriode(LP.periode) + ' akan dikirim ke ' + ke.join(', ') + (LP.cc && LP.cc.length ? ' (CC: ' + LP.cc.join(', ') + ')' : '') + ' dari akun Gmail Anda.', 'Kirim sekarang');
    if (!ok) return;
  }
  setBusy(btn, true, kirim ? 'Membuat & mengirim…' : 'Membuat PDF…');
  const grafik = LP.grafik ? await buatGrafikLaporan(rs, LP.periode, AppState.sesi.filter(s => s.rs_id === rs.rs_id && s.periode === LP.periode)) : [];
  const r = await api('laporan.buat', { rs_id: rs.rs_id, periode: LP.periode, grafik, kirim, penerima: LP.penerima, cc: LP.cc, subjek: $('#lp-subjek', el).value, pesan: $('#lp-pesan', el).value });
  setBusy(btn, false);
  if (r.data && r.data.laporan) { AppState.laporan.unshift(r.data.laporan); gambarRiwayatLaporan($('#lp-riwayat', el), true); }
  if (!r.success) return toast(r.message, 'error');
  toast(r.message, 'success');
  if (!kirim) {
    if (r.data.pdf) unduhBase64(r.data.nama_file, r.data.pdf, 'application/pdf');
    else if (AppState.demo) { toast('Mode demo tidak membuat PDF di server. Dialog cetak dibuka — pilih "Simpan sebagai PDF".', 'info'); const f = $('#lp-prev iframe'); if (f) f.contentWindow.print(); }
  }
}

function gambarRiwayatLaporan(box, bolehKirim) {
  const rows = AppState.laporan.slice().sort((a, b) => a.waktu < b.waktu ? 1 : -1);
  box.innerHTML = '<div class="card-h"><h2>' + ic('history') + 'Riwayat laporan</h2><span class="small muted">' + rows.length + ' arsip</span></div>' +
    (rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Periode</th><th>Rumah sakit</th><th>Dikirim ke</th><th>Waktu</th><th class="c">Status</th><th></th></tr></thead><tbody>' +
      rows.map(l => {
        const rs = getRs(l.rs_id) || {};
        const st = l.status_kirim === 'GAGAL' ? '<span class="badge b-gagal" title="' + esc(l.pesan_error) + '">Gagal kirim</span>' : badge(l.status_kirim === 'TERKIRIM' ? 'TERKIRIM' : 'DIBUAT', l.status_kirim === 'TERKIRIM' ? 'Terkirim' : 'PDF dibuat');
        return '<tr><td><b>' + esc(vrNamaPeriode(l.periode)) + '</b><span class="sub mono">' + esc(l.nama_file) + '</span></td><td>' + esc(rs.nama || l.rs_id) + '</td><td class="small">' + esc(l.dikirim_ke || '—') + (l.cc ? '<span class="sub">CC: ' + esc(l.cc) + '</span>' : '') + '</td>' +
          '<td class="m">' + jamTgl(l.waktu) + '</td><td class="c">' + st + '</td><td><div class="hstack" style="justify-content:flex-end;flex-wrap:nowrap">' +
          '<button class="btn btn-sm" data-unduh="' + l.laporan_id + '">' + ic('download') + 'PDF</button>' +
          (bolehKirim ? '<button class="btn btn-sm btn-ghost" data-ulang="' + l.laporan_id + '">' + ic('send') + 'Kirim ulang</button>' : '') + '</div></td></tr>';
      }).join('') + '</tbody></table></div>' : kosong('Belum ada laporan', bolehKirim ? 'Laporan yang dibuat atau dikirim akan tercatat di sini.' : 'Laporan dari fisikawan medis akan muncul di sini.'));
  $$('[data-unduh]', box).forEach(b => b.addEventListener('click', async () => {
    setBusy(b, true, '');
    const r = await api('laporan.unduh', { laporan_id: b.dataset.unduh });
    setBusy(b, false);
    if (!r.success) return toast(r.message, 'error');
    if (r.data.base64) unduhBase64(r.data.nama_file, r.data.base64, 'application/pdf');
    else toast('Mode demo: PDF tidak tersedia. Gunakan tombol Cetak di halaman laporan.', 'info');
  }));
  $$('[data-ulang]', box).forEach(b => b.addEventListener('click', async () => {
    const l = AppState.laporan.find(x => x.laporan_id === b.dataset.ulang);
    const rs = getRs(l.rs_id) || {};
    const def = l.dikirim_ke || rs.email_atasan || '';
    const m = modal({ judul: 'Kirim ulang laporan', ikon: 'send', isi: '<p class="small muted" style="margin-top:0">' + esc(l.nama_file) + '</p><div class="field"><label for="ku-ke">Kepada (pisahkan dengan koma)</label><input class="input" id="ku-ke" value="' + esc(def) + '"></div>' +
      '<div class="field" style="margin-top:12px"><label for="ku-cc">CC</label><input class="input" id="ku-cc" value="' + esc(l.cc || rs.email_cc || '') + '"></div>',
      tombol: [{ label: 'Batal' }, { label: 'Kirim', kelas: 'btn-primary', ikon: 'send', aksi: async (bg) => {
        const r = await api('laporan.kirimUlang', { laporan_id: l.laporan_id, penerima: vrDaftarEmail($('#ku-ke', bg).value), cc: vrDaftarEmail($('#ku-cc', bg).value) });
        if (!r.success) { toast(r.message, 'error'); return false; }
        Object.assign(l, { status_kirim: 'TERKIRIM', dikirim_ke: r.data.dikirim_ke, waktu: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19), pesan_error: '' });
        toast(r.message, 'success'); gambarRiwayatLaporan(box, bolehKirim);
      } }] });
    return m;
  }));
}

function renderLaporanAtasan(el) {
  el.innerHTML = '<div class="page-h"><div><h1>Arsip Laporan Bulanan</h1><p>Laporan QC dari fisikawan medis untuk ' + esc(rsAktif().map(r => r.nama).join(', ')) + '.</p></div></div>' +
    '<div class="banner banner-info">' + ic('eye') + '<div class="t small">Anda masuk sebagai <b>atasan (lihat saja)</b>. Hasil QC hanya bisa diubah oleh fisikawan medis.</div></div><div class="card" id="lp-riwayat"></div>';
  gambarRiwayatLaporan($('#lp-riwayat', el), false);
}

async function eksporCsvPeriode(rs, per) {
  const sesi = AppState.sesi.filter(s => s.rs_id === rs.rs_id && s.periode === per && s.status_sesi === 'FINAL');
  if (!sesi.length) return toast('Belum ada sesi final pada periode ini.', 'warning');
  await muatHasil(sesi.map(s => s.sesi_id));
  const baris = [['RS', 'Periode', 'Kode alat', 'Merek', 'Tipe', 'No seri tabung', 'Ruangan', 'Tanggal uji', 'Kategori', 'Kelompok', 'Kode parameter', 'Parameter', 'Nilai', 'Satuan', 'Kriteria', 'Status', 'Alasan N/A']];
  sesi.forEach(s => {
    const a = getAlat(s.alat_id) || {};
    (AppState.hasil[s.sesi_id] || []).forEach(h => baris.push([rs.nama, per, a.kode, a.merek, a.tipe, a.no_seri_tabung, a.ruangan, s.tanggal, h.kategori, h.kelompok, h.kode, h.nama,
      h.status === 'NA' ? '' : (h.tipe_input === 'KUALITATIF' ? h.nilai : vrFormat(h.nilai, h.desimal, sep())), h.satuan,
      vrTeksToleransi(h, h.min_terpakai === '' ? null : vrAngka(h.min_terpakai), h.maks_terpakai === '' ? null : vrAngka(h.maks_terpakai), sep()), LABEL_STATUS[h.status] || h.status, h.alasan_na]));
  });
  unduhCsv('QC_' + (rs.kode || 'RS') + '_' + per + '.csv', baris);
}
