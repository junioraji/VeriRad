/* =====================================================================
 * VeriRad — Template Toleransi: parameter, rumus, dan batas per jenis alat
 * Perubahan disimpan sebagai versi baru; sesi final lama memakai snapshot.
 * ===================================================================== */
'use strict';

const TP = { id: '', kat: '', meta: null, params: null, kotor: false };

daftarHalaman('template', {
  judul: 'Template Toleransi', akses: 'fismed',
  render(el) {
    const list = AppState.templates.slice().sort((a, b) => (vrBenar(b.aktif) - vrBenar(a.aktif)) || a.nama.localeCompare(b.nama));
    if (!TP.id || (TP.id !== 'BARU' && !getTpl(TP.id))) pilihTemplate(list[0] ? list[0].template_id : 'BARU');
    el.innerHTML = '<div class="page-h"><div><h1>Template Toleransi & Rumus QC</h1><p>Parameter uji, rumus hitung otomatis, dan batas toleransi untuk setiap jenis alat.</p></div>' +
      '<div class="act"><button class="btn" id="tp-dup"' + (TP.id === 'BARU' ? ' disabled' : '') + '>' + ic('copy') + 'Duplikat</button><button class="btn btn-primary" id="tp-baru">' + ic('plus') + 'Template baru</button></div></div>' +
      '<div class="banner banner-warn">' + ic('scale') + '<div class="t small"><b>Tanggung jawab fisikawan medis.</b> Template bawaan hanyalah titik awal dari contoh laporan. Verifikasi setiap batas terhadap acuan yang berlaku. ' +
      'Menyimpan template membuat versi baru; sesi QC final yang sudah ada tetap memakai toleransi saat diuji.</div></div>' +
      '<div class="row r-1-2"><div class="list-rs">' + list.map(t => {
        const n = paramsTpl(t.template_id).filter(p => vrBenar(p.aktif)), al = AppState.alat.filter(a => a.template_id === t.template_id && vrBenar(a.aktif)).length;
        const ragu = n.filter(p => /⚠/.test(p.keterangan || '')).length;
        return '<button class="rs-card card" data-t="' + t.template_id + '" aria-pressed="' + (t.template_id === TP.id) + '"><span class="hstack between"><span class="nm">' + esc(t.nama) + '</span><span class="tag tag-soft">v' + esc(t.versi) + '</span></span>' +
          '<span class="small muted">' + n.length + ' parameter · ' + n.filter(p => p.tipe_toleransi !== 'TIDAK_ADA').length + ' dinilai · ' + al + ' alat</span>' +
          (ragu ? '<span class="small" style="color:var(--orange-text)">⚠ ' + ragu + ' butir perlu keputusan</span>' : '') + (vrBenar(t.aktif) ? '' : '<span class="badge b-na">Nonaktif</span>') + '</button>';
      }).join('') + '</div><div class="stack" id="tp-kanan"></div></div>';
    $$('[data-t]', el).forEach(b => b.addEventListener('click', async () => {
      if (TP.kotor && !(await konfirmasi('Buang perubahan?', 'Perubahan pada template ' + (TP.meta.nama || '') + ' belum disimpan.', 'Buang perubahan', true))) return;
      pilihTemplate(b.dataset.t); Halaman.template.render(el);
    }));
    $('#tp-baru', el).addEventListener('click', async () => {
      if (TP.kotor && !(await konfirmasi('Buang perubahan?', 'Perubahan template saat ini belum disimpan.', 'Buang perubahan', true))) return;
      pilihTemplate('BARU'); Halaman.template.render(el);
    });
    $('#tp-dup', el).addEventListener('click', () => {
      const asal = TP.meta;
      TP.id = 'BARU'; TP.meta = { template_id: '', nama: asal.nama + ' (salinan)', singkatan: asal.singkatan, aktif: 'TRUE', versi: '0' }; TP.kotor = true;
      Halaman.template.render(el);
      toast('Salinan dibuat. Ubah namanya lalu simpan.', 'info');
    });
    gambarTemplateKanan($('#tp-kanan', el), el);
  }
});

