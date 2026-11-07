/* =====================================================================
 * VeriRad — drive.js (mode Drive v3)
 * Database QC = Google Sheets di Google Drive fisikawan medis sendiri,
 * diakses langsung dari browser dengan izin drive.file (hanya berkas
 * yang dibuat VeriRad). Salinan disimpan di IndexedDB agar buka cepat & offline.
 * ===================================================================== */
'use strict';

const DB = (() => {
  const DRV = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files', SHT = 'https://sheets.googleapis.com/v4/spreadsheets';
  const q = s => encodeURIComponent(s);
  const rng = (t, a1) => "'" + t + "'!" + a1;
  let SKEMA = {}, NAMA = [];
  let meta = null;            // { id, folder, berkas, laporan, sheets:{t:sheetId}, head:{t:[kol]} }
  const D = { modified: '' };
  D.pakaiSkema = s => { SKEMA = s; NAMA = Object.keys(s); };
  const kunciMeta = () => 'db3:' + (Store.get('email3', '') || 'x');

  /* ---------- IndexedDB (salinan lokal) ---------- */
  function idb() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('IndexedDB tidak tersedia'));
      const r = indexedDB.open('verirad3', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('db'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  D.cacheAmbil = async email => { try { const d = await idb(); return await new Promise(res => { const t = d.transaction('db').objectStore('db').get(email); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); } catch (e) { return null; } };
  D.cacheSimpan = async (email, isi) => { try { const d = await idb(); await new Promise(res => { const t = d.transaction('db', 'readwrite'); t.objectStore('db').put(isi, email); t.oncomplete = res; t.onerror = res; }); } catch (e) { } };
  D.cacheHapus = async email => { try { const d = await idb(); await new Promise(res => { const t = d.transaction('db', 'readwrite'); t.objectStore('db').delete(email); t.oncomplete = res; t.onerror = res; }); } catch (e) { } };

  /* ---------- Lokasi database ---------- */
  async function cari(tag) {
    const r = await GAuth.json(DRV + '?q=' + q("appProperties has { key='verirad' and value='" + tag + "' } and trashed=false") + '&fields=files(id,name,appProperties,modifiedTime)&orderBy=modifiedTime desc&spaces=drive');
    return (r.files || [])[0] || null;
  }
  const folderBaru = (name, parent, tag) => GAuth.json(DRV + '?fields=id', 'POST', { name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : undefined, appProperties: { verirad: tag } });
  async function buat() {
    const root = await folderBaru('VeriRad', null, 'folder');
    const berkas = await folderBaru('Berkas (logo, foto, lampiran)', root.id, 'berkas');
    const lap = await folderBaru('Laporan PDF', root.id, 'laporan');
    const ss = await GAuth.json(DRV + '?fields=id,appProperties,modifiedTime', 'POST', { name: 'VeriRad — Database QC', mimeType: 'application/vnd.google-apps.spreadsheet', parents: [root.id],
      appProperties: { verirad: 'db', folder: root.id, berkas: berkas.id, laporan: lap.id } });
    const reqs = [{ updateSheetProperties: { properties: { sheetId: 0, title: NAMA[0], gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } }]
      .concat(NAMA.slice(1).map(n => ({ addSheet: { properties: { title: n, gridProperties: { frozenRowCount: 1 } } } })));
    await GAuth.json(SHT + '/' + ss.id + ':batchUpdate', 'POST', { requests: reqs });
    await GAuth.json(SHT + '/' + ss.id + '/values:batchUpdate', 'POST', { valueInputOption: 'RAW', data: NAMA.map(n => ({ range: rng(n, 'A1'), values: [SKEMA[n]] })) });
    ss.baru = true;
    return ss;
  }
  D.siapkan = async () => {
    if (meta) return meta;
    const c = Store.get(kunciMeta(), null);
    if (c && c.id && c.sheets && c.head && NAMA.every(n => c.sheets[n] != null && SKEMA[n].every(k => c.head[n].indexOf(k) > -1))) { meta = c; return meta; }
    let f = await cari('db'), baru = false;
    if (!f) { f = await buat(); baru = true; }
    const info = await GAuth.json(SHT + '/' + f.id + '?fields=sheets.properties(sheetId,title)');
    const sheets = {}; info.sheets.forEach(s => { sheets[s.properties.title] = s.properties.sheetId; });
    const hilang = NAMA.filter(n => sheets[n] == null);
    if (hilang.length) {
      const r = await GAuth.json(SHT + '/' + f.id + ':batchUpdate', 'POST', { requests: hilang.map(n => ({ addSheet: { properties: { title: n, gridProperties: { frozenRowCount: 1 } } } })) });
      r.replies.forEach((x, i) => { sheets[hilang[i]] = x.addSheet.properties.sheetId; });
      await GAuth.json(SHT + '/' + f.id + '/values:batchUpdate', 'POST', { valueInputOption: 'RAW', data: hilang.map(n => ({ range: rng(n, 'A1'), values: [SKEMA[n]] })) });
    }
    // judul kolom: tambah kolom skema yang belum ada (aman untuk pembaruan versi)
    const hd = await GAuth.json(SHT + '/' + f.id + '/values:batchGet?' + NAMA.map(n => 'ranges=' + q(rng(n, '1:1'))).join('&'));
    const head = {}, perbaiki = [];
    hd.valueRanges.forEach((vr, i) => {
      const n = NAMA[i]; let h = ((vr.values || [])[0] || []).map(String);
      if (!h.length) h = SKEMA[n].slice();
      const kurang = SKEMA[n].filter(k => h.indexOf(k) === -1);
      if (kurang.length || !(vr.values || []).length) { h = h.concat(kurang); perbaiki.push({ range: rng(n, 'A1'), values: [h] }); }
      head[n] = h;
    });
    if (perbaiki.length) await GAuth.json(SHT + '/' + f.id + '/values:batchUpdate', 'POST', { valueInputOption: 'RAW', data: perbaiki });
    const ap = f.appProperties || {};
    let berkas = ap.berkas || '', laporan = ap.laporan || '', folder = ap.folder || '';
    meta = { id: f.id, folder, berkas, laporan, sheets, head, baru };
    Store.set(kunciMeta(), Object.assign({}, meta, { baru: false }));
    return meta;
  };
  D.lupa = () => { meta = null; Store.del(kunciMeta()); };
  D.url = () => { const m = meta || Store.get(kunciMeta(), null); return m && m.id ? 'https://docs.google.com/spreadsheets/d/' + m.id + '/edit' : ''; };
  D.urlFolder = () => { const m = meta || Store.get(kunciMeta(), null); return m && m.folder ? 'https://drive.google.com/drive/folders/' + m.folder : ''; };
  D.versi = async () => { const m = await D.siapkan(); const f = await GAuth.json(DRV + '/' + m.id + '?fields=modifiedTime,trashed'); if (f.trashed) { D.lupa(); throw new Error('Database VeriRad ada di Sampah Google Drive. Pulihkan dari Sampah, lalu muat ulang.'); } return f.modifiedTime; };

  /* ---------- Baca semua tabel ---------- */
  function keSkema(n, head, baris) {
    const idx = SKEMA[n].map(k => head.indexOf(k));
    return baris.map(r => idx.map(i => i < 0 || r[i] == null ? '' : String(r[i]))).filter(r => r[0] !== '');
  }
  D.bacaSemua = async () => {
    const m = await D.siapkan();
    let r;
    try { r = await GAuth.json(SHT + '/' + m.id + '/values:batchGet?' + NAMA.map(n => 'ranges=' + q(rng(n, 'A1:AZ'))).join('&') + '&valueRenderOption=FORMATTED_VALUE'); }
    catch (e) { if (e.status === 404 || e.status === 400) { D.lupa(); throw new Error('Database VeriRad tidak ditemukan di Drive. Muat ulang halaman untuk memeriksa lagi.'); } throw e; }
    const t = {};
    r.valueRanges.forEach((vr, i) => { const n = NAMA[i], v = vr.values || []; t[n] = keSkema(n, m.head[n], v.slice(1)); });
    return t;
  };

  /* ---------- Tulis perubahan (berdasarkan kunci kolom pertama → aman bila dibuka di 2 perangkat) ----------
   * ubah: { Nama: { simpan: [baris skema], hapus: [kunci] } } */
  D.terapkan = async ubah => {
    const m = await D.siapkan();
    const ts = Object.keys(ubah).filter(t => SKEMA[t] && (ubah[t].simpan.length || ubah[t].hapus.length));
    if (!ts.length) return;
    const cur = await GAuth.json(SHT + '/' + m.id + '/values:batchGet?' + ts.map(t => 'ranges=' + q(rng(t, 'A:A'))).join('&'));
    const data = [], tambah = [], hapus = [];
    ts.forEach((t, i) => {
      const keys = (cur.valueRanges[i].values || []).map(r => String(r[0] == null ? '' : r[0]));
      const head = m.head[t], idx = head.map(h => SKEMA[t].indexOf(h));
      const keBaris = r => idx.map(j => j < 0 ? '' : String(r[j] == null ? '' : r[j]).slice(0, 49000));
      const baru = [];
      ubah[t].simpan.forEach(r => { const p = keys.indexOf(String(r[0])); if (p > 0) data.push({ range: rng(t, 'A' + (p + 1)), values: [keBaris(r)] }); else baru.push(keBaris(r)); });
      if (baru.length) tambah.push({ t, rows: baru });
      const sudah = {};
      ubah[t].hapus.forEach(k => { keys.forEach((x, p) => { if (p > 0 && x === String(k) && !sudah[p]) { sudah[p] = 1; hapus.push({ sheetId: m.sheets[t], i: p }); } }); });
    });
    if (data.length) await GAuth.json(SHT + '/' + m.id + '/values:batchUpdate', 'POST', { valueInputOption: 'RAW', data });
    if (hapus.length) {
      hapus.sort((a, b) => a.sheetId - b.sheetId || b.i - a.i);
      const req = [];                                                     // gabungkan baris berurutan
      hapus.forEach(h => { const l = req[req.length - 1]; if (l && l.sheetId === h.sheetId && l.s === h.i + 1) l.s = h.i; else req.push({ sheetId: h.sheetId, s: h.i, e: h.i + 1 }); });
      await GAuth.json(SHT + '/' + m.id + ':batchUpdate', 'POST', { requests: req.map(d => ({ deleteDimension: { range: { sheetId: d.sheetId, dimension: 'ROWS', startIndex: d.s, endIndex: d.e } } })) });
    }
    for (const a of tambah) await GAuth.json(SHT + '/' + m.id + '/values/' + q(rng(a.t, 'A1')) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', 'POST', { values: a.rows });
  };
  /** Ganti isi tabel seluruhnya (impor data v2). */
  D.gantiTabel = async tabel => {
    const m = await D.siapkan();
    const ts = Object.keys(tabel).filter(t => SKEMA[t]);
    await GAuth.json(SHT + '/' + m.id + '/values:batchClear', 'POST', { ranges: ts.map(t => rng(t, 'A2:AZ')) });
    const data = ts.filter(t => tabel[t].length).map(t => { const idx = m.head[t].map(h => SKEMA[t].indexOf(h)); return { range: rng(t, 'A2'), values: tabel[t].map(r => idx.map(j => j < 0 ? '' : String(r[j] == null ? '' : r[j]))) }; });
    for (let i = 0; i < data.length; i++) await GAuth.json(SHT + '/' + m.id + '/values:batchUpdate', 'POST', { valueInputOption: 'RAW', data: [data[i]] });
  };

  /* ---------- Berkas ---------- */
  async function folderUntuk(jenis) {
    const m = await D.siapkan(), k = jenis === 'laporan' ? 'laporan' : 'berkas';
    if (m[k]) return m[k];
    let f = await cari(k);
    if (!f) f = await folderBaru(k === 'laporan' ? 'Laporan PDF' : 'Berkas (logo, foto, lampiran)', m.folder || undefined, k);
    m[k] = f.id; Store.set(kunciMeta(), Object.assign({}, m, { baru: false }));
    return f.id;
  }
  function keBlob(isi, mime) {
    if (isi && typeof isi === 'object' && typeof isi.arrayBuffer === 'function') return isi;   // Blob (juga dari iframe)
    const bin = atob(String(isi).replace(/^data:[^,]+,/, '')), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: mime });
  }
  D.unggah = async (nama, mime, isi, jenis) => {
    const parent = await folderUntuk(jenis);
    const batas = 'vr' + Kripto.acak(12);
    const body = new Blob(['--' + batas + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: nama, mimeType: mime, parents: [parent], appProperties: { verirad: 'berkas-' + (jenis || 'lain') } }) +
      '\r\n--' + batas + '\r\nContent-Type: ' + mime + '\r\n\r\n', keBlob(isi, mime), '\r\n--' + batas + '--'], { type: 'multipart/related; boundary=' + batas });
    const r = await GAuth.fetch(UP + '?uploadType=multipart&fields=id,name,webViewLink', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + batas }, body });
    return r.id;
  };
  function keBase64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('Berkas tidak terbaca')); fr.readAsDataURL(blob); }); }
  D.unduh = async id => {
    const info = await GAuth.json(DRV + '/' + q(id) + '?fields=name,mimeType');
    const res = await GAuth.fetch(DRV + '/' + q(id) + '?alt=media', { mentah: true });
    const blob = await res.blob();
    return { file_id: id, nama: info.name, mime: info.mimeType || blob.type, base64: await keBase64(blob), blob };
  };
  D.sampah = id => GAuth.json(DRV + '/' + q(id) + '?fields=id', 'PATCH', { trashed: true }).catch(() => { });
  /** Bagikan berkas ke email penerima (hanya-lihat) atau ke siapa saja yang punya tautan. Mengembalikan tautan lihat. */
  D.bagikan = async (id, emails, publik) => {
    const gagal = [];
    if (publik) await GAuth.json(DRV + '/' + q(id) + '/permissions?fields=id', 'POST', { type: 'anyone', role: 'reader' });
    for (const e of (emails || [])) {
      try { await GAuth.json(DRV + '/' + q(id) + '/permissions?sendNotificationEmail=false&fields=id', 'POST', { type: 'user', role: 'reader', emailAddress: e }); }
      catch (er) {
        try { await GAuth.json(DRV + '/' + q(id) + '/permissions?sendNotificationEmail=true&fields=id', 'POST', { type: 'user', role: 'reader', emailAddress: e }); }   // email non-Google wajib notifikasi
        catch (er2) { gagal.push(e); }
      }
    }
    return { url: 'https://drive.google.com/file/d/' + id + '/view', gagal };
  };
  D.tautan = id => 'https://drive.google.com/file/d/' + id + '/view';
  return D;
})();
