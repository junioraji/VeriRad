/* =====================================================================
 * VeriRad — i18n.js : Bahasa Indonesia ⇄ English
 * Antarmuka ditulis dalam Bahasa Indonesia. Saat mode English aktif,
 * penerjemah ini mengganti teks yang tampil (teks, placeholder, title,
 * aria-label) memakai kamus istilah QC radiologi + pola kalimat dinamis.
 * Data yang diketik pengguna (nama RS, catatan, dsb.) tidak diubah.
 * Kamus antarmuka ada di js/i18n-en.js; istilah data QC di bersama.js (VR_EN).
 * ===================================================================== */
'use strict';

const I18N = {
  lang: (function () { try { return localStorage.getItem('verirad:lang') === 'en' ? 'en' : 'id'; } catch (e) { return 'id'; } })(),
  kamus: {},
  pola: [],
  miss: new Set(),
  catat: false,
  en() { return this.lang === 'en'; },
  set(lang) {
    this.lang = lang === 'en' ? 'en' : 'id';
    try { localStorage.setItem('verirad:lang', this.lang); } catch (e) { }
    document.documentElement.lang = this.lang;
    if (AppState.me && AppState.token) { renderShell(); rute(); } else renderLogin();
  }
};

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SINGKAT = { Jan: 'Jan', Feb: 'Feb', Mar: 'Mar', Apr: 'Apr', Mei: 'May', Jun: 'Jun', Jul: 'Jul', Agu: 'Aug', Sep: 'Sep', Okt: 'Oct', Nov: 'Nov', Des: 'Dec' };
/** Ganti nama bulan Indonesia di dalam teks tanggal/periode. */
function bulanKeEN(s) {
  return String(s)
    .replace(/\b(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\b(?=\s*\d{4}|,?\s*\d{2}:\d{2})/g, m => VR_BULAN_EN[BULAN_ID.indexOf(m)])
    .replace(/\b(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)\b(?= \d{2}\b)/g, m => BULAN_SINGKAT[m]);
}

/** Terjemahkan satu string (spasi depan/belakang dipertahankan). */
function tr(s) {
  if (I18N.lang !== 'en' || s === null || s === undefined) return s;
  const str = String(s), m = str.match(/^(\s*)([\s\S]*?)(\s*)$/), inti = m[2];
  if (!inti || !/[A-Za-zÀ-ÿ]/.test(inti)) return str;
  const hasil = trInti(inti);
  if (hasil === null) { if (I18N.catat) I18N.miss.add(inti); return m[1] + bulanKeEN(inti) + m[3]; }
  return m[1] + hasil + m[3];
}
let _EN_SET = null;
function sudahEN(s) {
  if (!_EN_SET) { _EN_SET = new Set(Object.values(I18N.kamus).concat(Object.values(VR_EN))); }
  return _EN_SET.has(s);
}
let _UPPER = null;
function trInti(inti, dalam) {
  const k = I18N.kamus;
  if (inti.indexOf('\n') > -1) return inti.split('\n').map(b => { const r = b.trim() ? trInti(b.trim(), false) : b; return r === null ? bulanKeEN(b) : r; }).join('\n');
  if (Object.prototype.hasOwnProperty.call(k, inti)) return k[inti];
  if (Object.prototype.hasOwnProperty.call(VR_EN, inti)) return VR_EN[inti];
  if (sudahEN(inti)) return inti;
  if (inti.length > 3 && inti === inti.toUpperCase() && /[A-Z]{3}/.test(inti)) {      // judul kapital: CT SCAN, RADIOGRAFI UMUM
    if (!_UPPER) { _UPPER = {}; [VR_EN, k].forEach(m => Object.keys(m).forEach(x => { _UPPER[x.toUpperCase()] = m[x].toUpperCase(); })); }
    if (_UPPER[inti]) return _UPPER[inti];
  }
  if (/^[A-Z][A-Z0-9_\-]*$/.test(inti) || /^[\d\s.,:;/%+\-−–—=<>≤≥±()|×·°]*$/.test(inti)) return inti;   // kode / angka
  for (const [re, fn] of I18N.pola) {
    const mm = inti.match(re);
    if (!mm) continue;
    const r = typeof fn === 'function' ? fn.apply(null, mm) : fn.replace(/\$(\d)/g, (_, i) => mm[i]);
    if (r !== null && r !== undefined) return r;           // null = pola menolak, coba pola berikutnya
  }
  if (!dalam) {                                           // kalimat gabungan "A · B", "A — B", "A: B"
    for (const pemisah of [' · ', ' — ', ': ']) {
      if (inti.indexOf(pemisah) > 0) {
        const bag = inti.split(pemisah), hasil = bag.map(b => { const r = trInti(b.trim(), true); return r === null ? b : r; });
        if (hasil.some((h, i) => h !== bag[i])) return hasil.join(pemisah);
      }
    }
  }
  return null;
}
/** Terjemahkan bagian yang dikenal; bila tidak dikenal kembalikan apa adanya (untuk grup pola). */
function trBagian(s) { const r = trInti(String(s).trim()); return r === null ? bulanKeEN(s) : r; }
/** Seperti trBagian, tetapi null bila bagian itu bukan periode/istilah yang dikenal (untuk pola umum). */
function trKenal(s) {
  s = String(s).trim();
  if (/^(\d{1,2} )?(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember) \d{4}$/.test(s)) return bulanKeEN(s);
  if (/^[A-Z0-9][A-Z0-9_\-]*$/.test(s) || /^\d{4}-\d{2}$/.test(s)) return s;
  return trInti(s, true);
}

/** Terjemahkan ke bahasa tertentu tanpa bergantung pada bahasa UI (untuk laporan PDF). */
function trKe(lang, s) {
  if (lang !== 'en') return s;
  const lama = I18N.lang, catat = I18N.catat; I18N.lang = 'en'; I18N.catat = false;
  try { return tr(s); } finally { I18N.lang = lama; I18N.catat = catat; }
}
/** Terjemahkan teks di dalam string SVG (judul sumbu, legenda, tooltip). */
function trSvgKe(lang, svg) {
  if (lang !== 'en' || !svg) return svg;
  const box = document.createElement('div');
  box.innerHTML = svg;
  const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = trKe('en', n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
  box.querySelectorAll('[aria-label]').forEach(e => e.setAttribute('aria-label', trKe('en', e.getAttribute('aria-label'))));
  return box.innerHTML;
}

/* ---------------- Penerjemah DOM ---------------- */
const ATRIBUT_I18N = ['placeholder', 'title', 'aria-label'];
function lewati(el, atribut) {
  if (!el || el.nodeType !== 1) return false;
  if (atribut && el.tagName === 'TEXTAREA') el = el.parentElement;   // placeholder textarea tetap diterjemahkan
  return !!el && el.closest('textarea, script, style, [data-no-i18n], .mono-data') !== null;
}
function terjemahNode(root) {
  if (I18N.lang !== 'en' || !root) return;
  if (root.nodeType === 3) { terjemahTeks(root); return; }
  if (root.nodeType === 1 && root.tagName === 'TEXTAREA') { if (!lewati(root, true)) ATRIBUT_I18N.forEach(a => terjemahAtribut(root, a)); return; }
  if (root.nodeType !== 1 || lewati(root)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => {
      if (n.nodeType === 1 && n.tagName === 'TEXTAREA') { ATRIBUT_I18N.forEach(a => terjemahAtribut(n, a)); return NodeFilter.FILTER_REJECT; }
      return n.nodeType === 1 && /^(SCRIPT|STYLE)$/.test(n.tagName) || (n.nodeType === 1 && n.hasAttribute('data-no-i18n')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  let n = root;
  do {
    if (n.nodeType === 3) terjemahTeks(n);
    else ATRIBUT_I18N.forEach(a => terjemahAtribut(n, a));
  } while ((n = w.nextNode()));
}
const _SELESAI = new WeakMap();
function terjemahAtribut(el, a) {
  if (!el.hasAttribute(a)) return;
  const v = el.getAttribute(a), memo = el.__i18n || (el.__i18n = {});
  if (memo[a] === v) return;
  const t = tr(v);
  memo[a] = t;
  if (t !== v) el.setAttribute(a, t);
}
function terjemahTeks(t) {
  if (!t.parentNode || lewati(t.parentNode)) return;
  const v = t.nodeValue;
  if (_SELESAI.get(t) === v) return;                      // sudah hasil terjemahan
  const x = tr(v);
  _SELESAI.set(t, x);
  if (x !== v) t.nodeValue = x;
}
const pengamat = new MutationObserver(muts => {
  if (I18N.lang !== 'en') return;
  muts.forEach(m => {
    if (m.type === 'characterData') terjemahTeks(m.target);
    else if (m.type === 'attributes') { if (!lewati(m.target, true)) terjemahAtribut(m.target, m.attributeName); }
    else m.addedNodes.forEach(terjemahNode);
  });
});
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = I18N.lang;
  pengamat.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUT_I18N });
  terjemahNode(document.body);
});

/** Tombol pilih bahasa (dipakai di topbar & halaman masuk). */
function tombolBahasa(kelasTambahan) {
  return '<div class="lang-switch ' + (kelasTambahan || '') + '" role="group" aria-label="Bahasa / Language" data-no-i18n>' +
    '<button type="button" data-lang="id" aria-pressed="' + (I18N.lang === 'id') + '" title="Bahasa Indonesia">ID</button>' +
    '<button type="button" data-lang="en" aria-pressed="' + (I18N.lang === 'en') + '" title="English">EN</button></div>';
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-lang]');
  if (b && b.dataset.lang !== I18N.lang) I18N.set(b.dataset.lang);
});