function pilihTemplate(id) {
  TP.id = id; TP.kat = ''; TP.kotor = false;
  if (id === 'BARU') { TP.meta = { template_id: '', nama: '', singkatan: '', aktif: 'TRUE', versi: '0' }; TP.params = []; return; }
  const t = getTpl(id);
  TP.meta = Object.assign({}, t);
  TP.params = vrUrutParam(paramsTpl(id)).map(p => Object.assign({}, p));
}

function gambarTemplateKanan(box, el) {
  const ps = TP.params, tampil = vrUrutParam(ps).filter(p => !TP.kat || p.kategori === TP.kat);
  const kode = ps.filter(p => vrBenar(p.aktif)).map(p => p.kode);
  const err = {};
  ps.filter(p => vrBenar(p.aktif)).forEach(p => { const m = validasiParamLokal(p, kode); if (m) err[p.kode] = m; });
  if (!Object.keys(err).length && ps.length) {
    const ev = vrEvaluasi(ps, {}, '.');
    Object.keys(ev).forEach(k => { if (ev[k].status === 'ERROR' && ev[k].pesan) err[k] = ev[k].pesan; });
  }
  box.innerHTML = '<div class="card"><div class="card-h"><h2>' + ic('sliders-horizontal') + (TP.id === 'BARU' ? 'Template baru' : esc(TP.meta.nama)) + '</h2>' + (TP.id !== 'BARU' ? '<span class="tag tag-soft">versi ' + esc(TP.meta.versi) + '</span>' : '') + '</div>' +
    '<div class="card-b grid-3"><div class="field"><label for="tp-nama">Nama jenis alat <span class="req">*</span></label><input class="input" id="tp-nama" value="' + esc(TP.meta.nama) + '" placeholder="mis. Fluoroskopi"></div>' +
    '<div class="field"><label for="tp-sing">Singkatan</label><input class="input" id="tp-sing" maxlength="6" value="' + esc(TP.meta.singkatan || '') + '" placeholder="mis. FL"></div>' +
    '<div class="field"><span class="lbl">Status</span><label class="switch" style="height:38px"><input type="checkbox" id="tp-aktif"' + (vrBenar(TP.meta.aktif) ? ' checked' : '') + '><span class="trk"></span>Aktif untuk alat baru</label></div></div>' +
    '<div class="card-b" style="padding-top:0"><div class="stat-cells"><div><div class="k">Total parameter</div><div class="v">' + ps.length + '</div></div><div><div class="k">Dinilai</div><div class="v">' + ps.filter(p => p.tipe_toleransi !== 'TIDAK_ADA' && vrBenar(p.aktif)).length + '</div></div>' +
    '<div><div class="k">Rumus otomatis</div><div class="v">' + ps.filter(p => p.tipe_input === 'HITUNG').length + '</div></div><div class="' + (Object.keys(err).length ? 'gagal' : 'lulus') + '"><div class="k">Error validasi</div><div class="v">' + Object.keys(err).length + '</div></div></div></div></div>' +
    '<div class="card"><div class="tabs" style="padding:0 12px"><button data-k="" aria-selected="' + !TP.kat + '">Semua <span class="cnt">' + ps.length + '</span></button>' +
    VR_KATEGORI.map((k, i) => '<button data-k="' + k + '" aria-selected="' + (TP.kat === k) + '">' + (i + 1) + '. ' + esc(k) + ' <span class="cnt">' + ps.filter(p => p.kategori === k).length + '</span></button>').join('') + '</div>' +
    (tampil.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Urut</th><th>Parameter</th><th>Input & rumus</th><th>Toleransi</th><th class="c">Wajib</th><th class="c">N/A</th><th class="c">Aktif</th><th></th></tr></thead><tbody>' +
      tampil.map(p => '<tr class="' + (err[p.kode] ? 'is-fail' : '') + '"><td class="m">' + esc(p.urutan) + '</td><td><span class="tag tag-soft">' + esc(p.kode) + '</span> <b>' + esc(p.nama) + '</b><span class="sub">' + esc(p.kategori + ' · ' + (p.kelompok || 'Umum')) + '</span>' +
        (p.keterangan ? '<span class="sub" style="color:var(--orange-text)">' + esc(p.keterangan) + '</span>' : '') + (err[p.kode] ? '<span class="err-msg">' + ic('circle-alert') + esc(err[p.kode]) + '</span>' : '') + '</td>' +
        '<td class="small">' + esc(VR_TIPE_INPUT[p.tipe_input] || p.tipe_input) + (p.satuan ? ' · <span class="mono">' + esc(p.satuan) + '</span>' : '') + (p.tipe_input === 'HITUNG' ? '<span class="sub mono">= ' + esc(p.formula) + '</span>' : p.tipe_input === 'KUALITATIF' ? '<span class="sub">' + esc(p.opsi.split('|').join(' / ')) + '</span>' : '') + '</td>' +
        '<td class="m">' + (p.tipe_toleransi === 'TIDAK_ADA' ? '<span class="muted">data</span>' : esc(vrTeksToleransi(p, null, null, sep()))) + '<span class="sub">' + esc((VR_TIPE_TOL[p.tipe_toleransi] || '').split(' (')[0]) + '</span></td>' +
        '<td class="c">' + (vrBenar(p.wajib) ? '✓' : '—') + '</td><td class="c">' + (vrBenar(p.boleh_na) ? '✓' : '—') + '</td><td class="c">' + (vrBenar(p.aktif) ? '<span class="badge b-lulus">Ya</span>' : '<span class="badge b-na">Tidak</span>') + '</td>' +
        '<td><div class="hstack" style="flex-wrap:nowrap"><button class="btn btn-sm btn-ghost btn-icon" data-ed="' + p.kode + '" aria-label="Ubah ' + esc(p.kode) + '">' + ic('pencil') + '</button><button class="btn btn-sm btn-ghost btn-icon" data-del="' + p.kode + '" aria-label="Hapus ' + esc(p.kode) + '">' + ic('trash-2') + '</button></div></td></tr>').join('') +
      '</tbody></table></div>' : kosong('Belum ada parameter', 'Tambahkan parameter uji untuk kategori ini.')) +
    '<div class="card-f" style="justify-content:flex-start"><button class="btn btn-dashed" id="tp-tambah">' + ic('plus') + 'Tambah parameter</button></div></div>' +
    '<div class="sticky-bar"><span class="sp small ' + (TP.kotor ? '' : 'muted') + '">' + (TP.kotor ? ic('circle-dot') + ' <b>Perubahan belum disimpan</b>' : ic('circle-check') + ' Tersimpan') + '</span>' +
    (TP.kotor && TP.id !== 'BARU' ? '<button class="btn" id="tp-batal">Batalkan perubahan</button>' : '') +
    '<button class="btn btn-primary" id="tp-simpan"' + (TP.kotor ? '' : ' disabled') + '>' + ic('save') + (TP.id === 'BARU' ? 'Simpan template' : 'Simpan sebagai versi ' + ((parseInt(TP.meta.versi, 10) || 0) + 1)) + '</button></div>';
  const tandai = () => { TP.kotor = true; gambarTemplateKanan(box, el); };
  $('#tp-nama', box).addEventListener('change', e => { TP.meta.nama = e.target.value; tandai(); });
  $('#tp-sing', box).addEventListener('change', e => { TP.meta.singkatan = e.target.value; tandai(); });
  $('#tp-aktif', box).addEventListener('change', e => { TP.meta.aktif = e.target.checked ? 'TRUE' : 'FALSE'; tandai(); });
  $$('.tabs [data-k]', box).forEach(b => b.addEventListener('click', () => { TP.kat = b.dataset.k; gambarTemplateKanan(box, el); }));
  $('#tp-tambah', box).addEventListener('click', () => editorParam(null, () => tandai()));
  $$('[data-ed]', box).forEach(b => b.addEventListener('click', () => editorParam(TP.params.find(p => p.kode === b.dataset.ed), () => tandai())));
  $$('[data-del]', box).forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.del;
    const re = new RegExp('\\b' + k + '\\b');
    const dipakai = TP.params.filter(p => p.kode !== k && re.test([p.tipe_input === 'HITUNG' ? p.formula : '', vrAngka(p.batas_min) === null ? p.batas_min : '', vrAngka(p.batas_maks) === null ? p.batas_maks : ''].join(' ')));
    if (dipakai.length) return toast(k + ' dipakai di rumus ' + dipakai.map(p => p.kode).join(', ') + '. Ubah rumus itu dulu, atau nonaktifkan parameter ini.', 'warning');
    if (!(await konfirmasi('Hapus parameter ' + k + '?', 'Parameter dihapus dari template saat disimpan. Sesi final lama tetap menyimpan nilainya.', 'Hapus', true))) return;
    TP.params = TP.params.filter(p => p.kode !== k); tandai();
  }));
  const bt = $('#tp-batal', box);
  if (bt) bt.addEventListener('click', () => { pilihTemplate(TP.id); Halaman.template.render(el); });
  $('#tp-simpan', box).addEventListener('click', async e => {
    if (!String(TP.meta.nama || '').trim()) { $('#tp-nama', box).focus(); return toast('Nama template wajib diisi.', 'warning'); }
    if (Object.keys(err).length) return toast('Perbaiki ' + Object.keys(err).length + ' error validasi dulu (baris merah).', 'warning');
    setBusy(e.currentTarget, true, 'Menyimpan…');
    const r = await api('template.simpan', { template: { template_id: TP.meta.template_id, nama: TP.meta.nama, singkatan: TP.meta.singkatan, aktif: TP.meta.aktif }, params: TP.params });
    setBusy(e.currentTarget, false);
    if (!r.success) return toast(r.message, 'error');
    toast(r.message, 'success');
    TP.kotor = false; TP.id = r.data.template_id;
    await segarkanBoot(true);
    pilihTemplate(r.data.template_id); rute();
  });
}

