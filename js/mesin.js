/* =====================================================================
 * VeriRad — mesin.js (mode Drive v3)
 * Menjalankan logika backend (Kode.gs, dirakit ke mesin-kode.js) di browser
 * terhadap salinan sheet di memori, lalu menulis perubahannya langsung ke
 * Google Sheets milik fisikawan medis. Bila gagal tersimpan (offline / sesi
 * Google habis) perubahan dibatalkan dan dikembalikan sebagai "network"
 * sehingga antrean offline menyimpannya untuk dikirim ulang.
 * ===================================================================== */
'use strict';

const Mesin = (() => {
  const ZONA_MS = 7 * 3600e3;                                  // Asia/Jakarta (tanpa DST)
  const TABEL = ['Pengaturan', 'Pengguna', 'RS', 'Alat', 'TemplateJenis', 'TemplateParameter', 'SesiQC', 'HasilQC', 'Lampiran', 'LaporanTerkirim'];
  let K = null, SKEMA = {}, mem = {}, email = '', siap = false, antre = Promise.resolve();
  let tunda = [], buang = [];                                  // unggahan berkas yang menunggu & berkas yang dibuang
  const M = { siap: () => siap, email: () => email };

  /* ---------- Shim layanan Apps Script ---------- */
  function Lembar(nama) {
    const s = { nama, data: [SKEMA[nama].slice()] };
    function Range(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      return {
        setValues(v) {
          for (let i = 0; i < nr; i++) {
            const lama = s.data[r - 1 + i] || [], baru = lama.slice();
            for (let j = 0; j < nc; j++) baru[c - 1 + j] = String(v[i][j] == null ? '' : v[i][j]).replace(/^'/, '');
            while (s.data.length < r - 1 + i) s.data.push([]);
            s.data[r - 1 + i] = baru;
          }
          return this;
        },
        setValue(v) { return this.setValues([[v]]); },
        getDisplayValues() { const out = []; for (let i = 0; i < nr; i++) { const row = s.data[r - 1 + i] || [], o = []; for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] == null ? '' : row[c - 1 + j]); out.push(o); } return out; },
        getValues() { return this.getDisplayValues(); },
        setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }
      };
    }
    return Object.assign(s, {
      getRange: Range, getMaxRows: () => Math.max(1000, s.data.length), setFrozenRows() { },
      getLastRow() { for (let i = s.data.length - 1; i >= 0; i--) if ((s.data[i] || []).join('') !== '') return i + 1; return 0; },
      deleteRows(a, n) { s.data.splice(a - 1, n); }, deleteRow(a) { s.data.splice(a - 1, 1); }
    });
  }
  const ss = { getSheetByName: n => mem[n] || null, getId: () => 'LOKAL' };
  const props = { SPREADSHEET_ID: 'LOKAL', ROOT_FOLDER_ID: 'LOKAL', FOLDER_RS_ID: 'LOKAL', FOLDER_TTD_ID: 'LOKAL' };
  function fmtTgl(d, tz, f) {
    const j = new Date(d.getTime() + ZONA_MS).toISOString();
    return f === 'yyyy-MM' ? j.slice(0, 7) : f === 'yyyy-MM-dd' ? j.slice(0, 10) : j.slice(0, 19);
  }
  function blob(data, mime, name) { return { data, mime, name, getName: () => name, setName(n) { name = n; this.name = n; return this; }, getContentType: () => mime, getBytes: () => { throw new Error('getBytes tidak tersedia di browser'); } }; }
  function Folder() {
    return { getId: () => 'LOKAL', getFoldersByName: () => ({ hasNext: () => false, next: () => null }), createFolder: () => Folder(), setTrashed() { },
      createFile(b) { const id = 'TUNDA-' + uuid(); tunda.push({ id, blob: b }); return { getId: () => id, getName: () => b.name }; } };
  }
  const SHIM = {
    SpreadsheetApp: { openById: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => Object.assign({}, props), getProperty: k => props[k] == null ? null : props[k],
      setProperty: (k, v) => { props[k] = String(v); }, setProperties: o => Object.assign(props, o), deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() { }, remove() { }, getAll: () => ({}), putAll() { } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() { }, releaseLock() { } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, getUuid: () => uuid(),
      computeDigest: () => Array.from(crypto.getRandomValues(new Uint8Array(32))),
      computeHmacSha256Signature: () => { throw new Error('Tidak dipakai di mode Drive'); },
      base64Decode: s => ({ b64: s }), base64Encode: () => { throw new Error('Tidak dipakai di mode Drive'); },
      base64EncodeWebSafe: s => btoa(unescape(encodeURIComponent(String(s)))).replace(/\+/g, '-').replace(/\//g, '_'),
      newBlob: (d, m, n) => blob(d, m, n), formatDate: fmtTgl, sleep() { }
    },
    DriveApp: { getFolderById: () => Folder(), getFileById: id => ({ setTrashed(t) { if (t && id && !/^TUNDA-/.test(id)) buang.push(id); }, getName: () => '', getBlob: () => { throw new Error('Berkas dibaca secara asinkron'); }, moveTo() { } }), createFolder: () => Folder() },
    Session: { getEffectiveUser: () => ({ getEmail: () => email }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, isi: s }) },
    MailApp: { getRemainingDailyQuota: () => 0, sendEmail() { throw new Error('Email dikirim lewat Gmail Anda (tombol Bagikan).'); } },
    UrlFetchApp: { fetch() { throw new Error('Tidak dipakai di mode Drive'); } },
    ScriptApp: { getProjectTriggers: () => [] }
  };
  const TAMBAHAN = {
    lisensi: () => lisensiLokal(),
    atasanBerubah: () => { },
    acak: n => Kripto.acak(n)
  };
  function lisensiLokal() {
    const L = AppState.lisensi || {};
    return Object.assign({ boleh_tulis: false, batas_rs: 3, batas_fismed: 1, pesan: 'Status langganan belum diperiksa. Sambungkan ke internet lalu muat ulang.' }, L);
  }
  function mesin() {
    if (K) return K;
    K = VR_MESIN_KODE(SHIM.SpreadsheetApp, SHIM.PropertiesService, SHIM.CacheService, SHIM.LockService, SHIM.Utilities, SHIM.DriveApp, SHIM.Session,
      SHIM.ContentService, SHIM.MailApp, SHIM.UrlFetchApp, SHIM.ScriptApp, console, TAMBAHAN);
    TABEL.forEach(n => { SKEMA[n] = K.SKEMA[n]; });
    DB.pakaiSkema(SKEMA);
    K.rute_()['laporan.tandai'] = { akses: 'fismed', tulis: true, fn: K.apiLaporanTandai_ };
    K.rute_()['atasan.tautan'] = { akses: 'fismed', tulis: true, fn: K.apiAtasanTautan_ };
    return K;
  }
  M.skema = () => { mesin(); return SKEMA; };

  /* ---------- Isi memori ---------- */
  function pasangTabel(t) {
    mesin();
    mem = {};
    TABEL.forEach(n => { const s = Lembar(n); s.data = [SKEMA[n].slice()].concat((t[n] || []).map(r => r.slice())); mem[n] = s; });
    K.lupaSemua_();
  }
  const tabelDariMem = () => { const t = {}; TABEL.forEach(n => { t[n] = mem[n].data.slice(1); }); return t; };
  function perluFismed() {
    const u = mem.Pengguna.data.slice(1).find(r => String(r[0]).toLowerCase() === email);
    return !(u && u[2] === 'FISMED' && vrBenar(u[5])) || mem.Pengguna.data.slice(1).some(r => r[2] === 'FISMED' && String(r[0]).toLowerCase() !== email && vrBenar(r[5]));
  }
  function pastikanFismed(nama) {
    if (!perluFismed()) return null;
    const u = mem.Pengguna.data.slice(1).find(r => String(r[0]).toLowerCase() === email);
    const row = SKEMA.Pengguna.map(k => ({ email, nama: (u && u[1]) || nama || '', peran: 'FISMED', rs_ids: '', jabatan: (u && u[4]) || 'Fisikawan Medis', aktif: 'TRUE', dibuat: (u && u[6]) || fmtTgl(new Date(), '', '') }[k] || ''));
    if (u) mem.Pengguna.data[mem.Pengguna.data.indexOf(u)] = row; else mem.Pengguna.data.push(row);
    // akun fismed lama (mis. data impor dari email lain) menjadi tidak aktif agar batas 1 fismed tetap
    mem.Pengguna.data = mem.Pengguna.data.map((r, i) => i && r[2] === 'FISMED' && String(r[0]).toLowerCase() !== email ? Object.assign(r.slice(), { 2: 'ATASAN', 5: 'FALSE' }) : r);
    K.lupaSemua_();
    return true;
  }
  async function simpanCache() { await DB.cacheSimpan(email, { modified: DB.modified, tabel: tabelDariMem(), t: Date.now() }); }

  /** Muat database: dari salinan lokal bila versi di Drive sama; buat database baru bila belum ada. */
  M.muat = async (em, opsi) => {
    opsi = opsi || {};
    email = String(em || '').toLowerCase(); mesin();
    const cache = await DB.cacheAmbil(email);
    if (opsi.dariCache) {
      if (!cache) return false;
      pasangTabel(cache.tabel); DB.modified = cache.modified; siap = true; return true;
    }
    await DB.siapkan();
    const ver = await DB.versi();
    if (cache && cache.modified === ver && !opsi.paksa) { pasangTabel(cache.tabel); DB.modified = ver; }
    else { pasangTabel(await DB.bacaSemua()); DB.modified = await DB.versi(); }
    siap = true;
    const perluIsi = mem.TemplateJenis.data.length < 2 || !mem.Pengaturan.data.slice(1).some(r => r[0] === 'pemisah_desimal');
    if (perluFismed() || perluIsi) {
      const r = await M.tulisLangsung(() => { pastikanFismed(opsi.nama); K.lupaSemua_(); K.isiAwal_(); return { success: true }; });
      if (!r.success) throw new Error(r.message);
    } else simpanCache();
    return true;
  };
  /** Periksa apakah ada perubahan dari perangkat lain (dipanggil saat aplikasi dibuka lagi). */
  M.adaBaru = async () => { if (!siap) return false; const v = await DB.versi(); return v !== DB.modified; };

  /* ---------- Selisih memori → Sheets ---------- */
  function potret() { const p = {}; TABEL.forEach(n => { p[n] = mem[n].data.slice(); }); return p; }
  function selisih(p) {
    const out = {};
    TABEL.forEach(n => {
      const a = p[n].slice(1), b = mem[n].data.slice(1);
      if (a.length === b.length && a.every((r, i) => r === b[i])) return;
      const lama = new Map(); a.forEach(r => lama.set(String(r[0]), r));
      const baru = new Map(); b.forEach(r => { if (String(r[0]) !== '') baru.set(String(r[0]), r); });
      const simpan = [], hapus = [];
      baru.forEach((r, k) => { const o = lama.get(k); if (!o || (o !== r && o.join('\u0001') !== r.join('\u0001'))) simpan.push(r); });
      lama.forEach((r, k) => { if (!baru.has(k)) hapus.push(k); });
      if (simpan.length || hapus.length) out[n] = { simpan, hapus };
    });
    return out;
  }
  function kembalikan(p) { TABEL.forEach(n => { mem[n].data = p[n]; }); K.lupaSemua_(); }
  function gantiId(lama, baru) {
    TABEL.forEach(n => { mem[n].data = mem[n].data.map((r, i) => i && r.indexOf(lama) > -1 ? r.map(x => x === lama ? baru : x) : r); });
    K.lupaSemua_();
  }
  /** Jalankan fn() (mengubah memori) lalu tulis ke Sheets; batal seluruhnya bila gagal. */
  M.tulisLangsung = fn => {
    const kerja = antre.then(async () => {
      const p = potret(); tunda = []; buang = [];
      let out;
      try { out = fn(); } catch (e) { kembalikan(p); throw e; }
      if (out && out.success === false) { kembalikan(p); return out; }
      const unggahan = tunda.slice(), dibuang = buang.slice(), baruDiunggah = [];
      let ubahan = {};
      try {
        for (const u of unggahan) {
          const b = u.blob, id = await DB.unggah(b.name || 'berkas', b.mime, b.data && b.data.b64 !== undefined ? b.data.b64 : b.data, 'berkas');
          baruDiunggah.push(id); gantiId(u.id, id);
          if (out && typeof out === 'object') out = JSON.parse(JSON.stringify(out).split(u.id).join(id));
        }
        const d = selisih(p); ubahan = d;
        if (Object.keys(d).length) { await DB.terapkan(d); try { DB.modified = await DB.versi(); } catch (e) { DB.modified = ''; } }
      } catch (e) {
        kembalikan(p);
        baruDiunggah.forEach(id => DB.sampah(id));
        if (e.network || e.code === 'GOOGLE_AUTH') return { success: false, network: true, retryable: true, message: e.message };
        return { success: false, message: 'Gagal menyimpan ke Google Drive: ' + e.message };
      }
      dibuang.forEach(id => DB.sampah(id));
      simpanCache();
      if (Object.keys(ubahan).some(t => t !== 'LaporanTerkirim') && window.PaketAtasan) PaketAtasan.tandai();
      return out;
    });
    antre = kerja.catch(() => { });
    return kerja;
  };

  /* ---------- Pintu API (dipanggil api() di core.js) ---------- */
  const ASINKRON = {
    'auth.keluarSemua': async () => ({ success: true, data: null, message: 'Anda keluar.' }),
    'file.ambil': async (ctx, d) => {
      const id = String(d.file_id || '');
      if (!K.bolehBerkas_(ctx, id)) return K.fail_('Berkas tidak ditemukan atau Anda tidak berhak membukanya.');
      try { const f = await DB.unduh(id); return K.ok_({ file_id: id, nama: f.nama, mime: f.mime, base64: f.base64 }); }
      catch (e) { return { success: false, network: !!e.network, message: e.status === 404 || e.status === 403 ? 'Berkas ini tidak bisa dibuka VeriRad (berasal dari versi lama atau sudah dihapus).' : e.message, data: { url: DB.tautan(id) } }; }
    },
    'laporan.unduh': async (ctx, d) => {
      const l = K.baca_('LaporanTerkirim').find(x => x.laporan_id === d.laporan_id);
      if (!l || !K.bolehRs_(ctx, l.rs_id)) return K.fail_('Laporan tidak ditemukan.');
      try { const f = await DB.unduh(l.pdf_file_id); return K.ok_({ nama_file: l.nama_file, base64: f.base64 }); }
      catch (e) { return { success: false, network: !!e.network, message: 'PDF tidak bisa diambil VeriRad: ' + e.message + ' Buka langsung dari Google Drive.', data: { url: DB.tautan(l.pdf_file_id) } }; }
    },
    'laporan.buat': async (ctx, d, r) => {
      if (!d.pdf) return K.fail_('PDF laporan belum dibuat.');
      const L = lisensiLokal();
      if (!L.boleh_tulis) return K.fail_(L.pesan || 'Langganan tidak aktif.', { code: 'LISENSI', lisensi: L });
      let id;
      try { id = await DB.unggah(String(d.nama_file || 'Laporan.pdf'), 'application/pdf', d.pdf, 'laporan'); }
      catch (e) { return { success: false, network: !!e.network, message: 'PDF gagal diunggah ke Google Drive: ' + e.message }; }
      const out = await M.tulisLangsung(() => jalankan(ctx, r, Object.assign({}, d, { pdf: '', pdf_file_id: id })));
      if (!out.success) DB.sampah(id);
      return out;
    },
    'lisensi.segarkan': async () => {
      const r = await Lis.panggil('status');
      if (!r.success) return r;
      terapkanLisensi(r.data);
      return { success: true, data: AppState.lisensi };
    },
    'lisensi.pesan': async (ctx, d) => Lis.panggil('pesan', { paket: d.paket, nama: AppState.me.nama, wa: d.wa || '' })
  };
  function jalankan(ctx, r, data) {
    const out = r.fn(ctx, data);
    delete out.logObjek; delete out.logDetail;
    ctx.after.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    return out;
  }
  M.handle = async (action, data) => {
    if (!siap) return { success: false, network: true, message: 'Data belum dimuat dari Google Drive.' };
    mesin();
    const r = K.rute_()[action];
    if (!r || r.akses === 'publik') return K.fail_('Aksi tidak dikenal: ' + action);
    const ctx = { reqId: '', after: [], me: K.penggunaAktif_(email) };
    if (!ctx.me) return K.fail_('Akun Anda tidak aktif di database VeriRad ini.', { code: 'AUTH' });
    if (r.akses === 'fismed' && ctx.me.peran !== 'FISMED') return K.fail_('Aksi ini hanya untuk fisikawan medis.', { code: 'FORBIDDEN' });
    data = data || {};
    try {
      if (ASINKRON[action]) return await ASINKRON[action](ctx, data, r);
      if (r.tulis && !r.bebasLisensi) {
        const L = lisensiLokal();
        if (!L.boleh_tulis) return K.fail_(L.pesan || 'Langganan VeriRad tidak aktif.', { code: 'LISENSI', lisensi: L });
      }
      if (!r.tulis) { K.lupaSemua_(); return jalankan(ctx, r, data); }
      return await M.tulisLangsung(() => { K.lupaSemua_(); return jalankan(ctx, r, data); });
    } catch (e) { console.error(e); return K.fail_(e && e.message ? e.message : String(e)); }
  };

  /* ---------- Impor data v2 (.xlsx unduhan spreadsheet lama) ---------- */
  M.imporXlsx = async (buf) => {
    if (!window.XLSX) throw new Error('Pustaka pembaca Excel belum dimuat.');
    const wb = XLSX.read(buf, { type: 'array' });
    const t = {}, n = {};
    TABEL.forEach(nm => {
      const sh = wb.Sheets[nm]; if (!sh) return;
      const v = XLSX.utils.sheet_to_json(sh, { header: 1, raw: false, defval: '' });
      if (!v.length) return;
      const head = v[0].map(x => String(x).trim()), idx = SKEMA[nm].map(k => head.indexOf(k));
      if (idx[0] < 0) return;
      t[nm] = v.slice(1).map(r => idx.map(i => i < 0 ? '' : String(r[i] == null ? '' : r[i]))).filter(r => r[0] !== '');
      n[nm] = t[nm].length;
    });
    if (!t.SesiQC && !t.RS && !t.Alat) throw new Error('Berkas ini bukan unduhan database VeriRad (sheet RS / Alat / SesiQC tidak ditemukan).');
    // berkas Drive versi lama tidak bisa dibuka dengan izin drive.file → kosongkan logo/foto/tanda tangan
    if (t.RS) t.RS = t.RS.map(r => r.map((x, i) => SKEMA.RS[i] === 'logo_file_id' ? '' : x));
    if (t.Alat) t.Alat = t.Alat.map(r => r.map((x, i) => SKEMA.Alat[i] === 'foto_id' ? '' : x));
    if (t.Pengaturan) t.Pengaturan = t.Pengaturan.filter(r => r[0] !== 'ttd_file_id');
    return { tabel: t, jumlah: n };
  };
  M.terapkanImpor = async (tabel) => {
    const L = lisensiLokal();
    if (!L.boleh_tulis) return { success: false, message: L.pesan || 'Langganan tidak aktif.' };
    const lama = tabelDariMem();
    const gabung = {}; TABEL.forEach(nm => { gabung[nm] = tabel[nm] ? tabel[nm] : lama[nm]; });
    try {
      await DB.gantiTabel(gabung);
      pasangTabel(gabung);
      if (pastikanFismed(AppState.me && AppState.me.nama)) await DB.terapkan({ Pengguna: { simpan: mem.Pengguna.data.slice(1), hapus: [] } });
      DB.modified = await DB.versi(); simpanCache();
      if (window.PaketAtasan) PaketAtasan.tandai();
      return { success: true };
    } catch (e) { try { await M.muat(email, { paksa: true }); } catch (x) { } return { success: false, message: 'Impor gagal: ' + e.message }; }
  };
  M.petaTautan = () => { mesin(); K.lupaSemua_(); return K.petaTautan_(); };
  M.tabel = nm => (mem[nm] ? mem[nm].data.slice(1) : []);
  M.baca = nm => { mesin(); K.lupaSemua_(); return K.baca_(nm).map(K.tanpaBaris_); };
  M.reset = () => { siap = false; mem = {}; email = ''; if (K) K.lupaSemua_(); };
  return M;
})();

