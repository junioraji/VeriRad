/* =====================================================================
 * VeriRad — core.js
 * State, penyimpanan lokal, pemanggil API (timeout + retry + reqId),
 * helper UI (toast, modal, badge), grafik SVG, dan helper data.
 * ===================================================================== */
'use strict';

const AppState = {
  demo: false, token: '', me: null, foto: '',
  periode: '', hariIni: '', pengaturan: {}, rs: [], alat: [], templates: [], params: [], pengguna: [],
  sesi: [], sesiDari: '', laporan: [], hasil: {}, lampiran: {}, berkas: {}, filterRs: '', online: navigator.onLine !== false
};

/* ---------------- Registri halaman (diisi hal-*.js, dijalankan oleh router di app.js) ---------------- */
const Halaman = {};
function daftarHalaman(nama, def) { Halaman[nama] = Object.assign({ akses: 'semua' }, def); }
function buka(nama, param) { const h = '#/' + nama + (param ? '/' + encodeURIComponent(param) : ''); if (location.hash === h) rute(); else location.hash = h; }

/* ---------------- Penyimpanan lokal (namespace per pengguna) ---------------- */
const LS_PREFIX = 'verirad:v1:';
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) { } }
};
function userKey(k) { return 'u:' + (AppState.demo ? 'demo' : (AppState.me ? AppState.me.email : 'anon')) + ':' + k; }

/* ---------------- Pengukur performa ---------------- */
const Perf = {
  rows: [],
  add(action, total, server) { this.rows.push({ action, total, server: server ?? null, net: server != null ? total - server : null }); if (this.rows.length > 200) this.rows.shift(); },
  table() { console.table(this.rows.slice(-30)); }
};

/* ---------------- API ---------------- */
const GAS_URL = (window.APP_CONFIG && window.APP_CONFIG.GAS_URL) || '';
function konfigurasiSiap() { return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(GAS_URL) && !/GANTI|XXXX/.test(GAS_URL); }
const READ_ACTIONS = /^(auth\.config|boot|sesi\.list|hasil\.list|file\.ambil|laporan\.list|laporan\.unduh)$/;

function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }

async function apiOnce(action, data, timeout, reqId) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },              // hindari CORS preflight
      body: JSON.stringify({ action, token: AppState.token || '', reqId, data: data || {} })
    });
    const text = await res.text();
    try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); return j; }
    catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Periksa URL Web App di js/config.js.' }; }
  } catch (err) {
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi terputus.' };
  } finally { clearTimeout(timer); }
}
function waitOnline(ms) {
  return new Promise(r => {
    if (navigator.onLine !== false) return r();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); removeEventListener('online', done); r(); }
    addEventListener('online', done);
  });
}
async function api(action, data, opt = {}) {
  if (AppState.demo) {
    await new Promise(r => setTimeout(r, 120 + Math.random() * 180));
    try { return JSON.parse(JSON.stringify(Demo.handle(action, JSON.parse(JSON.stringify(data || {}))))); }
    catch (e) { console.error(e); return { success: false, message: e.message }; }
  }
  const isRead = READ_ACTIONS.test(action);
  const reqId = isRead ? '' : (opt.reqId || uuid());
  const tries = isRead ? 3 : 2;
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await new Promise(r => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(action, data, isRead ? (i ? 40000 : 25000) : 90000, reqId);
    if (res.success || !res.retryable) break;
  }
  if (!res.success && res.data && res.data.code === 'AUTH' && action !== 'auth.login') onSessionExpired();
  return res;
}
function warmUpServer() { if (konfigurasiSiap() && !AppState.demo) fetch(GAS_URL + '?action=ping&t=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => { }); }

/* ---------------- Helper UI ---------------- */
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ic(name, cls) {
  const b = (window.ICONS || {})[name];
  if (!b) { console.warn('Ikon hilang:', name); return ''; }
  return '<svg class="i ' + (cls || '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>';
}
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function sep() { return AppState.pengaturan.pemisah_desimal === '.' ? '.' : ','; }
function inisial(n) { return String(n || '?').replace(/^(dr|drg|ir|prof)\.?\s+/i, '').split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || '?'; }
function debounce(fn, ms) { let t; return function () { const a = arguments, s = this; clearTimeout(t); t = setTimeout(() => fn.apply(s, a), ms); }; }
function waktuRelatif(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? '' : '+07:00'));
  const s = (Date.now() - d.getTime()) / 1000;
  if (isNaN(s)) return iso;
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.floor(s / 60) + ' mnt lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
  if (s < 86400 * 7) return Math.floor(s / 86400) + ' hari lalu';
  return vrTanggalPanjang(iso);
}
function jamTgl(iso) { const m = String(iso || '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/); return m ? vrTanggalPanjang(m[1]) + ', ' + m[2] : esc(iso); }

const LABEL_STATUS = { LULUS: 'Lulus', GAGAL: 'Gagal', BELUM: 'Belum', KOSONG: 'Belum', NA: 'N/A', DRAF: 'Draf', INFO: 'Data', ERROR: 'Tidak valid',
  TERKIRIM: 'Terkirim', DIBUAT: 'Dibuat', GAGAL_KIRIM: 'Gagal kirim' };
function badge(st, teks) {
  if (!st) return '<span class="b-none">—</span>';
  const k = { LULUS: 'lulus', GAGAL: 'gagal', NA: 'na', BELUM: 'belum', KOSONG: 'belum', DRAF: 'draf', INFO: 'info', ERROR: 'gagal', TERKIRIM: 'lulus', DIBUAT: 'info' }[st] || 'belum';
  return '<span class="badge b-' + k + '">' + esc(teks || LABEL_STATUS[st] || st) + '</span>';
}

function toast(msg, type) {
  type = type || 'info';
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = ic({ success: 'circle-check', error: 'circle-x', warning: 'triangle-alert', info: 'info' }[type] || 'info') + '<div>' + esc(msg) + '</div>';
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, type === 'error' ? 7000 : 4000);
}

/** Modal sederhana. tombol: [{label, kelas, aksi(close) → boolean|Promise}]. */
function modal(o) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal ' + (o.lebar ? 'lg' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.judul) + '">' +
    '<div class="modal-h">' + (o.ikon ? ic(o.ikon) : '') + '<h2>' + esc(o.judul) + '</h2><button class="btn btn-ghost btn-icon btn-sm" data-x aria-label="Tutup">' + ic('x') + '</button></div>' +
    '<div class="modal-b">' + o.isi + '</div>' +
    (o.tombol && o.tombol.length ? '<div class="modal-f"></div>' : '') + '</div>';
  const prevFocus = document.activeElement;
  function close() { bg.remove(); document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); if (o.onClose) o.onClose(); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', e => { if (e.target === bg && !o.wajib) close(); });
  $('[data-x]', bg).addEventListener('click', close);
  if (o.wajib) $('[data-x]', bg).remove();
  const f = $('.modal-f', bg);
  (o.tombol || []).forEach(t => {
    const b = document.createElement('button');
    b.className = 'btn ' + (t.kelas || '');
    b.innerHTML = (t.ikon ? ic(t.ikon) : '') + esc(t.label);
    b.addEventListener('click', async () => {
      if (!t.aksi) return close();
      b.disabled = true;
      try { const r = await t.aksi(bg); if (r !== false) close(); } finally { b.disabled = false; }
    });
    f.appendChild(b);
  });
  document.body.appendChild(bg);
  const first = $('input, select, textarea', $('.modal-b', bg)) || $('.modal-f .btn-primary', bg);
  if (first) setTimeout(() => first.focus(), 30);
  bg.close = close;
  return bg;
}
function konfirmasi(judul, pesan, label, bahaya) {
  return new Promise(res => {
    modal({ judul, isi: '<p style="margin:0">' + esc(pesan) + '</p>', onClose: () => res(false),
      tombol: [{ label: 'Batal' }, { label: label || 'Ya, lanjutkan', kelas: bahaya ? 'btn-danger' : 'btn-primary', aksi: () => { res(true); } }] });
  });
}
function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = ic('loader-circle', 'spin') + esc(label || 'Memproses…'); }
  else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}