function validasiParamLokal(p, kode) {
  if (!/^[A-Z][A-Z0-9_]{0,29}$/.test(p.kode)) return 'Kode harus huruf kapital/angka/garis bawah, diawali huruf.';
  if (p.tipe_input === 'HITUNG') { const m = vrCekRumus(p.formula, kode); if (m) return 'Rumus: ' + m; }
  if (p.tipe_input === 'KUALITATIF') {
    const o = String(p.opsi || '').split('|').map(x => x.trim()).filter(Boolean);
    if (o.length < 2) return 'Isi minimal 2 pilihan.';
    if (p.tipe_toleransi === 'KUALITATIF' && o.indexOf(String(p.acuan || '').trim()) === -1) return 'Acuan harus salah satu pilihan.';
  } else if (p.tipe_toleransi === 'KUALITATIF') return 'Toleransi "sama dengan acuan" hanya untuk tipe pilihan.';
  const perluMin = ['MIN', 'LEBIH', 'RENTANG'].indexOf(p.tipe_toleransi) > -1, perluMaks = ['MAKS', 'KURANG', 'RENTANG', 'MUTLAK_PM'].indexOf(p.tipe_toleransi) > -1;
  if (perluMin && !String(p.batas_min || '').trim()) return 'Batas minimum wajib diisi.';
  if (perluMaks && !String(p.batas_maks || '').trim()) return 'Batas maksimum wajib diisi.';
  for (const b of ['batas_min', 'batas_maks']) { const v = String(p[b] || '').trim(); if (v && vrAngka(v) === null) { const m = vrCekRumus(v, kode); if (m) return 'Batas: ' + m; } }
  return '';
}

