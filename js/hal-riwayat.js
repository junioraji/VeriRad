/* =====================================================================
 * VeriRad — Riwayat & Tren: nilai satu parameter dari bulan ke bulan
 * ===================================================================== */
'use strict';

const RW = { rs: '', alat: '', kat: '', param: '', rentang: 12, cari: '', dari: '', sampai: '' };   // rentang: 6 | 12 | 0 (semua) | -1 (pilih bulan)

daftarHalaman('riwayat', {
  judul: 'Riwayat & Tren',
  async render(el, alatId) {
    if (alatId && getAlat(alatId)) { RW.alat = alatId; RW.rs = getAlat(alatId).rs_id; RW.param = ''; RW.kat = ''; }
    const rsList = rsAktif();
    if (!rsList.length) { el.innerHTML = kosong('Belum ada data', 'Riwayat muncul setelah ada rumah sakit, alat, dan hasil QC.', fismed() ? '<a class="btn btn-primary" href="#/kelola">Kelola RS & Alat</a>' : ''); return; }
    if (!RW.rs || !getRs(RW.rs)) RW.rs = (AppState.filterRs && getRs(AppState.filterRs)) ? AppState.filterRs : rsList[0].rs_id;
    const alatRs = AppState.alat.filter(a => a.rs_id === RW.rs).sort((a, b) => a.kode.localeCompare(b.kode));
    if (!alatRs.find(a => a.alat_id === RW.alat)) { RW.alat = alatRs[0] ? alatRs[0].alat_id : ''; RW.param = ''; }
    const a = getAlat(RW.alat);
    const per = AppState.periode;
    const kini = AppState.periodeSekarang || per;
    if (RW.rentang === -1) {
      if (!RW.sampai) RW.sampai = per;
      if (!RW.dari) RW.dari = vrGeserPeriode(RW.sampai, -5);
      if (RW.dari > RW.sampai) { const t = RW.dari; RW.dari = RW.sampai; RW.sampai = t; }
    }
    const dari = RW.rentang === -1 ? RW.dari : RW.rentang ? vrGeserPeriode(per, -(RW.rentang - 1)) : '2000-01';
    const sampai = RW.rentang === -1 ? RW.sampai : per;
    const opsiBulan = pilih => { const o = []; for (let i = 0; i < 60; i++) { const b = vrGeserPeriode(kini > per ? kini : per, -i); o.push('<option value="' + b + '"' + (b === pilih ? ' selected' : '') + '>' + esc(vrNamaPeriode(b)) + '</option>'); } return o.join(''); };
    el.innerHTML = '<div class="page-h"><div><h1>Riwayat & Analisis Tren QC</h1><p>Lihat perubahan nilai parameter dari bulan ke bulan untuk mendeteksi pergeseran sebelum alat gagal.</p></div>' +
      '<div class="act"><button class="btn" id="csv"' + (a ? '' : ' disabled') + '>' + ic('download') + 'Ekspor CSV</button></div></div>' +
      '<div class="card card-b"><div class="filters">' +
      '<div class="field"><label for="rw-rs">Rumah sakit</label><select class="input" id="rw-rs">' + rsList.map(r => '<option value="' + r.rs_id + '"' + (r.rs_id === RW.rs ? ' selected' : '') + '>' + esc(r.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field" style="min-width:220px"><label for="rw-alat">Alat</label><select class="input" id="rw-alat">' + alatRs.map(x => '<option value="' + x.alat_id + '"' + (x.alat_id === RW.alat ? ' selected' : '') + '>' + esc(x.kode + ' · ' + x.merek + ' ' + x.tipe + (vrBenar(x.aktif) ? '' : ' (nonaktif)')) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="rw-kat">Kategori</label><select class="input" id="rw-kat"></select></div>' +
      '<div class="field" style="min-width:260px;flex:1"><label for="rw-param">Parameter</label><select class="input" id="rw-param"></select></div>' +
      '<div class="field"><span class="lbl">Rentang</span><div class="hstack">' + [[6, '6 bln'], [12, '12 bln'], [0, 'Semua'], [-1, 'Pilih bulan']].map(x => '<button class="chip" data-rg="' + x[0] + '" aria-pressed="' + (RW.rentang === x[0]) + '">' + (x[0] === -1 ? ic('calendar-days') : '') + x[1] + '</button>').join('') + '</div></div>' +
      (RW.rentang === -1 ? '<div class="rentang-kustom"><div class="field"><label for="rw-dari">Dari bulan</label><select class="input" id="rw-dari">' + opsiBulan(RW.dari) + '</select></div>' +
        '<span class="rk-sd" aria-hidden="true">s.d.</span><div class="field"><label for="rw-sampai">Sampai bulan</label><select class="input" id="rw-sampai">' + opsiBulan(RW.sampai) + '</select></div>' +
        '<span class="small muted rk-info">' + (selisihBulan(RW.dari, RW.sampai) + 1) + ' bulan</span></div>' : '') +
      '</div></div><div id="rw-isi" class="stack"><div class="skel" style="height:110px"></div><div class="skel" style="height:320px"></div></div>';
    $('#rw-rs', el).addEventListener('change', e => { RW.rs = e.target.value; RW.alat = ''; RW.param = ''; Halaman.riwayat.render(el); });
    $('#rw-alat', el).addEventListener('change', e => { RW.alat = e.target.value; RW.param = ''; RW.kat = ''; Halaman.riwayat.render(el); });
    $$('[data-rg]', el).forEach(b => b.addEventListener('click', () => { RW.rentang = Number(b.dataset.rg); Halaman.riwayat.render(el); }));
    ['dari', 'sampai'].forEach(k => { const s = $('#rw-' + k, el); if (s) s.addEventListener('change', e => { RW[k] = e.target.value; Halaman.riwayat.render(el); }); });
    if (!a) { $('#rw-isi', el).innerHTML = kosong('Belum ada alat', 'Rumah sakit ini belum punya alat terdaftar.'); return; }
    if (!(await muatSesiSejak(dari))) return;
    const sesi = AppState.sesi.filter(s => s.alat_id === a.alat_id && s.status_sesi === 'FINAL' && s.periode >= dari && s.periode <= sampai).sort((x, y) => x.periode < y.periode ? -1 : 1);
    if (!(await muatHasil(sesi.map(s => s.sesi_id)))) return;
    if (!document.body.contains(el) || RW.alat !== a.alat_id) return;
    // daftar parameter: gabungan template sekarang + riwayat
    const peta = {};
    paramsTpl(a.template_id).forEach(p => { if (p.tipe_toleransi !== 'TIDAK_ADA' || p.tipe_input !== 'KUALITATIF') peta[p.kode] = { kode: p.kode, nama: p.nama, kategori: p.kategori, satuan: p.satuan, tol: p.tipe_toleransi, tipe: p.tipe_input }; });
    sesi.forEach(s => (AppState.hasil[s.sesi_id] || []).forEach(h => { if (!peta[h.kode]) peta[h.kode] = { kode: h.kode, nama: h.nama, kategori: h.kategori, satuan: h.satuan, tol: h.tipe_toleransi, tipe: h.tipe_input }; }));
    const semua = Object.values(peta).sort((x, y) => VR_KATEGORI.indexOf(x.kategori) - VR_KATEGORI.indexOf(y.kategori));
    const katAda = VR_KATEGORI.filter(k => semua.some(p => p.kategori === k));
    if (RW.kat && katAda.indexOf(RW.kat) === -1) RW.kat = '';
    const daftar = semua.filter(p => !RW.kat || p.kategori === RW.kat);
    if (!daftar.find(p => p.kode === RW.param)) {
      const terakhir = sesi.length ? (AppState.hasil[sesi[sesi.length - 1].sesi_id] || []) : [];
      const gagal = terakhir.find(h => h.status === 'GAGAL' && daftar.find(p => p.kode === h.kode));
      RW.param = gagal ? gagal.kode : ((daftar.find(p => p.tol !== 'TIDAK_ADA' && p.tipe !== 'KUALITATIF') || daftar[0] || {}).kode || '');
    }
    $('#rw-kat', el).innerHTML = '<option value="">Semua kategori</option>' + katAda.map(k => '<option' + (k === RW.kat ? ' selected' : '') + '>' + esc(k) + '</option>').join('');
    $('#rw-param', el).innerHTML = daftar.map(p => '<option value="' + p.kode + '"' + (p.kode === RW.param ? ' selected' : '') + '>' + esc(p.nama + (p.tol === 'TIDAK_ADA' ? ' (data)' : '')) + '</option>').join('');
    $('#rw-kat', el).addEventListener('change', e => { RW.kat = e.target.value; RW.param = ''; Halaman.riwayat.render(el); });
    $('#rw-param', el).addEventListener('change', e => { RW.param = e.target.value; Halaman.riwayat.render(el); });
    $('#csv', el).addEventListener('click', () => eksporCsvAlat(a, sesi, RW.rentang === -1 ? dari + '_' + sampai : ''));
    gambarRiwayat($('#rw-isi', el), a, sesi, peta[RW.param], dari, sampai);
  }
});

function gambarRiwayat(box, a, sesi, p, dari, per) {
  if (!p) { box.innerHTML = '<div class="card">' + kosong('Belum ada parameter', 'Template alat ini belum punya parameter.') + '</div>'; return; }
  const bulan = [];
  const awal = sesi.length && !RW.rentang ? sesi[0].periode : dari;
  for (let b = awal; b <= per; b = vrGeserPeriode(b, 1)) bulan.push(b);
  const titik = bulan.map(b => {
    const s = sesi.find(x => x.periode === b);
    const h = s ? (AppState.hasil[s.sesi_id] || []).find(x => x.kode === p.kode) : null;
    return { b, s, h, v: h && h.status !== 'NA' ? vrAngka(h.nilai) : null };
  });
  const ada = titik.filter(t => t.h);
  const numerik = p.tipe !== 'KUALITATIF';
  const nilai = ada.filter(t => t.v !== null).map(t => t.v);
  const dinilai = ada.filter(t => ['LULUS', 'GAGAL'].indexOf(t.h.status) > -1);
  const lulus = dinilai.filter(t => t.h.status === 'LULUS').length;
  const last = ada[ada.length - 1];
  const d = last ? last.h.desimal : 2;
  const fmt = v => v === null || v === undefined ? '—' : vrFormat(v, d, sep());
  const u = p.satuan ? ' ' + p.satuan : '';
  const kriteria = last ? vrTeksToleransi(last.h, last.h.min_terpakai === '' ? null : vrAngka(last.h.min_terpakai), last.h.maks_terpakai === '' ? null : vrAngka(last.h.maks_terpakai), sep()) : '';
  const lebihRendah = nilai.length ? Math.min.apply(null, nilai) : null, lebihTinggi = nilai.length ? Math.max.apply(null, nilai) : null;
  box.innerHTML =
    '<div class="card card-b"><div class="hstack between"><div><div class="hstack"><span class="tag">' + esc(p.kode) + '</span><h2>' + esc(p.nama) + '</h2></div>' +
    '<div class="small muted mono" style="margin-top:4px">' + esc(p.kategori) + ' · ' + esc(VR_TIPE_TOL[p.tol] || '') + (kriteria ? ' · Kriteria ' + esc(kriteria) : '') + '</div></div>' +
    (last ? badge(last.h.status) : '') + '</div></div>' +
    '<div class="row r-kpi">' +
    kpi('Nilai terakhir' + (last ? ' (' + singkatBulan(last.b) + ')' : ''), last ? (numerik ? fmt(last.v) : (last.h.status === 'NA' ? 'N/A' : last.h.nilai)) : '—', numerik && last ? p.satuan : '', 'gauge', last ? (last.h.status === 'GAGAL' ? 'Di luar toleransi' : 'Dalam toleransi') : 'Belum ada data', last && last.h.status === 'GAGAL' ? 'is-fail' : '') +
    (numerik ? kpi('Rata-rata', nilai.length ? fmt(nilai.reduce((x, y) => x + y, 0) / nilai.length) : '—', p.satuan, 'sigma', nilai.length + ' pengukuran') +
      kpi('Terendah', fmt(lebihRendah), p.satuan, 'arrow-down', lebihRendah !== null ? singkatBulan((ada.find(t => t.v === lebihRendah) || {}).b) : '') +
      kpi('Tertinggi', fmt(lebihTinggi), p.satuan, 'arrow-up', lebihTinggi !== null ? singkatBulan((ada.find(t => t.v === lebihTinggi) || {}).b) : '')
      : kpi('Dinilai', dinilai.length, '', 'list-checks', 'sesi final') + kpi('Lulus', lulus, '', 'circle-check', '') + kpi('Gagal', dinilai.length - lulus, '', 'circle-x', '')) +
    '</div>' +
    '<div class="card"><div class="card-h"><h2>' + ic('chart-line') + 'Grafik tren & batas toleransi</h2><span class="small muted">' + (bulan.length ? esc(singkatBulan(bulan[0]) + ' – ' + singkatBulan(bulan[bulan.length - 1])) + ' · ' : '') + 'Kelulusan ' + lulus + '/' + dinilai.length + '</span></div><div class="card-b"><div class="chart" id="rw-grafik"></div></div></div>' +
    '<div class="card"><div class="card-h"><h2>' + ic('list') + 'Log pengukuran</h2><div class="field" style="min-width:220px"><input class="input" id="rw-cari" placeholder="Cari periode, catatan, penguji…" value="' + esc(RW.cari) + '"></div></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Periode</th><th>Tanggal uji</th><th class="c">Nilai</th><th class="c">Kriteria</th><th class="c">Status</th><th>Penguji</th><th>Catatan</th></tr></thead><tbody id="rw-tbody"></tbody></table></div>' +
    '<div class="tbl-foot"><span id="rw-n"></span><span>Hanya sesi final yang ditampilkan.</span></div></div>';
  // grafik
  const g = $('#rw-grafik', box);
  if (numerik && nilai.length) {
    const garis = [], zona = [];
    if (last) {
      const mn = last.h.min_terpakai === '' ? null : vrAngka(last.h.min_terpakai), mk = last.h.maks_terpakai === '' ? null : vrAngka(last.h.maks_terpakai);
      if (['MIN', 'LEBIH', 'RENTANG'].indexOf(last.h.tipe_toleransi) > -1 && mn !== null) { garis.push({ y: mn, label: 'Batas min ' + vrAngkaRingkas(mn, sep()) + u }); zona.push([-1e12, mn]); }
      if (['MAKS', 'KURANG', 'RENTANG'].indexOf(last.h.tipe_toleransi) > -1 && mk !== null) { garis.push({ y: mk, label: 'Batas maks ' + vrAngkaRingkas(mk, sep()) + u }); zona.push([mk, 1e12]); }
      if (last.h.tipe_toleransi === 'MUTLAK_PM' && mk !== null) { garis.push({ y: Math.abs(mk), label: '+' + vrAngkaRingkas(Math.abs(mk), sep()) }); garis.push({ y: -Math.abs(mk), label: '−' + vrAngkaRingkas(Math.abs(mk), sep()) }); zona.push([Math.abs(mk), 1e12]); zona.push([-1e12, -Math.abs(mk)]); }
    }
    const seri = [{ nama: 'Nilai terukur' + u, warna: '#F37021', nilai: titik.map(t => t.v), tandaGagal: titik.map(t => t.h && t.h.status === 'GAGAL') }];
    g.innerHTML = legendaGrafik(seri, garis) + grafikGaris({ labels: bulan.map(singkatBulan), seri, garis, zonaGagal: zona, tinggi: 300, labelNilai: bulan.length <= 12, desimal: Number(d), judul: p.nama });
  } else if (!numerik && ada.length) {
    g.innerHTML = '<div class="hstack" style="gap:12px">' + titik.map(t => '<div style="text-align:center"><div class="small muted mono">' + esc(singkatBulan(t.b)) + '</div>' + (t.h ? badge(t.h.status, t.h.status === 'NA' ? 'N/A' : t.h.nilai) : '<span class="b-none">—</span>') + '</div>').join('') + '</div>';
  } else g.innerHTML = kosong('Belum ada data', 'Belum ada sesi final untuk parameter ini dalam rentang terpilih.');
  // tabel
  const tb = $('#rw-tbody', box);
  function isiTabel() {
    const q = RW.cari.toLowerCase();
    const rows = ada.slice().reverse().filter(t => !q || [vrNamaPeriode(t.b), t.s.catatan, t.s.penguji_nama, t.s.penguji_email, t.h.nilai].join(' ').toLowerCase().indexOf(q) > -1);
    tb.innerHTML = rows.map(t => '<tr class="' + (t.h.status === 'GAGAL' ? 'is-fail' : '') + '"><td><b>' + esc(vrNamaPeriode(t.b)) + '</b></td><td class="m">' + esc(vrTanggalPanjang(t.s.tanggal)) + '</td>' +
      '<td class="num">' + (t.h.status === 'NA' ? 'N/A' : numerik ? esc(fmt(t.v)) + '<span class="small muted">' + esc(u) + '</span>' : esc(t.h.nilai)) + '</td>' +
      '<td class="c m">' + esc(vrTeksToleransi(t.h, t.h.min_terpakai === '' ? null : vrAngka(t.h.min_terpakai), t.h.maks_terpakai === '' ? null : vrAngka(t.h.maks_terpakai), sep())) + '</td>' +
      '<td class="c">' + badge(t.h.status) + '</td><td>' + esc(t.s.penguji_nama || t.s.penguji_email) + '</td><td class="small">' + esc(t.h.status === 'NA' ? t.h.alasan_na : t.s.catatan) + '</td></tr>').join('') ||
      '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Tidak ada data yang cocok.</td></tr>';
    $('#rw-n', box).textContent = 'Menampilkan ' + rows.length + ' dari ' + ada.length + ' sesi';
  }
  isiTabel();
  $('#rw-cari', box).addEventListener('input', debounce(e => { RW.cari = e.target.value; isiTabel(); }, 200));
}

function selisihBulan(a, b) { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); }

function eksporCsvAlat(a, sesi, akhiran) {
  const rs = getRs(a.rs_id) || {};
  const baris = [['RS', 'Kode alat', 'Merek', 'Tipe', 'No seri tabung', 'Periode', 'Tanggal uji', 'Kategori', 'Kelompok', 'Kode parameter', 'Parameter', 'Nilai', 'Satuan', 'Kriteria', 'Status', 'Alasan N/A', 'Penguji']];
  sesi.forEach(s => (AppState.hasil[s.sesi_id] || []).forEach(h => baris.push([rs.nama, a.kode, a.merek, a.tipe, a.no_seri_tabung, s.periode, s.tanggal, h.kategori, h.kelompok, h.kode, h.nama,
    h.status === 'NA' ? '' : (h.tipe_input === 'KUALITATIF' ? h.nilai : vrFormat(h.nilai, h.desimal, sep())), h.satuan,
    vrTeksToleransi(h, h.min_terpakai === '' ? null : vrAngka(h.min_terpakai), h.maks_terpakai === '' ? null : vrAngka(h.maks_terpakai), sep()), LABEL_STATUS[h.status] || h.status, h.alasan_na, s.penguji_nama || s.penguji_email])));
  if (baris.length === 1) return toast('Belum ada data final untuk diekspor.', 'warning');
  unduhCsv('Riwayat_QC_' + (rs.kode || 'RS') + '_' + a.kode + (akhiran ? '_' + akhiran : '') + '.csv', baris);
}
