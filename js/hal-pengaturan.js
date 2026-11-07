/* =====================================================================
 * VeriRad — Pengaturan: profil fisikawan, tanda tangan, pengguna atasan,
 * format angka, dan keamanan sesi.
 * ===================================================================== */
'use strict';

daftarHalaman('pengaturan', {
  judul: 'Pengaturan', akses: 'fismed',
  render(el) {
    const p = AppState.pengaturan, v3 = window.relayAktif && relayAktif();
    el.innerHTML = '<div class="page-h"><div><h1>Pengaturan</h1><p>Langganan, profil fisikawan medis, tanda tangan laporan, dan siapa saja yang boleh membuka VeriRad.</p></div></div>' +
      kartuLangganan() +
      '<div class="row r-1-1">' +
      '<div class="card"><div class="card-h"><h2>' + ic('id-card') + 'Profil fisikawan medis</h2></div><div class="card-b stack">' +
      '<div class="field"><label for="p-nama">Nama lengkap & gelar <span class="req">*</span></label><input class="input" id="p-nama" value="' + esc(p.nama_fismed || '') + '" placeholder="mis. Andi Pratama, S.Si., M.Si."></div>' +
      '<div class="field"><label for="p-izin">Nomor izin bawaan (STR/SIP)</label><input class="input" id="p-izin" value="' + esc(p.no_izin || '') + '" placeholder="mis. STR 1234…"><span class="hint">Dipakai bila nomor SIP untuk RS tertentu belum diisi di tabel per rumah sakit.</span></div>' +
      '<div class="grid-2"><div class="field"><label for="p-kota">Kota bawaan</label><input class="input" id="p-kota" value="' + esc(p.kota || '') + '" placeholder="mis. Bekasi"><span class="hint">Cadangan bila kota RS belum diisi.</span></div>' +
      '<div class="field"><label for="p-sep">Pemisah desimal</label><select class="input" id="p-sep"><option value=","' + (sep() === ',' ? ' selected' : '') + '>Koma — 85,7</option><option value="."' + (sep() === '.' ? ' selected' : '') + '>Titik — 85.7</option></select></div></div>' +
      '<div class="field"><span class="lbl">Email login</span><input class="input mono" value="' + esc(AppState.me.email) + '" readonly></div>' +
      '</div><div class="card-f"><button class="btn btn-primary" id="p-simpan">' + ic('save') + 'Simpan profil</button></div></div>' +
      '<div class="card"><div class="card-h"><h2>' + ic('signature') + 'Tanda tangan laporan</h2></div><div class="card-b stack">' +
      '<p class="small muted" style="margin:0">Gambar tanda tangan (PNG latar transparan disarankan) muncul di blok "Fisikawan Medis" pada PDF.</p>' +
      '<div class="hstack" style="gap:16px;align-items:center"><div class="logo-box xbox" id="ttd-box" style="width:220px;height:110px"><span class="small muted">Belum ada</span></div>' +
      '<label class="btn">' + ic('upload') + 'Unggah tanda tangan<input type="file" class="sr-only" id="p-ttd" accept="image/png,image/jpeg,image/webp"></label></div>' +
      '<div class="banner banner-info small">' + ic('info') + '<div class="t">Nomor SIP dan kota diatur per rumah sakit di tabel bawah, karena SIP di tiap RS berbeda.</div></div>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-h"><h2>' + ic('hospital') + 'Nomor SIP & kota per rumah sakit</h2><span class="small muted">muncul di blok tanda tangan laporan RS tersebut</span></div>' +
      (AppState.rs.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Rumah sakit</th><th style="min-width:240px">No. SIP fisikawan medis di RS ini</th><th style="min-width:180px">Kota (tanda tangan)</th><th>Pratinjau</th></tr></thead><tbody>' +
        AppState.rs.slice().sort((a, b) => a.nama.localeCompare(b.nama)).map(r => '<tr><td><b>' + esc(r.nama) + '</b>' + (vrBenar(r.aktif) ? '' : ' <span class="badge b-na">Nonaktif</span>') + '<span class="sub">' + esc(r.alamat || '') + '</span></td>' +
          '<td><input class="input mono" data-izin="' + r.rs_id + '" value="' + esc(r.no_izin_fismed || '') + '" placeholder="' + esc(p.no_izin ? 'kosong = ' + p.no_izin : 'mis. SIP 503/…') + '" aria-label="No. SIP di ' + esc(r.nama) + '"></td>' +
          '<td><input class="input" data-kota="' + r.rs_id + '" value="' + esc(r.kota || '') + '" placeholder="' + esc(p.kota ? 'kosong = ' + p.kota : 'mis. Bekasi') + '" aria-label="Kota untuk ' + esc(r.nama) + '"></td>' +
          '<td class="small" data-prev-izin="' + r.rs_id + '"></td></tr>').join('') + '</tbody></table></div>' +
        '<div class="card-f"><button class="btn btn-primary" id="izin-simpan">' + ic('save') + 'Simpan SIP & kota</button></div>'
        : '<div class="card-b">' + kosong('Belum ada rumah sakit', 'Tambahkan RS di menu Kelola RS & Alat, lalu isi nomor SIP per RS di sini.', '<a class="btn" href="#/kelola">Kelola RS & Alat</a>') + '</div>') + '</div>' +
      '<div class="card"><div class="card-h"><h2>' + ic('users') + 'Pengguna & hak akses</h2><button class="btn btn-primary btn-sm" id="u-baru">' + ic('user-plus') + 'Tautkan atasan</button></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>' + (v3 ? 'Email' : 'Email Google') + '</th><th>Peran</th><th>Rumah sakit yang bisa dilihat</th><th class="c">Status</th><th></th></tr></thead><tbody>' +
      AppState.pengguna.slice().sort((a, b) => (a.peran > b.peran ? -1 : 1)).map(u => '<tr><td><b>' + esc(u.nama || '—') + '</b><span class="sub">' + esc(u.jabatan || '') + '</span></td><td class="m">' + esc(u.email) + '</td>' +
        '<td>' + (u.peran === 'FISMED' ? '<span class="tag">Fisikawan Medis</span>' : '<span class="tag tag-soft">Atasan (lihat saja)</span>') + '</td>' +
        '<td class="small">' + (u.peran === 'FISMED' ? 'Semua RS' : esc(String(u.rs_ids || '').split(',').map(id => (getRs(id.trim()) || {}).nama || id).join(', '))) + '</td>' +
        '<td class="c">' + (vrBenar(u.aktif) ? '<span class="badge b-lulus">Aktif</span>' : '<span class="badge b-na">Nonaktif</span>') + '</td>' +
        '<td><div class="hstack" style="flex-wrap:nowrap">' + (u.email.toLowerCase() === AppState.me.email ? '<span class="small muted">Anda</span>' : (v3 && u.peran === 'ATASAN' && vrBenar(u.aktif) ? '<button class="btn btn-sm" data-tautan="' + esc(u.email) + '">' + ic('link') + 'Tautan</button>' : '') + '<button class="btn btn-sm btn-ghost" data-u="' + esc(u.email) + '">' + ic('pencil') + 'Ubah</button><button class="btn btn-sm btn-ghost btn-icon" data-hapus="' + esc(u.email) + '" aria-label="Hapus">' + ic('trash-2') + '</button>') + '</div></td></tr>').join('') +
      '</tbody></table></div><div class="tbl-foot"><span>' + (v3 ? 'Atasan tidak perlu akun: klik <b>Tautan</b> lalu kirim tautan rahasianya lewat WhatsApp/Gmail. Atasan hanya melihat Dasbor serta Riwayat & Tren RS yang dicentang. Paket VeriRad: 1 fisikawan medis, atasan tidak dibatasi.' :
        'Atasan masuk dengan akun Google-nya sendiri di alamat aplikasi yang sama dan hanya melihat Dasbor serta Riwayat & Tren RS yang dicentang. Paket VeriRad: 1 fisikawan medis, atasan tidak dibatasi.') + '</span></div></div>' +
      (v3 ? kartuImporV2() : '') +
      '<div class="row r-1-1"><div class="card"><div class="card-h"><h2>' + ic('lock') + 'Keamanan</h2></div><div class="card-b stack">' +
      (v3 ? '<p class="small muted" style="margin:0">VeriRad hanya bisa membuka berkas yang dibuatnya sendiri di Google Drive Anda (izin <span class="mono">drive.file</span>). Salinan data disimpan di perangkat ini agar cepat & bisa offline.</p>' +
        '<div><button class="btn btn-danger" id="k-semua">' + ic('log-out') + 'Keluar & hapus salinan di perangkat ini</button></div>' +
        '<p class="small muted" style="margin:0">Cabut akses kapan saja di <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Akun Google → Keamanan → Aplikasi pihak ketiga</a>. Jangan bagikan spreadsheet database VeriRad ke orang lain.</p></div></div>' :
      '<p class="small muted" style="margin:0">Sesi login berlaku 12 jam. Bila perangkat hilang atau dipinjam, akhiri semua sesi Anda.</p>' +
      '<div><button class="btn btn-danger" id="k-semua">' + ic('log-out') + 'Keluar dari semua perangkat</button></div>' +
      '<p class="small muted" style="margin:0">Data tersimpan di Google Sheets & Drive akun Anda. Jangan bagikan spreadsheet database dan jangan menambah editor proyek Apps Script sembarangan.</p></div></div>') +
      '<div class="card"><div class="card-h"><h2>' + ic('info') + 'Tentang aplikasi</h2></div><div class="card-b"><dl class="kv" style="margin:0">' +
      '<dt>Privasi</dt><dd><a href="privasi.html" target="_blank" rel="noopener">Kebijakan Privasi</a></dd><dt>Versi</dt><dd>VeriRad ' + esc(VR_VERSI) + '</dd><dt>Mode</dt><dd>' + (AppState.demo ? 'Demo (data lokal)' : v3 ? 'Google Drive Anda (langsung)' : 'Server Google Apps Script') + '</dd>' +
      (v3 ? '<dt>Database</dt><dd><a href="' + esc(DB.url()) + '" target="_blank" rel="noopener">VeriRad — Database QC</a></dd>' :
        '<dt>Backend</dt><dd>' + esc(AppState.demo ? '—' : GAS_URL.replace(/\/macros\/s\/(.{6}).*\/exec/, '/macros/s/$1…/exec')) + '</dd>') +
      '<dt>Toleransi disetujui</dt><dd title="' + esc(p.toleransi_disetujui || '') + '">' + esc(p.toleransi_disetujui ? String(p.toleransi_disetujui).slice(0, 10) : 'belum') + '</dd>' +
      '<dt>Aplikasi HP/laptop</dt><dd>' + (PWA.standalone ? 'Terpasang' : PWA.bisa() ? 'Bisa dipasang' : 'Buka di Chrome/Edge/Safari untuk memasang') + '</dd></dl>' +
      '<div style="margin-top:12px">' + tombolPasang('btn btn-sm') + '</div>' +
      (v3 ? '' : '<p class="hint" style="margin-top:12px">Ketik <span class="mono">Perf.table()</span> di console browser untuk melihat waktu respons server.</p>') + '</div></div></div>';
    pasangKartuLangganan(el);
    dataUriBerkas(p.ttd_file_id).then(u => { const b = $('#ttd-box'); if (u && b) { b.classList.remove('xbox'); b.innerHTML = '<img src="' + u + '" alt="Tanda tangan">'; } });
    $('#p-simpan', el).addEventListener('click', async e => {
      const nama = $('#p-nama', el).value.trim();
      if (!nama) { $('#p-nama', el).classList.add('is-error'); return toast('Nama wajib diisi.', 'warning'); }
      setBusy(e.currentTarget, true, 'Menyimpan…');
      const r = await api('pengaturan.simpan', { nama_fismed: nama, no_izin: $('#p-izin', el).value, kota: $('#p-kota', el).value, pemisah_desimal: $('#p-sep', el).value });
      setBusy(e.currentTarget, false);
      if (!r.success) return toast(r.message, 'error');
      AppState.pengaturan = Object.assign(AppState.pengaturan, r.data);
      toast(r.message, 'success'); rute();
    });
    $('#p-ttd', el).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const b = await bacaBerkas(f, { maks: 800 });
        const r = await api('file.unggah', { jenis: 'ttd', nama: b.nama, mime: b.mime, base64: b.base64 });
        if (!r.success) return toast(r.message, 'error');
        AppState.pengaturan.ttd_file_id = r.data.file_id; AppState.berkas[r.data.file_id] = b.dataUri;
        toast('Tanda tangan tersimpan.', 'success'); rute();
      } catch (er) { toast(er.message, 'error'); }
    });
    const prevIzin = () => $$('[data-prev-izin]', el).forEach(td => {
      const id = td.dataset.prevIzin, sip = $('[data-izin="' + id + '"]', el).value.trim() || p.no_izin || '', kota = $('[data-kota="' + id + '"]', el).value.trim() || p.kota || '';
      td.innerHTML = '<span class="muted">' + esc((kota ? kota + ', ' : '') + vrTanggalPanjang(AppState.hariIni)) + '</span><br><b>' + esc(p.nama_fismed || '(nama)') + '</b><br><span class="mono">' + esc(sip || '— belum ada SIP —') + '</span>';
    });
    $$('[data-izin], [data-kota]', el).forEach(i => i.addEventListener('input', prevIzin)); prevIzin();
    const bIzin = $('#izin-simpan', el);
    if (bIzin) bIzin.addEventListener('click', async e => {
      const items = AppState.rs.map(r => ({ rs_id: r.rs_id, no_izin_fismed: $('[data-izin="' + r.rs_id + '"]', el).value.trim(), kota: $('[data-kota="' + r.rs_id + '"]', el).value.trim() }));
      setBusy(e.currentTarget, true, 'Menyimpan…');
      const r = await api('rs.izin', { items });
      setBusy(e.currentTarget, false);
      if (!r.success) return toast(r.message, 'error');
      r.data.forEach(x => { const i = AppState.rs.findIndex(y => y.rs_id === x.rs_id); if (i > -1) AppState.rs[i] = x; });
      toast(r.message, 'success');
    });
    $('#u-baru', el).addEventListener('click', () => modalPengguna(null));
    $$('[data-tautan]', el).forEach(b => b.addEventListener('click', () => PaketAtasan.modal(AppState.pengguna.find(u => u.email === b.dataset.tautan))));
    if (v3) pasangImporV2(el);
    $$('[data-u]', el).forEach(b => b.addEventListener('click', () => modalPengguna(AppState.pengguna.find(u => u.email === b.dataset.u))));
    $$('[data-hapus]', el).forEach(b => b.addEventListener('click', async () => {
      if (!(await konfirmasi('Hapus pengguna?', b.dataset.hapus + ' tidak akan bisa masuk lagi. Sesi aktifnya langsung diakhiri.', 'Hapus', true))) return;
      const r = await api('pengguna.hapus', { email: b.dataset.hapus });
      if (!r.success) return toast(r.message, 'error');
      AppState.pengguna = AppState.pengguna.filter(u => u.email !== b.dataset.hapus);
      toast(r.message, 'success'); rute();
    }));
    $('#k-semua', el).addEventListener('click', async () => {
      if (AppState.demo) return toast('Tidak tersedia di mode demo.', 'info');
      if (v3) { if (await konfirmasi('Keluar & hapus salinan?', 'Salinan data di perangkat ini dihapus. Data di Google Drive Anda tetap aman; masuk lagi untuk memuatnya.', 'Keluar', true)) keluar(true); return; }
      if (await konfirmasi('Keluar dari semua perangkat?', 'Semua sesi akun Anda (termasuk di perangkat ini) akan diakhiri.', 'Keluar semua', true)) keluar(true);
    });
  }
});

