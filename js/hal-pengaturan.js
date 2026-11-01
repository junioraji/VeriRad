/* =====================================================================
 * VeriRad — Pengaturan: profil fisikawan, tanda tangan, pengguna atasan,
 * format angka, dan keamanan sesi.
 * ===================================================================== */
'use strict';

daftarHalaman('pengaturan', {
  judul: 'Pengaturan', akses: 'fismed',
  render(el) {
    const p = AppState.pengaturan;
    el.innerHTML = '<div class="page-h"><div><h1>Pengaturan</h1><p>Profil fisikawan medis, tanda tangan laporan, dan siapa saja yang boleh membuka VeriRad.</p></div></div>' +
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
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Email Google</th><th>Peran</th><th>Rumah sakit yang bisa dilihat</th><th class="c">Status</th><th></th></tr></thead><tbody>' +
      AppState.pengguna.slice().sort((a, b) => (a.peran > b.peran ? -1 : 1)).map(u => '<tr><td><b>' + esc(u.nama || '—') + '</b><span class="sub">' + esc(u.jabatan || '') + '</span></td><td class="m">' + esc(u.email) + '</td>' +
        '<td>' + (u.peran === 'FISMED' ? '<span class="tag">Fisikawan Medis</span>' : '<span class="tag tag-soft">Atasan (lihat saja)</span>') + '</td>' +
        '<td class="small">' + (u.peran === 'FISMED' ? 'Semua RS' : esc(String(u.rs_ids || '').split(',').map(id => (getRs(id.trim()) || {}).nama || id).join(', '))) + '</td>' +
        '<td class="c">' + (vrBenar(u.aktif) ? '<span class="badge b-lulus">Aktif</span>' : '<span class="badge b-na">Nonaktif</span>') + '</td>' +
        '<td><div class="hstack" style="flex-wrap:nowrap">' + (u.email.toLowerCase() === AppState.me.email ? '<span class="small muted">Anda</span>' : '<button class="btn btn-sm btn-ghost" data-u="' + esc(u.email) + '">' + ic('pencil') + 'Ubah</button><button class="btn btn-sm btn-ghost btn-icon" data-hapus="' + esc(u.email) + '" aria-label="Hapus">' + ic('trash-2') + '</button>') + '</div></td></tr>').join('') +
      '</tbody></table></div><div class="tbl-foot"><span>Atasan masuk dengan akun Google-nya sendiri dan hanya melihat RS yang dicentang. Fisikawan medis tambahan punya akses penuh.</span></div></div>' +
      '<div class="row r-1-1"><div class="card"><div class="card-h"><h2>' + ic('lock') + 'Keamanan</h2></div><div class="card-b stack">' +
      '<p class="small muted" style="margin:0">Sesi login berlaku 12 jam. Bila perangkat hilang atau dipinjam, akhiri semua sesi Anda.</p>' +
      '<div><button class="btn btn-danger" id="k-semua">' + ic('log-out') + 'Keluar dari semua perangkat</button></div>' +
      '<p class="small muted" style="margin:0">Data tersimpan di Google Sheets & Drive akun Anda. Jangan bagikan spreadsheet database dan jangan menambah editor proyek Apps Script sembarangan.</p></div></div>' +
      '<div class="card"><div class="card-h"><h2>' + ic('info') + 'Tentang aplikasi</h2></div><div class="card-b"><dl class="kv" style="margin:0">' +
      '<dt>Versi</dt><dd>VeriRad ' + esc(VR_VERSI) + '</dd><dt>Mode</dt><dd>' + (AppState.demo ? 'Demo (data lokal)' : 'Server Google Apps Script') + '</dd>' +
      '<dt>Backend</dt><dd>' + esc(AppState.demo ? '—' : GAS_URL.replace(/\/macros\/s\/(.{6}).*\/exec/, '/macros/s/$1…/exec')) + '</dd>' +
      '<dt>Toleransi disetujui</dt><dd title="' + esc(p.toleransi_disetujui || '') + '">' + esc(p.toleransi_disetujui ? String(p.toleransi_disetujui).slice(0, 10) : 'belum') + '</dd>' +
      '<dt>Aplikasi HP/laptop</dt><dd>' + (PWA.standalone ? 'Terpasang' : PWA.bisa() ? 'Bisa dipasang' : 'Buka di Chrome/Edge/Safari untuk memasang') + '</dd></dl>' +
      '<div style="margin-top:12px">' + tombolPasang('btn btn-sm') + '</div>' +
      '<p class="hint" style="margin-top:12px">Ketik <span class="mono">Perf.table()</span> di console browser untuk melihat waktu respons server.</p></div></div></div>';
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
      if (await konfirmasi('Keluar dari semua perangkat?', 'Semua sesi akun Anda (termasuk di perangkat ini) akan diakhiri.', 'Keluar semua', true)) keluar(true);
    });
  }
});