function kosong(judul, pesan, tombolHtml) {
  return '<div class="empty"><svg class="art" viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="20" y="30" width="56" height="34" rx="3"/><path d="M76 40h14l10 10v14H76"/><circle cx="36" cy="68" r="6"/><circle cx="88" cy="68" r="6"/><path d="M30 30V18h22v12M40 18v-6h8"/><path d="M28 44h40M28 52h28" stroke-dasharray="3 3"/></svg>' +
    '<h3>' + esc(judul) + '</h3><p>' + esc(pesan) + '</p>' + (tombolHtml || '') + '</div>';
}
function unduhBase64(nama, b64, mime) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  unduhBlob(nama, new Blob([arr], { type: mime || 'application/octet-stream' }));
}
function unduhBlob(nama, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function unduhCsv(nama, baris) {
  const csv = baris.map(r => r.map(v => { const s = String(v === null || v === undefined ? '' : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
  unduhBlob(nama, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
}

/** Baca berkas → base64. Gambar diperkecil (maks 1600 px) supaya unggah cepat di HP. */
function bacaBerkas(file, opsi) {
  opsi = opsi || {};
  return new Promise((resolve, reject) => {
    if (file.size > 15 * 1024 * 1024) return reject(new Error('Berkas terlalu besar (maks 15 MB sebelum dikompres).'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Berkas tidak bisa dibaca.'));
    fr.onload = () => {
      const url = fr.result;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return resolve({ nama: file.name, mime: file.type, base64: url.split(',')[1], dataUri: url });
      const img = new Image();
      img.onload = () => {
        const maks = opsi.maks || 1600, s = Math.min(1, maks / Math.max(img.width, img.height));
        if (s === 1 && file.size < 900 * 1024) return resolve({ nama: file.name, mime: file.type, base64: url.split(',')[1], dataUri: url });
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const png = file.type === 'image/png';
        const out = c.toDataURL(png ? 'image/png' : 'image/jpeg', .85);
        resolve({ nama: file.name.replace(/\.\w+$/, png ? '.png' : '.jpg'), mime: png ? 'image/png' : 'image/jpeg', base64: out.split(',')[1], dataUri: out });
      };
      img.onerror = () => reject(new Error('Gambar rusak atau formatnya tidak didukung.'));
      img.src = url;
    };
    fr.readAsDataURL(file);
  });
}
/** Ambil berkas Drive sebagai data URI (logo, tanda tangan, lampiran) dengan cache memori. */
async function dataUriBerkas(fileId) {
  if (!fileId) return '';
  if (AppState.berkas[fileId]) return AppState.berkas[fileId];
  const r = await api('file.ambil', { file_id: fileId });
  if (!r.success) return '';
  return (AppState.berkas[fileId] = 'data:' + r.data.mime + ';base64,' + r.data.base64);
}

/* ---------------- Grafik SVG (tanpa pustaka) ---------------- */
function niceRange(min, max) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min, step0 = Math.pow(10, Math.floor(Math.log10(span / 4)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * step0).find(s => span / s <= 5) || step0 * 10;
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}
/**
 * o: { labels:[], seri:[{nama, warna, nilai:[], putus, tandaGagal:[bool]}], garis:[{y,label,warna}], zona:{min,max},
 *      lebar, tinggi, satuan, persen, desimal }
 */
function grafikGaris(o) {
  const W = o.lebar || 960, H = o.tinggi || 260, pl = 48, pr = 28, pt = o.labelNilai ? 26 : 16, pb = 30;
  const semua = [];
  o.seri.forEach(s => s.nilai.forEach(v => { if (v !== null && v !== undefined && isFinite(v)) semua.push(v); }));
  (o.garis || []).forEach(g => semua.push(g.y));
  if (o.persen) { semua.push(0); semua.push(100); }
  if (!semua.length) return '<div class="empty small">Belum ada data untuk digrafikkan.</div>';
  const rg = niceRange(Math.min.apply(null, semua), Math.max.apply(null, semua));
  const n = o.labels.length, x = i => pl + (n <= 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1)), y = v => pt + (rg.max - v) * (H - pt - pb) / (rg.max - rg.min);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.judul || 'Grafik') + '">';
  for (let v = rg.min; v <= rg.max + 1e-9; v += rg.step) {
    s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#E3E8EF" stroke-dasharray="' + (v === rg.min ? '0' : '2 3') + '"/>';
    s += '<text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(vrAngkaRingkas(Number(v.toPrecision(6)), sep())) + (o.persen ? '%' : '') + '</text>';
  }
  if (o.zonaGagal) o.zonaGagal.forEach(z => {
    const a = Math.max(rg.min, z[0]), b = Math.min(rg.max, z[1]);
    if (b > a) s += '<rect x="' + pl + '" width="' + (W - pl - pr) + '" y="' + y(b) + '" height="' + (y(a) - y(b)) + '" fill="#DC2626" opacity=".06"/>';
  });
  o.labels.forEach((l, i) => { if (n <= 12 || i % Math.ceil(n / 12) === 0) s += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(l) + '</text>'; });
  (o.garis || []).forEach(g => {
    s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(g.y) + '" y2="' + y(g.y) + '" stroke="' + (g.warna || '#DC2626') + '" stroke-width="1.5" stroke-dasharray="6 4"/>';
    s += '<text x="' + (W - pr) + '" y="' + (y(g.y) - 5) + '" text-anchor="end" style="fill:' + (g.warna || '#DC2626') + ';font-weight:600">' + esc(g.label) + '</text>';
  });
  o.seri.forEach(se => {
    let d = '', mulai = true;
    se.nilai.forEach((v, i) => {
      if (v === null || v === undefined || !isFinite(v)) { mulai = true; return; }
      d += (mulai ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; mulai = false;
    });
    s += '<path d="' + d + '" fill="none" stroke="' + se.warna + '" stroke-width="2.5" stroke-linejoin="round" ' + (se.putus ? 'stroke-dasharray="6 4"' : '') + '/>';
    se.nilai.forEach((v, i) => {
      if (v === null || v === undefined || !isFinite(v)) return;
      const bad = se.tandaGagal && se.tandaGagal[i];
      s += bad ? '<rect x="' + (x(i) - 5) + '" y="' + (y(v) - 5) + '" width="10" height="10" fill="#DC2626" stroke="#fff" stroke-width="1.5"><title>' + esc(o.labels[i] + ': ' + vrAngkaRingkas(v, sep())) + '</title></rect>'
        : '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="4" fill="#fff" stroke="' + se.warna + '" stroke-width="2"><title>' + esc(o.labels[i] + ': ' + vrAngkaRingkas(Number(v.toFixed(3)), sep()) + (o.persen ? '%' : '')) + '</title></circle>';
      if (o.labelNilai) s += '<text x="' + x(i) + '" y="' + (y(v) - 9) + '" text-anchor="middle" style="fill:' + (bad ? '#B91C1C' : '#1B2A4A') + ';font-weight:600">' + esc(vrFormat(v, o.desimal === undefined ? 1 : o.desimal, sep())) + '</text>';
    });
  });
  return s + '</svg>';
}
function legendaGrafik(seri, garis) {
  return '<div class="chart-legend">' + seri.map(s => '<span style="color:' + s.warna + '"><i class="' + (s.putus ? 'dash' : '') + '" style="background:' + s.warna + '"></i><span style="color:var(--muted)">' + esc(s.nama) + '</span></span>').join('') +
    (garis || []).map(g => '<span style="color:' + (g.warna || '#DC2626') + '"><i class="dash"></i><span style="color:var(--muted)">' + esc(g.label) + '</span></span>').join('') + '</div>';
}
function grafikDonut(seg, atas, bawah) {
  const tot = seg.reduce((a, b) => a + b.nilai, 0) || 1, R = 70, r = 52, cx = 90, cy = 90;
  let a0 = -Math.PI / 2, s = '<svg viewBox="0 0 180 180" role="img" aria-label="Komposisi status">';
  s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="#F1F5F9" stroke-width="' + (R - r) + '"/>';
  seg.forEach(g => {
    if (!g.nilai) return;
    const a1 = a0 + (g.nilai / tot) * Math.PI * 2 - (seg.filter(x => x.nilai).length > 1 ? 0.02 : 0);
    const big = a1 - a0 > Math.PI ? 1 : 0, rm = (R + r) / 2;
    if (g.nilai === tot) s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rm + '" fill="none" stroke="' + g.warna + '" stroke-width="' + (R - r) + '"/>';
    else s += '<path d="M' + (cx + rm * Math.cos(a0)) + ' ' + (cy + rm * Math.sin(a0)) + ' A' + rm + ' ' + rm + ' 0 ' + big + ' 1 ' + (cx + rm * Math.cos(a1)) + ' ' + (cy + rm * Math.sin(a1)) + '" fill="none" stroke="' + g.warna + '" stroke-width="' + (R - r) + '"><title>' + esc(g.label + ': ' + g.nilai) + '</title></path>';
    a0 = a0 + (g.nilai / tot) * Math.PI * 2;
  });
  s += '<text x="90" y="92" text-anchor="middle" style="font-family:var(--mono);font-size:28px;font-weight:700;fill:#1B2A4A">' + esc(atas) + '</text>';
  s += '<text x="90" y="112" text-anchor="middle" style="font-size:10px;fill:#64748B;letter-spacing:.08em">' + esc(bawah) + '</text>';
  return s + '</svg>';
}
/** SVG → PNG data URI (untuk disisipkan ke PDF laporan). */
function svgKePng(svg, lebar, tinggi) {
  return new Promise(resolve => {
    const full = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="' + lebar + '" height="' + tinggi + '" ')
      .replace(/var\(--mono\)/g, 'monospace').replace(/var\(--muted\)/g, '#64748B');
    const css = '<style>text{font-family:monospace;font-size:11px;fill:#64748B}</style>';
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(full.replace(/(<svg[^>]*>)/, '$1' + css));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = lebar * 2; c.height = tinggi * 2;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.scale(2, 2); g.drawImage(img, 0, 0, lebar, tinggi);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

/* ---------------- Helper data ---------------- */
const fismed = () => AppState.me && AppState.me.peran === 'FISMED';
const getRs = id => AppState.rs.find(r => r.rs_id === id);
const getAlat = id => AppState.alat.find(a => a.alat_id === id);
const getTpl = id => AppState.templates.find(t => t.template_id === id);
const paramsTpl = id => AppState.params.filter(p => p.template_id === id);
const rsAktif = () => AppState.rs.filter(r => vrBenar(r.aktif)).sort((a, b) => a.nama.localeCompare(b.nama));
const alatAktif = rsId => AppState.alat.filter(a => vrBenar(a.aktif) && (!rsId || a.rs_id === rsId)).sort((a, b) => (getRs(a.rs_id) || {}).nama?.localeCompare((getRs(b.rs_id) || {}).nama) || a.kode.localeCompare(b.kode));
const sesiAlat = (alatId, per) => AppState.sesi.find(s => s.alat_id === alatId && s.periode === per);
function kategoriTpl(tplId) {
  const ada = {};
  paramsTpl(tplId).forEach(p => { if (vrBenar(p.aktif) && p.tipe_toleransi !== 'TIDAK_ADA') ada[p.kategori] = 1; });
  return VR_KATEGORI.filter(k => ada[k]);
}
function statusAlat(alatId, per) {
  const s = sesiAlat(alatId, per);
  if (!s) return { st: 'BELUM', sesi: null };
  if (s.status_sesi !== 'FINAL') return { st: 'DRAF', sesi: s };
  return { st: s.status_total, sesi: s };
}
function upsertSesi(s) {
  const i = AppState.sesi.findIndex(x => x.sesi_id === s.sesi_id);
  if (i > -1) AppState.sesi[i] = s; else AppState.sesi.push(s);
}
function daftarPeriode() {
  const out = [], now = AppState.periode || new Date().toISOString().slice(0, 7);
  for (let i = 1; i >= -17; i--) out.push(vrGeserPeriode(now, i));
  return out;
}
function singkatBulan(per) { const m = String(per).match(/^(\d{4})-(\d{2})$/); return m ? VR_BULAN[Number(m[2]) - 1].slice(0, 3) + ' ' + m[1].slice(2) : per; }
/** Muat HasilQC untuk daftar sesi (dengan cache memori). */
async function muatHasil(sesiIds) {
  const perlu = sesiIds.filter(id => !AppState.hasil[id]);
  if (perlu.length) {
    for (let i = 0; i < perlu.length; i += 300) {
      const r = await api('hasil.list', { sesi_ids: perlu.slice(i, i + 300) });
      if (!r.success) { toast(r.message, 'error'); return false; }
      perlu.slice(i, i + 300).forEach(id => { AppState.hasil[id] = []; AppState.lampiran[id] = []; });
      r.data.hasil.forEach(h => AppState.hasil[h.sesi_id].push(h));
      r.data.lampiran.forEach(l => (AppState.lampiran[l.sesi_id] = AppState.lampiran[l.sesi_id] || []).push(l));
    }
  }
  return true;
}
/** Pastikan sesi untuk rentang periode sudah dimuat (boot memuat 12 bulan). */
async function muatSesiSejak(dari) {
  if (AppState.sesiDari && dari >= AppState.sesiDari) return true;
  const r = await api('sesi.list', { dari: dari, sampai: AppState.sesiDari ? vrGeserPeriode(AppState.sesiDari, -1) : '9999-12' });
  if (!r.success) { toast(r.message, 'error'); return false; }
  r.data.forEach(upsertSesi);
  AppState.sesiDari = dari;
  return true;
}