function modalPengguna(u) {
  const baru = !u, v3 = window.relayAktif && relayAktif();
  u = u || { peran: 'ATASAN', aktif: 'TRUE', rs_ids: '' };
  const ids = String(u.rs_ids || '').split(',').map(x => x.trim());
  const m = modal({
    judul: baru ? 'Tautkan pengguna' : 'Ubah ' + u.email, ikon: 'user-plus',
    isi: '<div class="stack"><div class="field"><label for="u-email">' + (v3 ? 'Email atasan' : 'Email Google (Gmail)') + ' <span class="req">*</span></label><input class="input mono" type="email" id="u-email" value="' + esc(u.email || '') + '"' + (baru ? '' : ' readonly') + ' placeholder="nama@gmail.com"></div>' +
      '<div class="grid-2"><div class="field"><label for="u-nama">Nama</label><input class="input" id="u-nama" value="' + esc(u.nama || '') + '"></div><div class="field"><label for="u-jab">Jabatan</label><input class="input" id="u-jab" value="' + esc(u.jabatan || '') + '" placeholder="mis. Kepala Instalasi Radiologi"></div></div>' +
      '<div class="field"><label for="u-peran">Peran</label><select class="input" id="u-peran"><option value="ATASAN"' + (u.peran !== 'FISMED' ? ' selected' : '') + '>Atasan — hanya melihat RS terpilih</option>' +
      (u.peran === 'FISMED' ? '<option value="FISMED" selected>Fisikawan medis — akses penuh</option>' : '<option value="FISMED" disabled>Fisikawan medis — paket hanya untuk 1 orang</option>') + '</select>' +
      '<span class="hint">Atasan hanya melihat Dasbor dan Riwayat & Tren untuk RS yang dicentang.' + (v3 ? ' Setelah disimpan, kirim tautan rahasia kepadanya — tanpa perlu akun.' : '') + '</span></div>' +
      '<fieldset class="field" id="u-rs" style="border:1px solid var(--border);border-radius:var(--r-sm);padding:12px"><legend class="lbl">Rumah sakit yang bisa dilihat</legend>' +
      rsAktif().map(r => '<label class="check"><input type="checkbox" value="' + r.rs_id + '"' + (ids.indexOf(r.rs_id) > -1 ? ' checked' : '') + '><span>' + esc(r.nama) + '</span></label>').join('') + '</fieldset>' +
      '<label class="switch"><input type="checkbox" id="u-aktif"' + (vrBenar(u.aktif) ? ' checked' : '') + '><span class="trk"></span>' + (v3 ? 'Aktif (tautan bisa dibuka)' : 'Aktif (boleh masuk)') + '</label></div>',
    tombol: [{ label: 'Batal' }, { label: 'Simpan', kelas: 'btn-primary', ikon: 'save', aksi: async (bg) => {
      const email = $('#u-email', bg).value.trim().toLowerCase(), peran = $('#u-peran', bg).value;
      if (!emailOk(email)) { toast('Email tidak valid.', 'warning'); return false; }
      const rs = $$('#u-rs input:checked', bg).map(x => x.value);
      if (peran === 'ATASAN' && !rs.length) { toast('Pilih minimal satu rumah sakit.', 'warning'); return false; }
      const r = await api('pengguna.simpan', { email, nama: $('#u-nama', bg).value, jabatan: $('#u-jab', bg).value, peran, rs_ids: rs, aktif: $('#u-aktif', bg).checked });
      if (!r.success) { toast(r.message, 'error'); return false; }
      const i = AppState.pengguna.findIndex(x => x.email === r.data.email);
      if (i > -1) AppState.pengguna[i] = r.data; else AppState.pengguna.push(r.data);
      if (v3) { toast(r.message, 'success'); rute(); if (r.data.peran === 'ATASAN' && vrBenar(r.data.aktif) && (baru || !Mesin.petaTautan()[email])) setTimeout(() => PaketAtasan.modal(r.data), 80); return; }
      toast(r.message + (baru ? ' Kirimkan alamat aplikasi ini kepada ' + email + '.' : ''), 'success'); rute();
    } }]
  });
  const sinkron = () => { $('#u-rs', m).classList.toggle('hidden', $('#u-peran', m).value === 'FISMED'); };
  $('#u-peran', m).addEventListener('change', sinkron); sinkron();
}

