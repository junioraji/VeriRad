/* =====================================================================
 * VeriRad — Editor foto lampiran (setelah ambil foto dari kamera HP)
 * Putar, potong, coretan (pena / panah / kotak / teks), kecerahan & kontras,
 * urungkan, kembalikan ke asli. Hasil dikompres JPEG (maks 2000 px).
 *
 *   editFoto(sumber, { judul, nama, bolehAsli })
 *     sumber : File/Blob atau data URI
 *     → Promise<{ nama, mime, base64, dataUri } | { asli: true } | null>
 *       null = dibatalkan, { asli: true } = unggah tanpa edit
 * ===================================================================== */
'use strict';

const FE_MAKS = 2000;                    // sisi terpanjang hasil (px)
const FE_RIWAYAT = 8;                    // jumlah langkah urungkan (hemat memori HP)
const FE_WARNA = ['#EF4444', '#F37021', '#FACC15', '#22C55E', '#FFFFFF', '#0F1E3D'];
const FE_UKURAN = { S: 0.004, M: 0.007, L: 0.012 };

function feKanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function feSalin(c) { const k = feKanvas(c.width, c.height); k.getContext('2d').drawImage(c, 0, 0); return k; }
function feMuat(src) {
  return new Promise((res, rej) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const im = new Image();
    im.onload = () => { res(im); if (typeof src !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000); };
    im.onerror = () => rej(new Error('Gambar tidak bisa dibuka untuk diedit.'));
    im.src = url;
  });
}
/** Terapkan kecerahan & kontras (sama dengan CSS "brightness(b) contrast(c)") langsung ke piksel. */
function feTerapkanWarna(c, terang, kontras) {
  const ctx = c.getContext('2d'), d = ctx.getImageData(0, 0, c.width, c.height), p = d.data, b = terang / 100, k = kontras / 100;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = ((i * b / 255 - 0.5) * k + 0.5) * 255;
  for (let i = 0; i < p.length; i += 4) { p[i] = lut[p[i]]; p[i + 1] = lut[p[i + 1]]; p[i + 2] = lut[p[i + 2]]; }
  ctx.putImageData(d, 0, 0);
}
function fePanah(ctx, x0, y0, x1, y1, lebar) {
  const a = Math.atan2(y1 - y0, x1 - x0), kepala = Math.max(lebar * 4, 14);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * kepala * 0.6, y1 - Math.sin(a) * kepala * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - kepala * Math.cos(a - 0.45), y1 - kepala * Math.sin(a - 0.45));
  ctx.lineTo(x1 - kepala * Math.cos(a + 0.45), y1 - kepala * Math.sin(a + 0.45));
  ctx.closePath(); ctx.fill();
}
function feTerang(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; }