/* ---------- Lisensi (relay) → AppState.lisensi ---------- */
function terapkanLisensi(d) {
  const p = d && d.pelanggan;
  const st = p ? p.status : 'BELUM';
  const boleh = st === 'AKTIF' || st === 'TENGGANG';
  const pesan = st === 'HABIS' ? 'Langganan berakhir' + (p.berlaku_sampai ? ' ' + vrTanggalPanjang(p.berlaku_sampai) : '') + '. Data tetap bisa dilihat, diekspor, dan laporan lama bisa dibuka. Perpanjang untuk mengisi QC lagi.' :
    st === 'NONAKTIF' ? 'Akun dinonaktifkan oleh penjual. Hubungi penjual VeriRad.' :
      st === 'TENGGANG' ? 'Langganan lewat jatuh tempo — masa tenggang sampai ' + vrTanggalPanjang(p.tenggang_sampai) + '.' :
        st === 'BELUM' ? 'Belum berlangganan.' : '';
  AppState.lisensi = Object.assign({}, p || {}, (d && d.konfig && d.konfig.batas) || {}, {
    status: st, boleh_tulis: boleh, pesan: boleh && st !== 'TENGGANG' ? '' : pesan,
    batas_rs: (p && p.batas_rs) || ((d && d.konfig && d.konfig.batas) || {}).batas_rs || 3, batas_fismed: (p && p.batas_fismed) || 1,
    versi_backend: VR_VERSI, spreadsheet_url: DB.url(), folder_url: DB.urlFolder(), diperiksa: Date.now()
  });
  Store.set(userKey('lisensi3'), AppState.lisensi);
  return AppState.lisensi;
}