/* ---------------- Mode Drive v3: pindahkan data dari VeriRad versi lama (backend Apps Script) ---------------- */
function kartuImporV2() {
  return '<div class="card"><div class="card-h"><h2>' + ic('upload') + 'Pindahkan data dari VeriRad versi lama</h2></div><div class="card-b stack">' +
    '<p class="small muted" style="margin:0">Pernah memakai VeriRad dengan backend Apps Script (spreadsheet <b>VeriRad — Database</b>)? Pindahkan semua RS, alat, template, dan riwayat QC-nya ke sini:</p>' +
    '<ol class="small" style="margin:0;padding-left:18px"><li>Buka spreadsheet database lama → <b>File → Download → Microsoft Excel (.xlsx)</b>.</li><li>Pilih berkas itu di bawah, periksa jumlah datanya, lalu konfirmasi.</li></ol>' +
    '<div class="banner banner-warn small">' + ic('triangle-alert') + '<div class="t">Data di VeriRad ini untuk tabel yang ada di berkas akan <b>diganti</b>. Logo RS, foto alat, dan tanda tangan perlu diunggah ulang. Lampiran & PDF lama tetap ada di Google Drive lama Anda.</div></div>' +
    '<div><label class="btn">' + ic('upload') + 'Pilih berkas .xlsx<input type="file" class="sr-only" id="imp-xlsx" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label></div></div></div>';
}
function muatXlsx() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/vendor/xlsx.mini.min.js'; s.onload = res; s.onerror = () => rej(new Error('Pembaca Excel gagal dimuat.')); document.head.appendChild(s); });
}
function pasangImporV2(el) {
  const inp = $('#imp-xlsx', el); if (!inp) return;
  inp.addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let hasil;
    try { await muatXlsx(); hasil = await Mesin.imporXlsx(await f.arrayBuffer()); }
    catch (er) { return toast(er.message, 'error'); }
    const n = hasil.jumlah, label = { RS: 'rumah sakit', Alat: 'alat', TemplateJenis: 'template', TemplateParameter: 'parameter', SesiQC: 'sesi QC', HasilQC: 'hasil parameter', Lampiran: 'lampiran', LaporanTerkirim: 'arsip laporan', Pengguna: 'pengguna', Pengaturan: 'pengaturan' };
    const rsN = n.RS || 0, batas = batasRs();
    modal({
      judul: 'Pindahkan data?', ikon: 'upload',
      isi: '<p style="margin-top:0">Ditemukan di <b>' + esc(f.name) + '</b>:</p><ul class="small" style="margin:0 0 12px;padding-left:18px">' +
        Object.keys(n).map(k => '<li><b class="mono">' + n[k] + '</b> ' + esc(label[k] || k) + '</li>').join('') + '</ul>' +
        (rsN > batas ? '<div class="banner banner-fail small">' + ic('circle-x') + '<div class="t">Berkas berisi ' + rsN + ' RS, melebihi batas paket (' + batas + ').</div></div>' :
          '<div class="banner banner-warn small">' + ic('triangle-alert') + '<div class="t">Tabel di atas akan menggantikan data VeriRad ini. Tindakan ini tidak bisa dibatalkan dari aplikasi.</div></div>'),
      tombol: [{ label: 'Batal' }].concat(rsN > batas ? [] : [{ label: 'Pindahkan sekarang', kelas: 'btn-primary', ikon: 'upload', aksi: async (bg) => {
        const r = await Mesin.terapkanImpor(hasil.tabel);
        if (!r.success) { toast(r.message, 'error'); return false; }
        toast('Data versi lama berhasil dipindahkan.', 'success');
        await segarkanBoot(true);
      } }])
    });
  });
}