function editFoto(sumber, o) {
  o = o || {};
  return new Promise(async selesai => {
    let img;
    try { img = await feMuat(sumber); } catch (e) { toast(e.message, 'error'); return selesai(o.bolehAsli ? { asli: true } : null); }
    const s0 = Math.min(1, FE_MAKS / Math.max(img.naturalWidth, img.naturalHeight));
    let kerja = feKanvas(img.naturalWidth * s0, img.naturalHeight * s0);
    kerja.getContext('2d').drawImage(img, 0, 0, kerja.width, kerja.height);
    const asli = feSalin(kerja);
    const riwayat = [];
    let mode = '', warna = FE_WARNA[0], ukuran = 'M', terang = 100, kontras = 100, potong = null, diubah = false, sudah = false;

    const alat = (m, ikon, label) => '<button type="button" class="fe-tool" data-mode="' + m + '" aria-pressed="false" title="' + label + '" aria-label="' + label + '">' + ic(ikon) + '<span>' + label + '</span></button>';
    const m = modal({
      judul: o.judul || 'Edit foto', ikon: 'image', lebar: true,
      isi: '<div class="fe">' +
        '<div class="fe-bar" role="toolbar" aria-label="Alat edit foto">' +
        '<button type="button" class="fe-tool" data-aksi="kiri" title="Putar kiri" aria-label="Putar kiri">' + ic('rotate-ccw') + '<span>Putar kiri</span></button>' +
        '<button type="button" class="fe-tool" data-aksi="kanan" title="Putar kanan" aria-label="Putar kanan">' + ic('rotate-cw') + '<span>Putar kanan</span></button>' +
        alat('potong', 'crop', 'Potong') + alat('pena', 'pen-line', 'Pena') + alat('panah', 'move-up-right', 'Panah') + alat('kotak', 'square', 'Kotak') +
        alat('teks', 'type', 'Teks') + alat('atur', 'sun-medium', 'Cahaya') +
        '<span class="fe-sp"></span>' +
        '<button type="button" class="fe-tool" data-aksi="urung" title="Urungkan" aria-label="Urungkan">' + ic('undo-2') + '<span>Urungkan</span></button>' +
        '<button type="button" class="fe-tool" data-aksi="asli" title="Kembalikan ke foto asli" aria-label="Kembalikan ke foto asli">' + ic('image') + '<span>Asli</span></button>' +
        '</div>' +
        '<div class="fe-sub" id="fe-sub"></div>' +
        '<div class="fe-wrap"><div class="fe-stage"><canvas class="fe-c"></canvas><canvas class="fe-o"></canvas></div></div>' +
        '<p class="hint fe-info" id="fe-info">Pilih alat di atas. Foto disimpan sebagai JPEG.</p></div>',
      onClose: () => { if (!sudah) { sudah = true; selesai(null); } },
      tombol: [{ label: 'Batal' }]
        .concat(o.bolehAsli ? [{ label: 'Unggah tanpa edit', aksi: () => { sudah = true; selesai({ asli: true }); } }] : [])
        .concat([{ label: o.labelSimpan || 'Simpan & unggah', kelas: 'btn-primary', ikon: 'check', aksi: () => { sudah = true; selesai(ekspor()); } }])
    });
    $('.modal', m).classList.add('fe-modal');
    const cv = $('.fe-c', m), ov = $('.fe-o', m), sub = $('#fe-sub', m), info = $('#fe-info', m);

    function gambar() {
      cv.width = ov.width = kerja.width; cv.height = ov.height = kerja.height;
      cv.getContext('2d').drawImage(kerja, 0, 0);
      cv.style.filter = (terang !== 100 || kontras !== 100) ? 'brightness(' + terang / 100 + ') contrast(' + kontras / 100 + ')' : '';
      lapisan();
      const u = $('[data-aksi="urung"]', m); if (u) u.disabled = !riwayat.length;
      info.textContent = kerja.width + ' × ' + kerja.height + ' px' + (diubah ? ' · diedit' : '');
    }
    function simpanLangkah() { riwayat.push(feSalin(kerja)); if (riwayat.length > FE_RIWAYAT) riwayat.shift(); diubah = true; }
    function bakarWarna() {
      if (terang === 100 && kontras === 100) return;
      simpanLangkah(); feTerapkanWarna(kerja, terang, kontras); terang = 100; kontras = 100;
    }
    function lebar() { return Math.max(2, Math.round(Math.max(kerja.width, kerja.height) * FE_UKURAN[ukuran])); }
    function lapisan(bentuk) {
      const c = ov.getContext('2d');
      c.clearRect(0, 0, ov.width, ov.height);
      if (mode === 'potong' && potong) {
        const p = potong, h = Math.max(10, Math.round(Math.max(ov.width, ov.height) / 60));
        c.fillStyle = 'rgba(15,30,61,.55)'; c.fillRect(0, 0, ov.width, ov.height); c.clearRect(p.x, p.y, p.w, p.h);
        c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, h / 4); c.strokeRect(p.x, p.y, p.w, p.h);
        c.lineWidth = Math.max(1, h / 8); c.strokeStyle = 'rgba(255,255,255,.6)';
        for (let i = 1; i < 3; i++) {
          c.beginPath(); c.moveTo(p.x + p.w * i / 3, p.y); c.lineTo(p.x + p.w * i / 3, p.y + p.h); c.stroke();
          c.beginPath(); c.moveTo(p.x, p.y + p.h * i / 3); c.lineTo(p.x + p.w, p.y + p.h * i / 3); c.stroke();
        }
        c.fillStyle = '#F37021';
        [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]].forEach(([x, y]) => c.fillRect(x - h, y - h, h * 2, h * 2));
      }
      if (bentuk) gambarBentuk(c, bentuk);
    }
    function gambarBentuk(c, b) {
      c.save(); c.strokeStyle = c.fillStyle = b.warna; c.lineWidth = b.lebar; c.lineCap = c.lineJoin = 'round';
      if (b.jenis === 'pena') { c.beginPath(); b.titik.forEach((t, i) => i ? c.lineTo(t[0], t[1]) : c.moveTo(t[0], t[1])); if (b.titik.length === 1) c.lineTo(b.titik[0][0] + 0.1, b.titik[0][1]); c.stroke(); }
      else if (b.jenis === 'panah') fePanah(c, b.x0, b.y0, b.x1, b.y1, b.lebar);
      else if (b.jenis === 'kotak') c.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      else if (b.jenis === 'teks') {
        const fs = b.lebar * 6;
        c.font = '700 ' + fs + 'px Inter, system-ui, sans-serif'; c.textBaseline = 'top';
        c.lineWidth = Math.max(2, fs / 7); c.strokeStyle = feTerang(b.warna) ? 'rgba(15,30,61,.9)' : 'rgba(255,255,255,.95)';
        c.strokeText(b.teks, b.x0, b.y0); c.fillText(b.teks, b.x0, b.y0);
      }
      c.restore();
    }
    function subBar() {
      let h = '';
      if (['pena', 'panah', 'kotak', 'teks'].indexOf(mode) > -1) {
        h = '<div class="fe-warna" role="group" aria-label="Warna">' + FE_WARNA.map(w => '<button type="button" data-warna="' + w + '" aria-pressed="' + (w === warna) + '" style="background:' + w + '" aria-label="Warna ' + w + '"></button>').join('') + '</div>' +
          '<div class="seg seg-sm fe-uk" role="group" aria-label="Ketebalan">' + ['S', 'M', 'L'].map(u => '<button type="button" data-uk="' + u + '" aria-pressed="' + (u === ukuran) + '">' + u + '</button>').join('') + '</div>' +
          (mode === 'teks' ? '<input class="input fe-teks" id="fe-teks" maxlength="60" placeholder="Ketik teks, lalu ketuk foto" value="' + esc(subBar.teks || '') + '">' : '') +
          '<span class="hint">' + (mode === 'teks' ? 'Ketuk foto untuk menaruh teks.' : 'Gores di atas foto.') + '</span>';
      } else if (mode === 'potong') {
        h = '<span class="hint">Geser kotak atau sudutnya untuk memilih area.</span><span class="fe-sp"></span>' +
          '<button type="button" class="btn btn-sm" data-aksi="potong-batal">Batal</button><button type="button" class="btn btn-sm btn-primary" data-aksi="potong-ok">' + ic('crop') + 'Terapkan potongan</button>';
      } else if (mode === 'atur') {
        h = '<label class="fe-slider">' + ic('sun-medium') + '<span>Kecerahan</span><input type="range" min="40" max="180" value="' + terang + '" id="fe-terang"><b class="mono" id="fe-terang-v">' + terang + '%</b></label>' +
          '<label class="fe-slider">' + ic('circle') + '<span>Kontras</span><input type="range" min="40" max="180" value="' + kontras + '" id="fe-kontras"><b class="mono" id="fe-kontras-v">' + kontras + '%</b></label>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-aksi="atur-reset">Normal</button>';
      }
      sub.innerHTML = h; sub.hidden = !h;
      $$('[data-warna]', sub).forEach(b => b.addEventListener('click', () => { warna = b.dataset.warna; subBar(); }));
      $$('[data-uk]', sub).forEach(b => b.addEventListener('click', () => { ukuran = b.dataset.uk; subBar(); }));
      const t = $('#fe-teks', sub); if (t) t.addEventListener('input', () => { subBar.teks = t.value; });
      ['terang', 'kontras'].forEach(k => {
        const r = $('#fe-' + k, sub); if (!r) return;
        r.addEventListener('input', () => { if (k === 'terang') terang = Number(r.value); else kontras = Number(r.value); $('#fe-' + k + '-v', sub).textContent = r.value + '%'; gambar(); });
      });
    }
    function pilihMode(baru) {
      if (mode === 'atur' && baru !== 'atur') bakarWarna();
      mode = mode === baru ? '' : baru;
      if (mode === 'potong') { const mx = Math.round(kerja.width * 0.05), my = Math.round(kerja.height * 0.05); potong = { x: mx, y: my, w: kerja.width - mx * 2, h: kerja.height - my * 2 }; }
      $$('[data-mode]', m).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      ov.style.touchAction = mode && mode !== 'atur' ? 'none' : 'auto';
      ov.style.cursor = mode === 'teks' ? 'text' : mode && mode !== 'atur' ? 'crosshair' : 'default';
      subBar(); gambar();
      if (mode === 'teks') { const t = $('#fe-teks', sub); if (t) t.focus(); }
    }
    function putar(arah) {
      bakarWarna(); simpanLangkah();
      const k = feKanvas(kerja.height, kerja.width), c = k.getContext('2d');
      c.translate(k.width / 2, k.height / 2); c.rotate(arah * Math.PI / 2); c.drawImage(kerja, -kerja.width / 2, -kerja.height / 2);
      kerja = k; if (mode === 'potong') { mode = ''; pilihMode('potong'); } else gambar();
    }
    function ekspor() {
      bakarWarna();
      const uri = kerja.toDataURL('image/jpeg', 0.85);
      const dasar = String(o.nama || 'foto').replace(/\.[a-z0-9]+$/i, '').replace(/-edit$/, '') || 'foto';
      return { nama: dasar + (diubah ? '-edit' : '') + '.jpg', mime: 'image/jpeg', base64: uri.split(',')[1], dataUri: uri, diubah };
    }

    $$('[data-mode]', m).forEach(b => b.addEventListener('click', () => pilihMode(b.dataset.mode)));
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-aksi]'); if (!b || !m.contains(b)) return;
      const a = b.dataset.aksi;
      if (a === 'kiri') putar(-1);
      else if (a === 'kanan') putar(1);
      else if (a === 'urung') { if (riwayat.length) { kerja = riwayat.pop(); terang = kontras = 100; diubah = true; if (mode === 'potong' || mode === 'atur') pilihMode(mode); gambar(); } }
      else if (a === 'asli') { simpanLangkah(); kerja = feSalin(asli); terang = kontras = 100; diubah = false; mode = ''; pilihMode(''); }
      else if (a === 'potong-batal') pilihMode('potong');
      else if (a === 'potong-ok' && potong) {
        simpanLangkah();
        const p = { x: Math.round(potong.x), y: Math.round(potong.y), w: Math.round(potong.w), h: Math.round(potong.h) };
        const k = feKanvas(p.w, p.h); k.getContext('2d').drawImage(kerja, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h);
        kerja = k; mode = 'potong'; pilihMode('potong');
      }
      else if (a === 'atur-reset') { terang = kontras = 100; subBar(); gambar(); }
    });

    // ---- interaksi pointer di atas foto ----
    let tarik = null;
    const titik = e => { const r = ov.getBoundingClientRect(); return [(e.clientX - r.left) * ov.width / r.width, (e.clientY - r.top) * ov.height / r.height]; };
    ov.addEventListener('pointerdown', e => {
      if (!mode || mode === 'atur') return;
      const [x, y] = titik(e);
      if (mode === 'teks') {
        const t = String(subBar.teks || '').trim();
        if (!t) { toast('Ketik teksnya dulu di kolom atas.', 'info'); const i = $('#fe-teks', sub); if (i) i.focus(); return; }
        bakarWarna(); simpanLangkah(); gambarBentuk(kerja.getContext('2d'), { jenis: 'teks', teks: t, x0: x, y0: y, warna, lebar: lebar() }); gambar();
        return;
      }
      e.preventDefault(); ov.setPointerCapture(e.pointerId);
      if (mode === 'potong') {
        const p = potong, h = Math.max(24, Math.max(ov.width, ov.height) / 25);
        const sudut = [[p.x, p.y, 'tl'], [p.x + p.w, p.y, 'tr'], [p.x, p.y + p.h, 'bl'], [p.x + p.w, p.y + p.h, 'br']].find(([sx, sy]) => Math.abs(sx - x) < h && Math.abs(sy - y) < h);
        if (sudut) tarik = { jenis: 'ubah', sudut: sudut[2], awal: Object.assign({}, p) };
        else if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) tarik = { jenis: 'geser', dx: x - p.x, dy: y - p.y };
        else { tarik = { jenis: 'baru', x0: x, y0: y }; potong = { x, y, w: 1, h: 1 }; }
        return;
      }
      tarik = { jenis: mode, titik: [[x, y]], x0: x, y0: y, x1: x, y1: y, warna, lebar: lebar() };
      lapisan(tarik);
    });
    ov.addEventListener('pointermove', e => {
      if (!tarik) return;
      const [x0, y0] = titik(e), W = kerja.width, H = kerja.height, x = Math.max(0, Math.min(W, x0)), y = Math.max(0, Math.min(H, y0)), min = 20;
      if (mode === 'potong') {
        const p = potong;
        if (tarik.jenis === 'geser') { p.x = Math.max(0, Math.min(W - p.w, x - tarik.dx)); p.y = Math.max(0, Math.min(H - p.h, y - tarik.dy)); }
        else if (tarik.jenis === 'baru') { p.x = Math.min(tarik.x0, x); p.y = Math.min(tarik.y0, y); p.w = Math.abs(x - tarik.x0); p.h = Math.abs(y - tarik.y0); }
        else {
          const a = tarik.awal, kanan = a.x + a.w, bawah = a.y + a.h, s = tarik.sudut;
          const l = s[1] === 'l' ? Math.min(x, kanan - min) : a.x, r = s[1] === 'r' ? Math.max(x, a.x + min) : kanan;
          const t = s[0] === 't' ? Math.min(y, bawah - min) : a.y, b = s[0] === 'b' ? Math.max(y, a.y + min) : bawah;
          Object.assign(p, { x: l, y: t, w: r - l, h: b - t });
        }
        lapisan(); return;
      }
      if (tarik.jenis === 'pena') tarik.titik.push([x0, y0]); else { tarik.x1 = x0; tarik.y1 = y0; }
      lapisan(tarik);
    });
    const lepas = () => {
      if (!tarik) return;
      if (mode === 'potong') { if (potong.w < 20 || potong.h < 20) { mode = ''; pilihMode('potong'); } tarik = null; return; }
      const b = tarik; tarik = null;
      if ((b.jenis === 'panah' || b.jenis === 'kotak') && Math.hypot(b.x1 - b.x0, b.y1 - b.y0) < 4) { lapisan(); return; }
      bakarWarna(); simpanLangkah(); gambarBentuk(kerja.getContext('2d'), b); gambar();
    };
    ov.addEventListener('pointerup', lepas);
    ov.addEventListener('pointercancel', lepas);
    subBar(); gambar();
  });
}