function editorParam(p, selesai) {
  const baru = !p;
  const d = Object.assign({ kategori: TP.kat || 'Mekanik', kelompok: '', kode: '', nama: '', tipe_input: 'ANGKA', satuan: '', tipe_toleransi: 'MAKS', batas_min: '', batas_maks: '', formula: '', opsi: 'Berfungsi|Tidak Berfungsi',
    acuan: 'Berfungsi', desimal: '2', urutan: String((TP.params.reduce((m, x) => Math.max(m, Number(x.urutan) || 0), 0)) + 10), wajib: 'TRUE', boleh_na: 'FALSE', aktif: 'TRUE', keterangan: '' }, p || {});
  const kelompok = Array.from(new Set(TP.params.map(x => x.kelompok).filter(Boolean)));
  const kodeLain = TP.params.filter(x => !p || x.kode !== p.kode).map(x => x.kode);
  const m = modal({
    judul: baru ? 'Tambah parameter' : 'Ubah parameter ' + p.kode, ikon: 'sliders-horizontal', lebar: true,
    isi: '<div class="grid-3">' +
      '<div class="field"><label for="e-kat">Kategori</label><select class="input" id="e-kat">' + VR_KATEGORI.map(k => '<option' + (k === d.kategori ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="e-kel">Kelompok</label><input class="input" id="e-kel" list="dl-kel" value="' + esc(d.kelompok) + '" placeholder="mis. Iluminasi"><datalist id="dl-kel">' + kelompok.map(k => '<option value="' + esc(k) + '">').join('') + '</datalist></div>' +
      '<div class="field"><label for="e-kode">Kode unik <span class="req">*</span></label><input class="input mono" id="e-kode" value="' + esc(d.kode) + '" placeholder="mis. IL_SELISIH"' + (baru ? '' : ' readonly') + '><span class="hint">' + (baru ? 'Dipakai di rumus. Huruf kapital, angka, _' : 'Kode tidak bisa diubah (dipakai di riwayat).') + '</span></div>' +
      '<div class="field span-2"><label for="e-nama">Nama parameter <span class="req">*</span></label><input class="input" id="e-nama" value="' + esc(d.nama) + '"></div>' +
      '<div class="field"><label for="e-sat">Satuan</label><input class="input mono" id="e-sat" value="' + esc(d.satuan) + '" placeholder="lux, %, mm, HU…"></div>' +
      '<div class="field"><label for="e-tin">Tipe input</label><select class="input" id="e-tin">' + Object.keys(VR_TIPE_INPUT).map(k => '<option value="' + k + '"' + (k === d.tipe_input ? ' selected' : '') + '>' + VR_TIPE_INPUT[k] + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="e-dec">Desimal tampilan</label><input class="input mono" id="e-dec" type="number" min="0" max="6" value="' + esc(d.desimal) + '"><span class="hint">Nilai dibulatkan half-up sebelum dinilai.</span></div>' +
      '<div class="field"><label for="e-urut">Urutan</label><input class="input mono" id="e-urut" type="number" value="' + esc(d.urutan) + '"></div>' +
      '<div class="field span-2" id="w-rumus"><label for="e-rumus">Rumus</label><input class="input mono" id="e-rumus" value="' + esc(d.formula) + '" placeholder="mis. avg(IL_Q1, IL_Q2, IL_Q3, IL_Q4) - IL_LATAR">' +
      '<span class="hint">Fungsi: avg, sum, min, max, abs, sqrt, pow, round(x,d), atan, deg. Klik kode untuk menyisipkan:</span><div class="hstack" style="gap:4px">' + kodeLain.map(k => '<button type="button" class="chip" style="height:24px;font-family:var(--mono);font-size:11px" data-ins="' + k + '">' + k + '</button>').join('') + '</div></div>' +
      '<div class="field" id="w-opsi"><label for="e-opsi">Pilihan (pisahkan dengan |)</label><input class="input" id="e-opsi" value="' + esc(d.opsi) + '"></div>' +
      '<div class="field"><label for="e-tol">Tipe toleransi</label><select class="input" id="e-tol">' + Object.keys(VR_TIPE_TOL).map(k => '<option value="' + k + '"' + (k === d.tipe_toleransi ? ' selected' : '') + '>' + VR_TIPE_TOL[k] + '</option>').join('') + '</select></div>' +
      '<div class="field" id="w-min"><label for="e-min">Batas minimum</label><input class="input mono" id="e-min" value="' + esc(d.batas_min) + '" placeholder="angka atau kode"></div>' +
      '<div class="field" id="w-maks"><label for="e-maks">Batas maksimum</label><input class="input mono" id="e-maks" value="' + esc(d.batas_maks) + '" placeholder="angka atau kode"></div>' +
      '<div class="field" id="w-acuan"><label for="e-acuan">Acuan (dianggap lulus)</label><select class="input" id="e-acuan"></select></div>' +
      '<div class="field span-2"><label for="e-ket">Keterangan / sumber acuan</label><input class="input" id="e-ket" value="' + esc(d.keterangan) + '" placeholder="Tampil di form QC sebagai catatan"></div>' +
      '<div class="stack" style="gap:8px;justify-content:center"><label class="switch"><input type="checkbox" id="e-wajib"' + (vrBenar(d.wajib) ? ' checked' : '') + '><span class="trk"></span>Wajib diisi</label>' +
      '<label class="switch"><input type="checkbox" id="e-na"' + (vrBenar(d.boleh_na) ? ' checked' : '') + '><span class="trk"></span>Boleh N/A</label>' +
      '<label class="switch"><input type="checkbox" id="e-aktif"' + (vrBenar(d.aktif) ? ' checked' : '') + '><span class="trk"></span>Aktif</label></div>' +
      '</div><div class="banner banner-info small" style="margin-top:16px" id="e-prev"></div>',
    tombol: [{ label: 'Batal' }, { label: baru ? 'Tambahkan' : 'Terapkan', kelas: 'btn-primary', ikon: 'check', aksi: (bg) => {
      const n = baca(bg);
      if (!n.nama.trim()) { toast('Nama parameter wajib diisi.', 'warning'); return false; }
      if (kodeLain.indexOf(n.kode) > -1) { toast('Kode ' + n.kode + ' sudah dipakai.', 'warning'); return false; }
      const msg = validasiParamLokal(n, kodeLain.concat([n.kode]));
      if (msg) { toast(msg, 'warning'); return false; }
      if (baru) TP.params.push(n); else Object.assign(p, n);
      selesai();
    } }]
  });
  function baca(bg) {
    return Object.assign({}, d, {
      kategori: $('#e-kat', bg).value, kelompok: $('#e-kel', bg).value.trim(), kode: $('#e-kode', bg).value.trim().toUpperCase(), nama: $('#e-nama', bg).value.trim(),
      satuan: $('#e-sat', bg).value.trim(), tipe_input: $('#e-tin', bg).value, desimal: $('#e-dec', bg).value || '2', urutan: $('#e-urut', bg).value || '0',
      formula: $('#e-rumus', bg).value.trim(), opsi: $('#e-opsi', bg).value.split('|').map(x => x.trim()).filter(Boolean).join('|'), tipe_toleransi: $('#e-tol', bg).value,
      batas_min: $('#e-min', bg).value.trim(), batas_maks: $('#e-maks', bg).value.trim(), acuan: $('#e-acuan', bg).value || '',
      keterangan: $('#e-ket', bg).value.trim(), wajib: $('#e-wajib', bg).checked ? 'TRUE' : 'FALSE', boleh_na: $('#e-na', bg).checked ? 'TRUE' : 'FALSE', aktif: $('#e-aktif', bg).checked ? 'TRUE' : 'FALSE'
    });
  }
  function sinkron() {
    const tin = $('#e-tin', m).value, tol = $('#e-tol', m).value;
    $('#w-rumus', m).classList.toggle('hidden', tin !== 'HITUNG');
    $('#w-opsi', m).classList.toggle('hidden', tin !== 'KUALITATIF');
    $('#w-acuan', m).classList.toggle('hidden', tol !== 'KUALITATIF');
    $('#w-min', m).classList.toggle('hidden', ['MIN', 'LEBIH', 'RENTANG'].indexOf(tol) === -1);
    $('#w-maks', m).classList.toggle('hidden', ['MAKS', 'KURANG', 'RENTANG', 'MUTLAK_PM'].indexOf(tol) === -1);
    const opsi = $('#e-opsi', m).value.split('|').map(x => x.trim()).filter(Boolean), acu = $('#e-acuan', m);
    const cur = acu.value || d.acuan;
    acu.innerHTML = opsi.map(o => '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
    const n = baca(m), msg = validasiParamLokal(n, kodeLain.concat([n.kode]));
    $('#e-prev', m).className = 'banner small ' + (msg ? 'banner-fail' : 'banner-info');
    $('#e-prev', m).innerHTML = msg ? ic('circle-alert') + '<div class="t">' + esc(msg) + '</div>' : ic('info') + '<div class="t">Kriteria di form & laporan: <b class="mono">' + esc(n.tipe_toleransi === 'TIDAK_ADA' ? 'data pendukung (tidak dinilai)' : vrTeksToleransi(n, null, null, sep())) + '</b></div>';
  }
  $$('input, select', m).forEach(x => x.addEventListener('input', sinkron));
  $$('[data-ins]', m).forEach(b => b.addEventListener('click', () => {
    const r = $('#e-rumus', m), pos = r.selectionStart || r.value.length;
    r.value = r.value.slice(0, pos) + b.dataset.ins + r.value.slice(pos); r.focus(); sinkron();
  }));
  sinkron();
}
