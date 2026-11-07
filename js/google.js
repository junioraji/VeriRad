/* =====================================================================
 * VeriRad — google.js (mode Drive v3)
 * GAuth  : login Google (Google Identity Services token client, izin drive.file)
 *          + pemanggil Google API dengan token Bearer.
 * Kripto : AES-GCM 256 di browser (paket ringkasan atasan), PIN via PBKDF2.
 * Data QC fisikawan medis TIDAK pernah lewat server penjual.
 * ===================================================================== */
'use strict';

const SesiTab = {
  get(k, d) { try { const v = sessionStorage.getItem('verirad:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { sessionStorage.setItem('verirad:' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { sessionStorage.removeItem('verirad:' + k); } catch (e) { } }
};
function muatSkrip(src) {
  return new Promise((res, rej) => {
    if (document.querySelector('script[src="' + src + '"]')) { const t = setInterval(() => { if (window.google && google.accounts && google.accounts.oauth2) { clearInterval(t); res(); } }, 50); setTimeout(() => { clearInterval(t); res(); }, 8000); return; }
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('Skrip Google gagal dimuat. Periksa koneksi internet.'));
    document.head.appendChild(s);
  });
}

/* ======================= GOOGLE ======================= */
const GAuth = (() => {
  const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file';
  const SCOPES = 'openid email profile ' + SCOPE_DRIVE;
  let client = null, pending = null;
  const G = {
    tok: SesiTab.get('tok', null),
    clientId: () => (window.APP_CONFIG || {}).GOOGLE_CLIENT_ID || '',
    sisaMenit() { return G.tok ? Math.round((G.tok.exp - Date.now()) / 60000) : 0; },
    valid() { return !!(G.tok && G.tok.exp > Date.now() + 60000); },
    async init() {
      if (client) return;
      if (!G.clientId()) throw new Error('GOOGLE_CLIENT_ID belum diisi di js/config.js.');
      if (!(window.google && google.accounts && google.accounts.oauth2)) await muatSkrip('https://accounts.google.com/gsi/client');
      client = google.accounts.oauth2.initTokenClient({
        client_id: G.clientId(), scope: SCOPES,
        callback: r => {
          const p = pending; pending = null; if (!p) return;
          if (r.error) return p.rej(new Error(r.error_description || r.error));
          if (!google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE_DRIVE)) {
            const e = new Error('Centang izin "Lihat, edit, buat, dan hapus file Google Drive tertentu yang Anda gunakan dengan aplikasi ini" agar VeriRad bisa menyimpan data QC di Drive Anda.'); e.code = 'IZIN_DRIVE'; return p.rej(e);
          }
          G.tok = { at: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
          SesiTab.set('tok', G.tok); p.res(G.tok);
        },
        error_callback: e => {
          const p = pending; pending = null; if (!p) return;
          p.rej(new Error(e && e.type === 'popup_closed' ? 'Jendela login Google ditutup sebelum selesai.' :
            e && e.type === 'popup_failed_to_open' ? 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.' : 'Login Google gagal.'));
        }
      });
    },
    /** prompt: '' (diam bila sudah pernah izin), 'consent', 'select_account' */
    minta(prompt, hint) {
      return G.init().then(() => new Promise((res, rej) => {
        if (pending) pending.rej(new Error('dibatalkan'));
        pending = { res, rej };
        client.requestAccessToken({ prompt: prompt == null ? '' : prompt, hint: hint || Store.get('email3', '') || undefined });
      }));
    },
    keluar() {
      try { if (G.tok && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(G.tok.at, () => { }); } catch (e) { }
      G.tok = null; SesiTab.del('tok');
    },
    perluLogin() { const e = new Error('Sesi Google berakhir. Klik "Sambungkan lagi" di atas untuk melanjutkan.'); e.code = 'GOOGLE_AUTH'; e.network = true; return e; },
    async fetch(url, opt, ulang) {
      if (!G.valid()) { try { await G.minta(''); } catch (e) { if (window.onGoogleTerputus) onGoogleTerputus(); throw G.perluLogin(); } }
      opt = Object.assign({}, opt || {});
      opt.headers = Object.assign({ Authorization: 'Bearer ' + G.tok.at }, opt.headers || {});
      let res;
      try { res = await fetch(url, opt); }
      catch (e) { const er = new Error(navigator.onLine === false ? 'Tidak ada koneksi internet.' : 'Google tidak merespons. Coba lagi sebentar.'); er.network = true; throw er; }
      if (res.status === 401 && !ulang) { G.tok = null; SesiTab.del('tok'); return G.fetch(url, opt, true); }
      if ((res.status === 429 || res.status >= 500) && !ulang) { await new Promise(r => setTimeout(r, 1500)); return G.fetch(url, opt, true); }
      if (!res.ok) {
        let m = 'HTTP ' + res.status; try { const j = await res.json(); m = (j.error && j.error.message) || m; } catch (e) { }
        const er = new Error('Google: ' + m); er.status = res.status; if (res.status >= 500 || res.status === 429) er.network = true; throw er;
      }
      if (opt.mentah) return res;
      const ct = res.headers.get('content-type') || '';
      return ct.indexOf('json') > -1 ? res.json() : res.blob();
    },
    json(url, method, body) { return G.fetch(url, { method: method || 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); },
    profil() { return G.json('https://www.googleapis.com/oauth2/v3/userinfo'); }
  };
  // Penyegaran token "menumpang" klik pengguna (popup diizinkan karena terjadi di dalam gestur).
  document.addEventListener('click', () => {
    if (G.tok && G.sisaMenit() < 6 && !pending && window.modeRelay && modeRelay() && !AppState.demo && AppState.me) G.minta('').catch(() => { });
  }, true);
  return G;
})();

/* ======================= KRIPTO ======================= */
const Kripto = (() => {
  const K = {};
  K.b64u = buf => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  K.unb64u = s => { s = String(s); const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  K.acak = n => K.b64u(crypto.getRandomValues(new Uint8Array(n)));
  const imp = raw => crypto.subtle.importKey('raw', K.unb64u(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function zip(bytes) {
    if (!window.CompressionStream) return { z: 0, b: bytes };
    const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return { z: 1, b: new Uint8Array(await new Response(s).arrayBuffer()) };
  }
  async function unzip(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  /** Objek → string JSON terenkripsi {v,z,iv,ct}. */
  K.kunci = async (kunci, obj) => {
    const p = await zip(new TextEncoder().encode(JSON.stringify(obj)));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await imp(kunci), p.b);
    return JSON.stringify({ v: 1, z: p.z, iv: K.b64u(iv), ct: K.b64u(ct) });
  };
  K.buka = async (kunci, s) => {
    const o = typeof s === 'string' ? JSON.parse(s) : s;
    let b = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: K.unb64u(o.iv) }, await imp(kunci), K.unb64u(o.ct)));
    if (o.z) b = await unzip(b);
    return JSON.parse(new TextDecoder().decode(b));
  };
  async function kunciPin(pin, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: K.unb64u(salt), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  K.bungkusPin = async (pin, obj) => {
    const salt = K.acak(16), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kunciPin(pin, salt), new TextEncoder().encode(JSON.stringify(obj)));
    return { salt, iv: K.b64u(iv), ct: K.b64u(ct) };
  };
  K.bukaPin = async (pin, w) => JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: K.unb64u(w.iv) }, await kunciPin(pin, w.salt), K.unb64u(w.ct))));
  return K;
})();
