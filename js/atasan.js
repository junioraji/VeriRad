/* =====================================================================
 * VeriRad — atasan.js (mode Drive v3)
 * Atasan / kepala instalasi melihat Dasbor + Riwayat & Tren RS-nya TANPA
 * akun Google: fisikawan medis membagikan tautan rahasia. Ringkasannya
 * dienkripsi AES-256 di browser fismed; relay penjual hanya menyimpan
 * sandi acak yang tidak bisa dibukanya. Di perangkat atasan, kunci tautan
 * dibungkus PIN.
 * ===================================================================== */
'use strict';

const PaketAtasan = (() => {
  const PA = {}, BULAN = 36, KUNCI = 'atasan3';
  let _t = null, _jalan = false, _kunci = null;

  /* ======================= SISI FISMED: menerbitkan ======================= */
  PA.tautan = (id, k) => location.origin + location.pathname.replace(/index\.html$/, '') + '#/a/' + id + '.' + k;
  PA.tandai = () => {
    if (!window.modeRelay || !modeRelay() || AppState.demo || AppState.atasanPaket || !fismed()) return;
    Store.set(userKey('paket-kotor'), true);
    clearTimeout(_t); _t = setTimeout(() => PA.terbit(), 15000);
  };
  function bangun(u, email) {
    const ids = String(u.rs_ids || '').split(',').map(x => x.trim()).filter(String);
    const P = {}; Mesin.baca('Pengaturan').forEach(r => { P[r.kunci] = r.nilai; });
    const rs = Mesin.baca('RS').filter(r => ids.indexOf(r.rs_id) > -1).map(r => Object.assign({}, r, { logo_file_id: '', email_atasan: '', email_cc: '' }));
    const alat = Mesin.baca('Alat').filter(a => ids.indexOf(a.rs_id) > -1).map(a => Object.assign({}, a, { foto_id: '' }));
    const dari = vrGeserPeriode(periodeKini(), -(BULAN - 1));
    const sesi = Mesin.baca('SesiQC').filter(s => ids.indexOf(s.rs_id) > -1 && s.periode >= dari);
    const set = {}; sesi.forEach(s => { set[s.sesi_id] = 1; });
    const tpl = {}; alat.forEach(a => { tpl[a.template_id] = 1; }); sesi.forEach(s => { tpl[s.template_id] = 1; });
    const kol = Mesin.skema().HasilQC, iS = kol.indexOf('sesi_id');
    return {
      v: 1, dibuat: new Date().toISOString(), fismed: { nama: P.nama_fismed || '', email },
      atasan: { email: u.email, nama: u.nama, jabatan: u.jabatan, rs_ids: ids.join(',') },
      pengaturan: { nama_fismed: P.nama_fismed || '', no_izin: P.no_izin || '', pemisah_desimal: P.pemisah_desimal || ',' },
      rs, alat, templates: Mesin.baca('TemplateJenis').filter(t => tpl[t.template_id]), params: Mesin.baca('TemplateParameter').filter(p => tpl[p.template_id]),
      sesi, hasil: { kol, baris: Mesin.tabel('HasilQC').filter(r => set[r[iS]]) }
    };
  }
  function periodeKini() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7); }
  /** Terbitkan ulang ringkasan semua atasan aktif; hapus ringkasan atasan yang dinonaktifkan/dihapus. */
  PA.terbit = async (hanyaEmail) => {
    if (_jalan || !Mesin.siap() || !(AppState.lisensi || {}).boleh_tulis) return { success: false };
    _jalan = true;
    try {
      const peta = Mesin.petaTautan(), email = Mesin.email();
      const aktif = Mesin.baca('Pengguna').filter(u => u.peran === 'ATASAN' && vrBenar(u.aktif) && peta[u.email.toLowerCase()]);
      for (const u of aktif) {
        const e = u.email.toLowerCase();
        if (hanyaEmail && e !== hanyaEmail) continue;
        const data = await Kripto.kunci(peta[e].k, bangun(u, email));
        if (data.length > 4.9e6) { toast('Ringkasan untuk ' + e + ' terlalu besar untuk dibagikan.', 'warning'); continue; }
        const r = await Lis.panggil('paket.terbit', { items: [{ id: peta[e].id, data }] });
        if (!r.success) throw new Error(r.message);
      }
      if (!hanyaEmail) {
        const aktifSet = {}; aktif.forEach(u => { aktifSet[u.email.toLowerCase()] = 1; });
        const mati = Object.keys(peta).filter(e => !aktifSet[e]).map(e => peta[e].id);
        if (mati.length) await Lis.panggil('paket.hapus', { ids: mati });
        Store.del(userKey('paket-kotor'));
      }
      return { success: true };
    } catch (e) { console.warn('Ringkasan atasan belum terkirim:', e.message); return { success: false, message: e.message }; }
    finally { _jalan = false; }
  };
  PA.mungkinTerbit = () => { if (Store.get(userKey('paket-kotor'), false)) PA.terbit(); };

  /** Modal bagikan tautan untuk satu atasan. */
  PA.modal = async (u, baru) => {
    const e = u.email.toLowerCase();
    const r = await api('atasan.tautan', { email: e, baru: !!baru });
    if (!r.success) return toast(r.message, 'error');
    const url = PA.tautan(r.data.id, r.data.k);
    const nama = (AppState.pengaturan.nama_fismed || AppState.me.nama || 'Fisikawan medis');
    const rsNama = String(u.rs_ids || '').split(',').map(id => (getRs(id.trim()) || {}).nama).filter(Boolean).join(', ');
    const teks = 'Yth. ' + (u.nama || 'Bapak/Ibu') + ',\n\nBerikut tautan untuk memantau hasil QC alat radiologi ' + (rsNama || 'RS') + ' di VeriRad (Dasbor & Riwayat). Tidak perlu akun atau aplikasi — buka tautan, lalu buat PIN untuk perangkat Anda:\n\n' + url + '\n\nMohon tautan ini tidak diteruskan ke orang lain.\n\nSalam,\n' + nama;
    const m = modal({
      judul: 'Tautan untuk ' + (u.nama || e), ikon: 'link', lebar: true,
      isi: '<div class="stack"><p class="small muted" style="margin:0">Atasan membuka tautan ini di HP/laptop, membuat PIN, lalu melihat <b>Dasbor</b> dan <b>Riwayat & Tren</b> untuk <b>' + esc(rsNama || '—') + '</b>. Tidak perlu akun Google.</p>' +
        '<div class="field"><label for="ta-url">Tautan rahasia</label><div class="hstack" style="gap:8px;flex-wrap:nowrap"><input class="input mono small" id="ta-url" readonly value="' + esc(url) + '"><button class="btn" id="ta-salin">' + ic('copy') + 'Salin</button></div></div>' +
        '<div id="ta-status" class="small muted">' + ic('loader-circle', 'spin') + ' Menyiapkan ringkasan terenkripsi…</div>' +
        '<div class="hstack" style="gap:8px;flex-wrap:wrap">' +
        '<a class="btn btn-primary" target="_blank" rel="noopener" href="' + esc('https://wa.me/?text=' + encodeURIComponent(teks)) + '">' + ic('message-circle') + 'Kirim via WhatsApp</a>' +
        '<a class="btn" target="_blank" rel="noopener" href="' + esc('https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(e) + '&su=' + encodeURIComponent('Tautan pemantauan QC radiologi — VeriRad') + '&body=' + encodeURIComponent(teks)) + '">' + ic('mail') + 'Kirim via Gmail</a></div>' +
        '<div class="banner banner-warn small">' + ic('triangle-alert') + '<div class="t">Siapa pun yang memegang tautan ini bisa melihat ringkasan QC RS tersebut. Bila tautan tersebar, klik <b>Buat tautan baru</b> — tautan lama langsung tidak berlaku. Menonaktifkan atasan juga menutup aksesnya.</div></div>' +
        '<p class="hint" style="margin:0">Ringkasan diperbarui otomatis beberapa detik setelah Anda menyimpan data QC. Isinya dienkripsi di perangkat Anda; server VeriRad tidak bisa membacanya.</p></div>',
      tombol: [{ label: 'Buat tautan baru', kelas: 'btn-ghost', ikon: 'refresh-cw', aksi: async () => {
        if (!(await konfirmasi('Buat tautan baru?', 'Tautan lama untuk ' + e + ' tidak bisa dipakai lagi. Kirimkan tautan baru ke atasan.', 'Buat baru'))) return false;
        setTimeout(() => PA.modal(u, true), 50);
      } }, { label: 'Selesai', kelas: 'btn-primary' }]
    });
    $('#ta-salin', m).addEventListener('click', ev => salinTeks(url, ev.currentTarget));
    if (r.data.lama_id) Lis.panggil('paket.hapus', { ids: [r.data.lama_id] });
    const t = await PA.terbit(e);
    const st = $('#ta-status', m);
    if (st) st.innerHTML = t.success ? '<span style="color:var(--pass-text)">' + ic('circle-check') + ' Ringkasan siap dibuka atasan.</span>' :
      '<span style="color:var(--warn-text, #B45309)">' + ic('triangle-alert') + ' Ringkasan belum terkirim' + (t.message ? ': ' + esc(t.message) : '') + '. VeriRad mencoba lagi otomatis saat online.</span>';
    if (!t.success) Store.set(userKey('paket-kotor'), true);
  };

  /* ======================= SISI ATASAN: membuka ======================= */
  PA.dariHash = () => { const m = location.hash.match(/^#\/a\/([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]{40,50})$/); return m ? { id: m[1], k: m[2] } : null; };
  PA.adaTersimpan = () => !!Store.get(KUNCI, null);
  function halaman(judul, isi) {
    document.title = tr(judul) + ' — VeriRad';
    $('#app').classList.remove('is-demo');
    $('#app').innerHTML = '<div class="lis-page"><header class="lis-top"><div class="brand" style="padding:0;border:0"><div class="logo">' + logoVR() + '</div><div><b>Veri<em>Rad</em></b><span>Smart QC Radiologi</span></div></div><div class="sp"></div>' +
      tombolBahasa('lis-lang') + '</header><main class="lis-main"><div class="card card-b atasan-pin" style="max-width:420px;margin:32px auto">' + isi + '</div></main></div>';
  }
  function inputPin(id, label) { return '<div class="field"><label for="' + id + '">' + label + '</label><input class="input mono pin-in" id="' + id + '" type="password" inputmode="numeric" autocomplete="off" maxlength="6" pattern="[0-9]*" placeholder="4–6 angka"></div>'; }
  PA.mulai = async () => {
    const t = PA.dariHash();
    if (t) {
      history.replaceState(null, '', location.pathname + location.search);
      return buatPin(t);
    }
    const s = Store.get(KUNCI, null);
    if (s) return mintaPin(s);
    return false;
  };
  function buatPin(t) {
    halaman('Buat PIN', '<h2 style="margin-top:0">' + ic('lock') + ' Buat PIN perangkat ini</h2><p class="muted small">Tautan ringkasan QC dari fisikawan medis Anda sudah diterima. Buat PIN agar hanya Anda yang bisa membukanya di perangkat ini.</p>' +
      '<div class="stack">' + inputPin('pin1', 'PIN baru') + inputPin('pin2', 'Ulangi PIN') + '<div id="pin-msg"></div><button class="btn btn-primary btn-block" id="pin-ok">' + ic('circle-check') + 'Simpan & buka ringkasan</button></div>');
    $('#pin1').focus();
    const ok = async () => {
      const a = $('#pin1').value, b = $('#pin2').value;
      if (!/^\d{4,6}$/.test(a)) return pesan('PIN harus 4–6 angka.');
      if (a !== b) return pesan('Kedua PIN tidak sama.');
      setBusy($('#pin-ok'), true, 'Menyimpan…');
      Store.set(KUNCI, { id: t.id, w: await Kripto.bungkusPin(a, { k: t.k }), dibuat: Date.now() });
      return buka(t.id, t.k);
    };
    $('#pin-ok').addEventListener('click', ok);
    $('#pin2').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    return true;
  }
  function pesan(m) { $('#pin-msg').innerHTML = '<p class="err-msg" style="margin:0">' + esc(m) + '</p>'; }
  function mintaPin(s) {
    halaman('Masukkan PIN', '<h2 style="margin-top:0">' + ic('lock') + ' Ringkasan QC Radiologi</h2><p class="muted small">Masukkan PIN perangkat ini.</p>' +
      '<div class="stack">' + inputPin('pin', 'PIN') + '<div id="pin-msg"></div><button class="btn btn-primary btn-block" id="pin-ok">' + ic('arrow-right') + 'Buka</button>' +
      '<p class="hint" style="margin:0">Lupa PIN? Buka lagi tautan dari fisikawan medis Anda untuk membuat PIN baru, atau <a href="#" id="pin-lupa">hapus tautan dari perangkat ini</a>.</p></div>');
    $('#pin').focus();
    const ok = async () => {
      const p = $('#pin').value;
      if (!/^\d{4,6}$/.test(p)) return pesan('PIN 4–6 angka.');
      setBusy($('#pin-ok'), true, 'Membuka…');
      let k;
      try { k = (await Kripto.bukaPin(p, s.w)).k; } catch (e) { setBusy($('#pin-ok'), false); $('#pin').value = ''; return pesan('PIN salah.'); }
      return buka(s.id, k);
    };
    $('#pin-ok').addEventListener('click', ok);
    $('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    $('#pin-lupa').addEventListener('click', e => { e.preventDefault(); PA.lupa(); renderLogin(); });
    return true;
  }
  PA.lupa = () => { const s = Store.get(KUNCI, null); Store.del(KUNCI); if (s) DB.cacheHapus('atasan:' + s.id); AppState.atasanPaket = null; };
  async function buka(id, k) {
    $('#app').innerHTML = '<div class="boot-load">' + ic('loader-circle', 'spin') + '&nbsp; Membuka ringkasan…</div>';
    const r = await Lis.panggil('paket.ambil', { id });
    let teks = '', offline = false, status = '';
    if (r.success) { teks = r.data.data; status = r.data.status; DB.cacheSimpan('atasan:' + id, { teks, t: Date.now() }); }
    else if (r.network) { const c = await DB.cacheAmbil('atasan:' + id); if (c) { teks = c.teks; offline = true; } }
    if (!teks) {
      if (r.data && r.data.code === 'TAUTAN') PA.lupa();
      halaman('Tidak bisa dibuka', '<h2 style="margin-top:0">' + ic('circle-x') + ' Ringkasan tidak bisa dibuka</h2><p>' + esc(r.message || 'Periksa koneksi internet.') + '</p>' +
        '<button class="btn btn-block" id="ul">' + ic('refresh-cw') + 'Coba lagi</button>');
      $('#ul').addEventListener('click', () => location.reload());
      return true;
    }
    let pkg;
    try { pkg = await Kripto.buka(k, teks); }
    catch (e) { PA.lupa(); halaman('Tautan rusak', '<h2 style="margin-top:0">' + ic('circle-x') + ' Tautan tidak cocok</h2><p>Minta tautan baru ke fisikawan medis Anda.</p>'); return true; }
    const kol = pkg.hasil.kol;
    pkg.hasilObj = pkg.hasil.baris.map(r => { const o = {}; kol.forEach((c, i) => { o[c] = r[i] == null ? '' : r[i]; }); return o; });
    pkg.offline = offline; pkg.status = status; _kunci = { id, k };
    AppState.atasanPaket = pkg; AppState.demo = false;
    masuk({ token: 'atasan', foto: '', boot: bootPaket() });
    if (offline) toast('Offline — menampilkan ringkasan terakhir yang tersimpan di perangkat ini.', 'warning');
    return true;
  }
  /** Tombol muat ulang di sisi atasan: ambil ringkasan terbaru dari relay. */
  PA.segarkan = async () => {
    if (!_kunci) return false;
    const per = AppState.periode, hash = location.hash;
    await buka(_kunci.id, _kunci.k);
    AppState.periode = per; if (hash) location.hash = hash; renderShell(); rute();
    return true;
  };
  function bootPaket() {
    const p = AppState.atasanPaket, per = periodeKini(), dari = vrGeserPeriode(per, -11);
    return {
      me: { email: p.atasan.email, nama: p.atasan.nama, peran: 'ATASAN', jabatan: p.atasan.jabatan, rs_ids: p.atasan.rs_ids.split(',') },
      versi: VR_VERSI, periode: per, hariIni: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10),
      pengaturan: p.pengaturan, rs: p.rs, alat: p.alat, templates: p.templates, params: p.params, pengguna: [],
      sesi: p.sesi.filter(s => s.periode >= dari), sesiDari: dari, laporan: [], lisensi: null
    };
  }
  const ok = d => ({ success: true, data: d, message: '' }), gagal = m => ({ success: false, message: m });
  PA.handle = async (action, d) => {
    const p = AppState.atasanPaket; d = d || {};
    if (action === 'boot') return ok(bootPaket());
    if (action === 'sesi.list') return ok(p.sesi.filter(s => s.periode >= (d.dari || '0000-01') && s.periode <= (d.sampai || '9999-12')));
    if (action === 'hasil.list') {
      let ids;
      if (Array.isArray(d.sesi_ids)) ids = d.sesi_ids;
      else if (d.alat_id) ids = p.sesi.filter(s => s.alat_id === d.alat_id && s.periode >= (d.dari || '0000-01') && s.periode <= (d.sampai || '9999-12')).map(s => s.sesi_id);
      else return gagal('Sebutkan sesi_ids atau alat_id.');
      const set = {}; ids.forEach(i => { set[i] = 1; });
      return ok({ hasil: p.hasilObj.filter(h => set[h.sesi_id]), lampiran: [] });
    }
    if (action === 'laporan.list') return ok([]);
    if (action === 'auth.keluarSemua') return ok(null);
    if (action === 'file.ambil') return gagal('Berkas tidak tersedia di ringkasan atasan.');
    return gagal('Akses atasan hanya untuk melihat.');
  };
  PA.info = () => {
    const p = AppState.atasanPaket; if (!p) return '';
    return 'Ringkasan dari ' + (p.fismed.nama || p.fismed.email) + ' · diperbarui ' + waktuRelatif(p.dibuat);
  };
  return PA;
})();
