/* =====================================================================
 * VeriRad — Kelola RS & Alat
 * ===================================================================== */
'use strict';

let KelRs = '';

daftarHalaman('kelola', {
  judul: 'Kelola RS & Alat', akses: 'fismed',
  render(el) {
    const semua = AppState.rs.slice().sort((a, b) => (vrBenar(b.aktif) - vrBenar(a.aktif)) || a.nama.localeCompare(b.nama));
    if (KelRs !== 'BARU' && (!KelRs || !getRs(KelRs))) KelRs = semua[0] ? semua[0].rs_id : 'BARU';
    const rs = KelRs === 'BARU' ? { rs_id: '', aktif: 'TRUE', jabatan_penandatangan: 'Kepala Instalasi Radiologi' } : getRs(KelRs);
    el.innerHTML = '<div class="page-h"><div><h1>Kelola Rumah Sakit & Alat</h1><p>Rumah sakit yang Anda pegang, penandatangan laporan, email atasan, dan daftar alat radiologi.</p></div>' +
      '<div class="act"><button class="btn btn-primary" id="rs-baru">' + ic('plus') + 'Tambah rumah sakit</button></div></div>' +
      '<div class="row r-1-2"><div class="list-rs">' + (semua.length ? semua.map(r => {
        const al = AppState.alat.filter(a => a.rs_id === r.rs_id && vrBenar(a.aktif));
        const lap = AppState.laporan.filter(l => l.rs_id === r.rs_id).sort((a, b) => a.waktu < b.waktu ? 1 : -1)[0];
        return '<button class="rs-card card" data-rs="' + r.rs_id + '" aria-pressed="' + (r.rs_id === KelRs) + '"><span class="hstack between"><span class="nm">' + esc(r.nama) + '</span>' + (vrBenar(r.aktif) ? (r.kode ? '<span class="tag tag-soft">' + esc(r.kode) + '</span>' : '') : '<span class="badge b-na">Nonaktif</span>') + '</span>' +
          '<span class="small muted">' + esc(r.alamat || 'Alamat belum diisi') + '</span>' +
          '<span class="small">' + ic('user') + ' ' + esc(r.nama_penandatangan || '—') + '</span>' +
          '<span class="hstack between small"><span class="muted">' + al.length + ' alat aktif</span><span class="muted">' + (lap ? 'Laporan ' + esc(singkatBulan(lap.periode)) : 'Belum ada laporan') + '</span></span></button>';
      }).join('') : '') +
      '<button class="btn btn-dashed btn-block" id="rs-baru-2">' + ic('circle-plus') + 'Tambah rumah sakit baru</button></div>' +
      '<div class="stack"><div class="card" id="rs-form"></div>' + (rs.rs_id ? '<div class="card" id="alat-box"></div>' : '') + '</div></div>';
    $$('[data-rs]', el).forEach(b => b.addEventListener('click', () => { KelRs = b.dataset.rs; Halaman.kelola.render(el); }));
    ['#rs-baru', '#rs-baru-2'].forEach(s => $(s, el).addEventListener('click', () => { KelRs = 'BARU'; Halaman.kelola.render(el); setTimeout(() => $('#f-nama') && $('#f-nama').focus(), 50); }));
    formRs($('#rs-form', el), rs, el);
    if (rs.rs_id) daftarAlat($('#alat-box', el), rs);
  }
});