function modalPengguna(u) {
  const baru = !u;
  u = u || { peran: 'ATASAN', aktif: 'TRUE', rs_ids: '' };
  const ids = String(u.rs_ids || '').split(',').map(x => x.trim());
  const m = modal({
    judul: baru ? 'Tautkan pengguna' : 'Ubah ' + u.email, ikon: 'user-plus',
    isi: '<div class="stack"><div class="field"><label for="u-email">Email Google (Gmail) <span class="req">*</span></label><input class="input mono" type="email" id="u-email" value="' + esc(u.email || '') + '"' + (baru ? '' : ' readonly') + ' placeholder="nama@gmail.com"></div>' +
      '<div class="grid-2"><div class="field"><label for="u-nama">Nama</label><input class="input" id="u-nama" value="' + esc(u.nama || '') + '"></div><div class="field"><label for="u-jab">Jabatan</label><input class="input" id="u-jab" value="' + esc(u.jabatan || '') + '" placeholder="mis. Kepala Instalasi Radiologi"></div></div>' +
      '<div class="field"><label for="u-peran">Peran</label><select class="input" id="u-peran"><option value="ATASAN"' + (u.peran !== 'FISMED' ? ' selected' : '') + '>Atasan — hanya melihat RS terpilih</option><option value="FISMED"' + (u.peran === 'FISMED' ? ' selected' : '') + '>Fisikawan medis — akses penuh</option></select></div>' +
      '<fieldset class="field" id="u-rs" style="border:1px solid var(--border);border-radius:var(--r-sm);padding:12px"><legend class="lbl">Rumah sakit yang bisa dilihat</legend>' +
      rsAktif().map(r => '<label class="check"><input type="checkbox" value="' + r.rs_id + '"' + (ids.indexOf(r.rs_id) > -1 ? ' checked' : '') + '><span>' + esc(r.nama) + '</span></label>').join('') + '</fieldset>' +
      '<label class="switch"><input type="checkbox" id="u-aktif"' + (vrBenar(u.aktif) ? ' checked' : '') + '><span class="trk"></span>Aktif (boleh masuk)</label></div>',
    tombol: [{ label: 'Batal' }, { label: 'Simpan', kelas: 'btn-primary', ikon: 'save', aksi: async (bg) => {
      const email = $('#u-email', bg).value.trim().toLowerCase(), peran = $('#u-peran', bg).value;
      if (!emailOk(email)) { toast('Email tidak valid.', 'warning'); return false; }
      const rs = $$('#u-rs input:checked', bg).map(x => x.value);
      if (peran === 'ATASAN' && !rs.length) { toast('Pilih minimal satu rumah sakit.', 'warning'); return false; }
      const r = await api('pengguna.simpan', { email, nama: $('#u-nama', bg).value, jabatan: $('#u-jab', bg).value, peran, rs_ids: rs, aktif: $('#u-aktif', bg).checked });
      if (!r.success) { toast(r.message, 'error'); return false; }
      const i = AppState.pengguna.findIndex(x => x.email === r.data.email);
      if (i > -1) AppState.pengguna[i] = r.data; else AppState.pengguna.push(r.data);
      toast(r.message + (baru ? ' Kirimkan alamat aplikasi ini kepada ' + email + '.' : ''), 'success'); rute();
    } }]
  });
  const sinkron = () => { $('#u-rs', m).classList.toggle('hidden', $('#u-peran', m).value === 'FISMED'); };
  $('#u-peran', m).addEventListener('change', sinkron); sinkron();
}