function formRs(box, rs, el) {
  const baru = !rs.rs_id;
  box.innerHTML = '<div class="card-h"><h2>' + ic('building-2') + (baru ? 'Rumah sakit baru' : 'Profil ' + esc(rs.nama)) + '</h2>' + (baru ? '' : '<span class="small muted mono">' + esc(rs.rs_id) + '</span>') + '</div>' +
    '<form class="card-b" id="f-rs" novalidate><div class="hstack" style="align-items:flex-start;gap:20px">' +
    (baru ? '' : '<div class="stack" style="gap:8px;align-items:center"><div class="logo-box xbox" id="logo-box"><span class="small muted">Logo</span></div><label class="btn btn-sm">' + ic('upload') + 'Ganti logo<input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" id="f-logo"></label></div>') +
    '<div class="grid-2" style="flex:1;min-width:260px">' +
    fld('f-nama', 'Nama rumah sakit', rs.nama, true, 'span-2') + fld('f-kode', 'Kode singkat', rs.kode, false, '', 'mis. RSHS') + fld('f-telp', 'Telepon', rs.telepon) +
    '<div class="field span-2"><label for="f-alamat">Alamat (kop laporan)</label><textarea class="input" id="f-alamat" rows="2" style="min-height:60px">' + esc(rs.alamat || '') + '</textarea></div>' +
    fld('f-pnama', 'Nama penandatangan "Mengetahui"', rs.nama_penandatangan, false, '', 'mis. dr. Budi Santoso, Sp.Rad.') + fld('f-pjab', 'Jabatan penandatangan', rs.jabatan_penandatangan) +
    fld('f-pnip', 'NIP / nomor identitas', rs.nip_penandatangan) +
    '<div class="field"><span class="lbl">Status</span><label class="switch" style="height:38px"><input type="checkbox" id="f-aktif"' + (vrBenar(rs.aktif) ? ' checked' : '') + '><span class="trk"></span>Aktif</label></div>' +
    fld('f-atasan', 'Email atasan penerima laporan', rs.email_atasan, false, 'span-2', 'pisahkan dengan koma') +
    fld('f-cc', 'Email tembusan (CC)', rs.email_cc, false, 'span-2', 'opsional') +
    '</div></div></form><div class="card-f">' + (baru ? '<button class="btn" id="f-batal">Batal</button>' : '') + '<button class="btn btn-primary" id="f-simpan">' + ic('save') + 'Simpan</button></div>';
  if (!baru) dataUriBerkas(rs.logo_file_id).then(u => { const b = $('#logo-box'); if (u && b) { b.classList.remove('xbox'); b.innerHTML = '<img src="' + u + '" alt="Logo ' + esc(rs.nama) + '">'; } });
  const fl = $('#f-logo', box);
  if (fl) fl.addEventListener('change', async () => {
    const f = fl.files[0]; if (!f) return;
    try {
      const b = await bacaBerkas(f, { maks: 600 });
      const r = await api('file.unggah', { jenis: 'logo', rs_id: rs.rs_id, nama: b.nama, mime: b.mime, base64: b.base64 });
      if (!r.success) return toast(r.message, 'error');
      rs.logo_file_id = r.data.file_id; AppState.berkas[r.data.file_id] = b.dataUri;
      toast('Logo tersimpan.', 'success'); formRs(box, rs, el);
    } catch (e) { toast(e.message, 'error'); }
  });
  const bt = $('#f-batal', box);
  if (bt) bt.addEventListener('click', () => { KelRs = ''; Halaman.kelola.render(el); });
  $('#f-simpan', box).addEventListener('click', async e => {
    const nama = $('#f-nama', box);
    nama.classList.toggle('is-error', !nama.value.trim());
    if (!nama.value.trim()) { nama.focus(); return toast('Nama rumah sakit wajib diisi.', 'warning'); }
    const em = vrDaftarEmail($('#f-atasan', box).value).concat(vrDaftarEmail($('#f-cc', box).value)).filter(x => !emailOk(x));
    if (em.length) return toast('Email tidak valid: ' + em.join(', '), 'warning');
    setBusy(e.currentTarget, true, 'Menyimpan…');
    const r = await api('rs.simpan', { rs_id: rs.rs_id, nama: nama.value, kode: $('#f-kode', box).value, telepon: $('#f-telp', box).value, alamat: $('#f-alamat', box).value,
      nama_penandatangan: $('#f-pnama', box).value, jabatan_penandatangan: $('#f-pjab', box).value, nip_penandatangan: $('#f-pnip', box).value,
      email_atasan: $('#f-atasan', box).value, email_cc: $('#f-cc', box).value, aktif: $('#f-aktif', box).checked });
    setBusy(e.currentTarget, false);
    if (!r.success) return toast(r.message, 'error');
    const i = AppState.rs.findIndex(x => x.rs_id === r.data.rs_id);
    if (i > -1) AppState.rs[i] = r.data; else AppState.rs.push(r.data);
    KelRs = r.data.rs_id;
    toast(r.message, 'success'); renderShell(); rute();
  });
}
function fld(id, label, val, wajib, kelas, ph) {
  return '<div class="field ' + (kelas || '') + '"><label for="' + id + '">' + esc(label) + (wajib ? ' <span class="req">*</span>' : '') + '</label><input class="input" id="' + id + '" value="' + esc(val || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></div>';
}

function daftarAlat(box, rs) {
  const alat = AppState.alat.filter(a => a.rs_id === rs.rs_id).sort((a, b) => (vrBenar(b.aktif) - vrBenar(a.aktif)) || a.kode.localeCompare(b.kode));
  box.innerHTML = '<div class="card-h"><h2>' + ic('scan-line') + 'Inventaris alat · ' + esc(rs.nama) + '</h2><button class="btn btn-primary btn-sm" id="alat-baru">' + ic('plus') + 'Tambah alat</button></div>' +
    (alat.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Jenis</th><th>Merek & tipe</th><th>No. seri tabung</th><th>Ruangan</th><th class="c">QC ' + esc(singkatBulan(AppState.periode)) + '</th><th class="c">Status</th><th></th></tr></thead><tbody>' +
      alat.map(a => '<tr><td><b class="mono">' + esc(a.kode) + '</b></td><td>' + esc((getTpl(a.template_id) || {}).nama || '?') + '</td><td>' + esc(a.merek + ' ' + a.tipe) + '</td><td class="m">' + esc(a.no_seri_tabung) + '</td><td>' + esc(a.ruangan) + '</td>' +
        '<td class="c">' + badge(statusAlat(a.alat_id, AppState.periode).st) + '</td><td class="c">' + (vrBenar(a.aktif) ? '<span class="badge b-lulus">Aktif</span>' : '<span class="badge b-na">Nonaktif</span>') + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-edit="' + a.alat_id + '">' + ic('pencil') + 'Ubah</button></td></tr>').join('') + '</tbody></table></div>'
      : kosong('Belum ada alat', 'Daftarkan alat radiologi di rumah sakit ini.', '<button class="btn btn-primary" id="alat-baru-2">' + ic('plus') + 'Tambah alat</button>'));
  $('#alat-baru', box).addEventListener('click', () => modalAlat(rs, null));
  const b2 = $('#alat-baru-2', box); if (b2) b2.addEventListener('click', () => modalAlat(rs, null));
  $$('[data-edit]', box).forEach(b => b.addEventListener('click', () => modalAlat(rs, getAlat(b.dataset.edit))));
}

function modalAlat(rs, a) {
  a = a || { aktif: 'TRUE' };
  const tpl = AppState.templates.filter(t => vrBenar(t.aktif) || t.template_id === a.template_id);
  const adaSesi = a.alat_id && AppState.sesi.some(s => s.alat_id === a.alat_id);
  modal({
    judul: a.alat_id ? 'Ubah alat ' + a.kode : 'Tambah alat di ' + rs.nama, ikon: 'scan-line',
    isi: '<div class="grid-2"><div class="field span-2"><label for="m-tpl">Jenis alat (template QC) <span class="req">*</span></label><select class="input" id="m-tpl"' + (adaSesi ? ' disabled' : '') + '>' +
      '<option value="">Pilih…</option>' + tpl.map(t => '<option value="' + t.template_id + '"' + (t.template_id === a.template_id ? ' selected' : '') + '>' + esc(t.nama) + '</option>').join('') + '</select>' +
      (adaSesi ? '<span class="hint">Jenis tidak bisa diganti karena alat sudah punya riwayat QC.</span>' : '<span class="hint">Menentukan parameter dan toleransi pada form QC.</span>') + '</div>' +
      fld('m-kode', 'Kode alat', a.kode, true, '', 'mis. RU-01') + fld('m-ruang', 'Ruangan / lokasi', a.ruangan, false, '', 'mis. Ruang Radiologi 1') +
      fld('m-merek', 'Merek', a.merek, false, '', 'mis. Siemens') + fld('m-tipe', 'Tipe / model', a.tipe, false, '', 'mis. Multix Top') +
      fld('m-seri', 'Nomor seri tabung', a.no_seri_tabung, false, 'span-2') +
      '<div class="field span-2"><label for="m-cat">Catatan</label><input class="input" id="m-cat" value="' + esc(a.catatan || '') + '"></div>' +
      '<label class="switch span-2"><input type="checkbox" id="m-aktif"' + (vrBenar(a.aktif) ? ' checked' : '') + '><span class="trk"></span>Alat aktif (tampil di daftar QC bulanan)</label></div>',
    tombol: [{ label: 'Batal' }, { label: 'Simpan alat', kelas: 'btn-primary', ikon: 'save', aksi: async (bg) => {
      const tp = $('#m-tpl', bg).value, kode = $('#m-kode', bg).value.trim();
      if (!tp || !kode) { toast('Jenis alat dan kode wajib diisi.', 'warning'); return false; }
      const r = await api('alat.simpan', { alat_id: a.alat_id, rs_id: rs.rs_id, template_id: tp, kode, ruangan: $('#m-ruang', bg).value, merek: $('#m-merek', bg).value,
        tipe: $('#m-tipe', bg).value, no_seri_tabung: $('#m-seri', bg).value, catatan: $('#m-cat', bg).value, aktif: $('#m-aktif', bg).checked });
      if (!r.success) { toast(r.message, 'error'); return false; }
      const i = AppState.alat.findIndex(x => x.alat_id === r.data.alat_id);
      if (i > -1) AppState.alat[i] = r.data; else AppState.alat.push(r.data);
      toast(r.message, 'success'); renderShell(); rute();
    } }]
  });
}
