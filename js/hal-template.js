/* =====================================================================
 * VeriRad — Template Toleransi: parameter, rumus, dan batas per jenis alat
 * Perubahan disimpan sebagai versi baru; sesi final lama memakai snapshot.
 * ===================================================================== */
'use strict';

const TP = { id: '', kat: '', meta: null, params: null, kotor: false, pilih: new Set() };

/* ---------- Papan klip parameter (salin antar-template) ---------- */
const KlipParam = {
  ambil() { return Store.get(userKey('klip:param'), null); },
  isi(asal, params) { Store.set(userKey('klip:param'), { asal, waktu: Date.now(), params }); },
  kosongkan() { Store.del(userKey('klip:param')); }
};
const reKode = k => new RegExp('\\b' + k + '\\b', 'g');
function refParam(p) {                                   // kode yang dipakai rumus / batas ekspresi
  const teks = [p.tipe_input === 'HITUNG' ? p.formula : '', vrAngka(p.batas_min) === null ? p.batas_min : '', vrAngka(p.batas_maks) === null ? p.batas_maks : ''].join(' ');
  const out = [];
  (teks.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).forEach(k => { if (k.toUpperCase() === k && out.indexOf(k) === -1) out.push(k); });
  return out;
}
/** Nomori ulang urutan sesuai susunan tampilan (per kategori). */
function nomoriUlang() {
  let n = 0;
  VR_KATEGORI.forEach(k => vrUrutParam(TP.params.filter(p => p.kategori === k)).forEach(p => { n += 10; p.urutan = String(n); }));
  TP.params.filter(p => VR_KATEGORI.indexOf(p.kategori) === -1).forEach(p => { n += 10; p.urutan = String(n); });
}
/** Pindahkan parameter `kode` ke posisi sebelum/sesudah `target` (harus satu kategori). */
function pindahParam(kode, target, sesudah) {
  const a = TP.params.find(p => p.kode === kode), b = TP.params.find(p => p.kode === target);
  if (!a || !b || a === b) return false;
  if (a.kategori !== b.kategori) { toast('Urutan hanya bisa diubah di dalam kategori yang sama. Ubah kategorinya lewat tombol Ubah.', 'warning'); return false; }
  const daftar = vrUrutParam(TP.params.filter(p => p.kategori === a.kategori)).filter(p => p !== a);
  const i = daftar.indexOf(b);
  daftar.splice(sesudah ? i + 1 : i, 0, a);
  daftar.forEach((p, j) => { p.urutan = String(j + 1); });
  nomoriUlang();
  return true;
}
/** Tempel salinan parameter; kode bentrok diberi akhiran _2, _3… dan rumus ikut disesuaikan. */
function tempelParam(list) {
  const ada = new Set(TP.params.map(p => p.kode)), ganti = {};
  list.forEach(p => {
    let k = p.kode, i = 2;
    while (ada.has(k)) { k = (p.kode.slice(0, 27) + '_' + i++); }
    ada.add(k); ganti[p.kode] = k;
  });
  const baru = list.map((p, i) => {
    const c = Object.assign({}, p, { kode: ganti[p.kode], urutan: String(1e6 + i) });
    delete c.param_id; delete c.template_id;
    Object.keys(ganti).forEach(lama => {
      if (lama === ganti[lama]) return;
      if (c.tipe_input === 'HITUNG') c.formula = String(c.formula || '').replace(reKode(lama), ganti[lama]);
      ['batas_min', 'batas_maks'].forEach(f => { if (vrAngka(c[f]) === null) c[f] = String(c[f] || '').replace(reKode(lama), ganti[lama]); });
    });
    return c;
  });
  TP.params = TP.params.concat(baru);
  nomoriUlang();
  const semua = TP.params.map(p => p.kode);
  const putus = baru.filter(p => refParam(p).some(k => semua.indexOf(k) === -1));
  return { jumlah: baru.length, diganti: Object.keys(ganti).filter(k => ganti[k] !== k).map(k => k + ' → ' + ganti[k]), putus: putus.map(p => p.kode) };
}

daftarHalaman('template', {
  judul: 'Template Toleransi', akses: 'fismed',
  render(el) {
    const list = AppState.templates.slice().sort((a, b) => (vrBenar(b.aktif) - vrBenar(a.aktif)) || a.nama.localeCompare(b.nama));
    if (!TP.id || (TP.id !== 'BARU' && !getTpl(TP.id))) pilihTemplate(list[0] ? list[0].template_id : 'BARU');
    el.innerHTML = '<div class="page-h"><div><h1>Template Toleransi & Rumus QC</h1><p>Parameter uji, rumus hitung otomatis, dan batas toleransi untuk setiap jenis alat.</p></div>' +
      '<div class="act"><button class="btn" id="tp-dup"' + (TP.id === 'BARU' ? ' disabled' : '') + '>' + ic('copy') + 'Duplikat</button><button class="btn btn-primary" id="tp-baru">' + ic('plus') + 'Template baru</button></div></div>' +
      '<div class="banner banner-warn">' + ic('scale') + '<div class="t small"><b>Tanggung jawab fisikawan medis.</b> Template bawaan hanyalah titik awal dari contoh laporan. Verifikasi setiap batas terhadap acuan yang berlaku. ' +
      'Menyimpan template membuat versi baru; sesi QC final yang sudah ada tetap memakai toleransi saat diuji.</div></div>' +
      '<div class="stack"><div class="list-rs tpl-list">' + list.map(t => {
        const n = paramsTpl(t.template_id).filter(p => vrBenar(p.aktif)), al = AppState.alat.filter(a => a.template_id === t.template_id && vrBenar(a.aktif)).length;
        const ragu = n.filter(p => /⚠/.test(p.keterangan || '')).length;
        return '<button class="rs-card card" data-t="' + t.template_id + '" aria-pressed="' + (t.template_id === TP.id) + '"><span class="hstack between"><span class="nm">' + esc(t.nama) + '</span><span class="tag tag-soft">v' + esc(t.versi) + '</span></span>' +
          '<span class="small muted">' + n.length + ' parameter · ' + n.filter(p => p.tipe_toleransi !== 'TIDAK_ADA').length + ' dinilai · ' + al + ' alat</span>' +
          (ragu ? '<span class="small" style="color:var(--orange-text)">⚠ ' + ragu + ' butir perlu keputusan</span>' : '') + (vrBenar(t.aktif) ? '' : '<span class="badge b-na">Nonaktif</span>') + '</button>';
      }).join('') + '</div><div class="stack" id="tp-kanan"></div></div>';
    $$('[data-t]', el).forEach(b => b.addEventListener('click', async () => {
      if (TP.kotor && !(await konfirmasi('Buang perubahan?', 'Perubahan pada template ' + (TP.meta.nama || '') + ' belum disimpan.', 'Buang perubahan', true))) return;
      pilihTemplate(b.dataset.t); Halaman.template.render(el);
    }));
    $('#tp-baru', el).addEventListener('click', async () => {
      if (TP.kotor && !(await konfirmasi('Buang perubahan?', 'Perubahan template saat ini belum disimpan.', 'Buang perubahan', true))) return;
      pilihTemplate('BARU'); Halaman.template.render(el);
    });
    $('#tp-dup', el).addEventListener('click', () => {
      const asal = TP.meta;
      TP.id = 'BARU'; TP.meta = { template_id: '', nama: asal.nama + ' (salinan)', singkatan: asal.singkatan, aktif: 'TRUE', versi: '0' }; TP.kotor = true;
      Halaman.template.render(el);
      toast('Salinan dibuat. Ubah namanya lalu simpan.', 'info');
    });
    gambarTemplateKanan($('#tp-kanan', el), el);
  }
});

function pilihTemplate(id) {
  TP.id = id; TP.kat = ''; TP.kotor = false; TP.pilih = new Set();
  if (id === 'BARU') { TP.meta = { template_id: '', nama: '', singkatan: '', aktif: 'TRUE', versi: '0' }; TP.params = []; return; }
  const t = getTpl(id);
  TP.meta = Object.assign({}, t);
  TP.params = vrUrutParam(paramsTpl(id)).map(p => Object.assign({}, p));
}

function gambarTemplateKanan(box, el) {
  const ps = TP.params, tampil = vrUrutParam(ps).filter(p => !TP.kat || p.kategori === TP.kat);
  const kode = ps.filter(p => vrBenar(p.aktif)).map(p => p.kode);
  const err = {};
  ps.filter(p => vrBenar(p.aktif)).forEach(p => { const m = validasiParamLokal(p, kode); if (m) err[p.kode] = m; });
  if (!Object.keys(err).length && ps.length) {
    const ev = vrEvaluasi(ps, {}, '.');
    Object.keys(ev).forEach(k => { if (ev[k].status === 'ERROR' && ev[k].pesan) err[k] = ev[k].pesan; });
  }
  box.innerHTML = '<div class="card"><div class="card-h"><h2>' + ic('sliders-horizontal') + (TP.id === 'BARU' ? 'Template baru' : esc(TP.meta.nama)) + '</h2>' + (TP.id !== 'BARU' ? '<span class="tag tag-soft">versi ' + esc(TP.meta.versi) + '</span>' : '') + '</div>' +
    '<div class="card-b grid-3"><div class="field"><label for="tp-nama">Nama jenis alat <span class="req">*</span></label><input class="input" id="tp-nama" value="' + esc(TP.meta.nama) + '" placeholder="mis. Fluoroskopi"></div>' +
    '<div class="field"><label for="tp-sing">Singkatan</label><input class="input" id="tp-sing" maxlength="6" value="' + esc(TP.meta.singkatan || '') + '" placeholder="mis. FL"></div>' +
    '<div class="field"><span class="lbl">Status</span><label class="switch" style="height:38px"><input type="checkbox" id="tp-aktif"' + (vrBenar(TP.meta.aktif) ? ' checked' : '') + '><span class="trk"></span>Aktif untuk alat baru</label></div></div>' +
    '<div class="card-b" style="padding-top:0"><div class="stat-cells"><div><div class="k">Total parameter</div><div class="v">' + ps.length + '</div></div><div><div class="k">Dinilai</div><div class="v">' + ps.filter(p => p.tipe_toleransi !== 'TIDAK_ADA' && vrBenar(p.aktif)).length + '</div></div>' +
    '<div><div class="k">Rumus otomatis</div><div class="v">' + ps.filter(p => p.tipe_input === 'HITUNG').length + '</div></div><div class="' + (Object.keys(err).length ? 'gagal' : 'lulus') + '"><div class="k">Error validasi</div><div class="v">' + Object.keys(err).length + '</div></div></div></div></div>' +
    '<div class="card"><div class="tabs" style="padding:0 12px"><button data-k="" aria-selected="' + !TP.kat + '">Semua <span class="cnt">' + ps.length + '</span></button>' +
    VR_KATEGORI.map((k, i) => '<button data-k="' + k + '" aria-selected="' + (TP.kat === k) + '">' + (i + 1) + '. ' + esc(k) + ' <span class="cnt">' + ps.filter(p => p.kategori === k).length + '</span></button>').join('') + '</div>' +
    toolbarParam() +
    (tampil.length ? '<div class="tbl-wrap"><table class="tbl tbl-param"><thead><tr><th class="c" style="width:36px"><input type="checkbox" id="tp-semua" aria-label="Pilih semua parameter yang tampil"' + (tampil.length && tampil.every(p => TP.pilih.has(p.kode)) ? ' checked' : '') + '></th>' +
      '<th style="width:64px" title="Seret untuk mengubah urutan">Urutan</th><th>Parameter</th><th>Input & rumus</th><th>Toleransi</th><th class="c">Wajib</th><th class="c">N/A</th><th class="c">Aktif</th><th></th></tr></thead><tbody>' +
      tampil.map((p, i) => {
        const sebelum = tampil[i - 1], sesudah = tampil[i + 1];
        const bisaNaik = sebelum && sebelum.kategori === p.kategori, bisaTurun = sesudah && sesudah.kategori === p.kategori;
        return '<tr class="' + (err[p.kode] ? 'is-fail' : '') + (TP.pilih.has(p.kode) ? ' is-sel' : '') + '" draggable="true" data-row="' + p.kode + '">' +
        '<td class="c"><input type="checkbox" data-pilih="' + p.kode + '" aria-label="Pilih ' + esc(p.kode) + '"' + (TP.pilih.has(p.kode) ? ' checked' : '') + '></td>' +
        '<td><div class="urut"><span class="grip" title="Seret untuk memindah">' + ic('grip-vertical') + '</span><span class="updown">' +
        '<button class="btn btn-ghost btn-icon" data-naik="' + p.kode + '" aria-label="Naikkan ' + esc(p.kode) + '"' + (bisaNaik ? '' : ' disabled') + '>' + ic('chevron-up') + '</button>' +
        '<button class="btn btn-ghost btn-icon" data-turun="' + p.kode + '" aria-label="Turunkan ' + esc(p.kode) + '"' + (bisaTurun ? '' : ' disabled') + '>' + ic('chevron-down') + '</button></span></div></td>' +
        '<td><span class="tag tag-soft">' + esc(p.kode) + '</span> <b>' + esc(p.nama) + '</b><span class="sub">' + esc(p.kategori + ' · ' + (p.kelompok || 'Umum')) + '</span>' +
        (p.keterangan ? '<span class="sub" style="color:var(--orange-text)">' + esc(p.keterangan) + '</span>' : '') + (err[p.kode] ? '<span class="err-msg">' + ic('circle-alert') + esc(err[p.kode]) + '</span>' : '') + '</td>' +
        '<td class="small">' + esc(VR_TIPE_INPUT[p.tipe_input] || p.tipe_input) + (p.satuan ? ' · <span class="mono">' + esc(p.satuan) + '</span>' : '') + (p.tipe_input === 'HITUNG' ? '<span class="sub mono">= ' + esc(p.formula) + '</span>' : p.tipe_input === 'KUALITATIF' ? '<span class="sub">' + esc(p.opsi.split('|').join(' / ')) + '</span>' : '') + '</td>' +
        '<td class="m">' + (p.tipe_toleransi === 'TIDAK_ADA' ? '<span class="muted">data</span>' : esc(vrTeksToleransi(p, null, null, sep()))) + '<span class="sub">' + esc((VR_TIPE_TOL[p.tipe_toleransi] || '').split(' (')[0]) + '</span></td>' +
        '<td class="c">' + (vrBenar(p.wajib) ? '✓' : '—') + '</td><td class="c">' + (vrBenar(p.boleh_na) ? '✓' : '—') + '</td><td class="c">' + (vrBenar(p.aktif) ? '<span class="badge b-lulus">Ya</span>' : '<span class="badge b-na">Tidak</span>') + '</td>' +
        '<td><div class="hstack" style="flex-wrap:nowrap"><button class="btn btn-sm btn-ghost btn-icon" data-ed="' + p.kode + '" aria-label="Ubah ' + esc(p.kode) + '" title="Ubah">' + ic('pencil') + '</button>' +
        '<button class="btn btn-sm btn-ghost btn-icon" data-dupl="' + p.kode + '" aria-label="Duplikat ' + esc(p.kode) + '" title="Duplikat di template ini">' + ic('copy-plus') + '</button>' +
        '<button class="btn btn-sm btn-ghost btn-icon" data-del="' + p.kode + '" aria-label="Hapus ' + esc(p.kode) + '" title="Hapus">' + ic('trash-2') + '</button></div></td></tr>';
      }).join('') +
      '</tbody></table></div><div class="tbl-foot"><span>' + ic('grip-vertical') + ' Seret baris (atau pakai tombol ▲▼) untuk mengatur urutan tampil di form QC dan laporan.</span></div>' : kosong('Belum ada parameter', 'Tambahkan parameter uji, atau tempel parameter yang disalin dari template lain.')) +
    '<div class="card-f" style="justify-content:flex-start"><button class="btn btn-dashed" id="tp-tambah">' + ic('plus') + 'Tambah parameter</button></div></div>' +
    '<div class="sticky-bar"><span class="sp small ' + (TP.kotor ? '' : 'muted') + '">' + (TP.kotor ? ic('circle-dot') + ' <b>Perubahan belum disimpan</b>' : ic('circle-check') + ' Tersimpan') + '</span>' +
    (TP.kotor && TP.id !== 'BARU' ? '<button class="btn" id="tp-batal">Batalkan perubahan</button>' : '') +
    '<button class="btn btn-primary" id="tp-simpan"' + (TP.kotor ? '' : ' disabled') + '>' + ic('save') + (TP.id === 'BARU' ? 'Simpan template' : 'Simpan sebagai versi ' + ((parseInt(TP.meta.versi, 10) || 0) + 1)) + '</button></div>';
  const tandai = () => { TP.kotor = true; gambarTemplateKanan(box, el); };
  $('#tp-nama', box).addEventListener('change', e => { TP.meta.nama = e.target.value; tandai(); });
  $('#tp-sing', box).addEventListener('change', e => { TP.meta.singkatan = e.target.value; tandai(); });
  $('#tp-aktif', box).addEventListener('change', e => { TP.meta.aktif = e.target.checked ? 'TRUE' : 'FALSE'; tandai(); });
  $$('.tabs [data-k]', box).forEach(b => b.addEventListener('click', () => { TP.kat = b.dataset.k; gambarTemplateKanan(box, el); }));
  $('#tp-tambah', box).addEventListener('click', () => editorParam(null, () => tandai()));
  $$('[data-ed]', box).forEach(b => b.addEventListener('click', () => editorParam(TP.params.find(p => p.kode === b.dataset.ed), () => tandai())));
  $$('[data-del]', box).forEach(b => b.addEventListener('click', async () => {
    const k = b.dataset.del;
    const re = new RegExp('\\b' + k + '\\b');
    const dipakai = TP.params.filter(p => p.kode !== k && re.test([p.tipe_input === 'HITUNG' ? p.formula : '', vrAngka(p.batas_min) === null ? p.batas_min : '', vrAngka(p.batas_maks) === null ? p.batas_maks : ''].join(' ')));
    if (dipakai.length) return toast(k + ' dipakai di rumus ' + dipakai.map(p => p.kode).join(', ') + '. Ubah rumus itu dulu, atau nonaktifkan parameter ini.', 'warning');
    if (!(await konfirmasi('Hapus parameter ' + k + '?', 'Parameter dihapus dari template saat disimpan. Sesi final lama tetap menyimpan nilainya.', 'Hapus', true))) return;
    TP.params = TP.params.filter(p => p.kode !== k); tandai();
  }));
  // pilih, salin, tempel, duplikat
  const cbAll = $('#tp-semua', box);
  if (cbAll) cbAll.addEventListener('change', () => { tampil.forEach(p => cbAll.checked ? TP.pilih.add(p.kode) : TP.pilih.delete(p.kode)); gambarTemplateKanan(box, el); });
  $$('[data-pilih]', box).forEach(cb => cb.addEventListener('change', () => { cb.checked ? TP.pilih.add(cb.dataset.pilih) : TP.pilih.delete(cb.dataset.pilih); gambarTemplateKanan(box, el); }));
  const bSalin = $('#tp-salin', box);
  if (bSalin) bSalin.addEventListener('click', () => {
    const kode = new Set(TP.pilih), tambahan = [];
    let ulang = true;
    while (ulang) {                                      // ikutkan parameter yang dipakai rumus terpilih
      ulang = false;
      TP.params.filter(p => kode.has(p.kode)).forEach(p => refParam(p).forEach(k => {
        if (!kode.has(k) && TP.params.some(x => x.kode === k)) { kode.add(k); tambahan.push(k); ulang = true; }
      }));
    }
    const list = vrUrutParam(TP.params.filter(p => kode.has(p.kode))).map(p => Object.assign({}, p));
    KlipParam.isi(TP.meta.nama || 'template baru', list);
    TP.pilih = new Set();
    toast(list.length + ' parameter disalin.' + (tambahan.length ? ' Termasuk ' + tambahan.length + ' parameter yang dipakai rumusnya (' + tambahan.join(', ') + ').' : '') + ' Buka template tujuan lalu klik Tempel.', 'success');
    gambarTemplateKanan(box, el);
  });
  const bDupl = $('#tp-dupl-pilih', box);
  if (bDupl) bDupl.addEventListener('click', () => {
    const list = vrUrutParam(TP.params.filter(p => TP.pilih.has(p.kode))).map(p => Object.assign({}, p));
    const r = tempelParam(list); TP.pilih = new Set();
    toast(r.jumlah + ' parameter diduplikat: ' + r.diganti.join(', '), 'success'); tandai();
  });
  $$('[data-dupl]', box).forEach(b => b.addEventListener('click', () => {
    const r = tempelParam([Object.assign({}, TP.params.find(p => p.kode === b.dataset.dupl), { nama: TP.params.find(p => p.kode === b.dataset.dupl).nama + ' (salinan)' })]);
    toast('Diduplikat sebagai ' + r.diganti.join(', ').split(' → ')[1] + '. Ubah nama dan isinya bila perlu.', 'success'); tandai();
  }));
  const bTempel = $('#tp-tempel', box);
  if (bTempel) bTempel.addEventListener('click', () => {
    const klip = KlipParam.ambil(); if (!klip) return;
    const r = tempelParam(klip.params.map(p => Object.assign({}, p)));
    let pesan = r.jumlah + ' parameter ditempel dari "' + klip.asal + '".';
    if (r.diganti.length) pesan += '\nKode yang sudah ada diganti: ' + r.diganti.join(', ') + '.';
    if (r.putus.length) pesan += '\n⚠ Rumus ' + r.putus.join(', ') + ' memakai kode yang tidak ada di template ini (baris merah).';
    toast(pesan, r.putus.length ? 'warning' : 'success'); tandai();
  });
  const bKlipX = $('#tp-klip-x', box);
  if (bKlipX) bKlipX.addEventListener('click', () => { KlipParam.kosongkan(); gambarTemplateKanan(box, el); });
  // urutan: tombol naik/turun & seret
  $$('[data-naik]', box).forEach(b => b.addEventListener('click', () => { const i = tampil.findIndex(p => p.kode === b.dataset.naik); if (pindahParam(b.dataset.naik, tampil[i - 1].kode, false)) { tandai(); const x = $('[data-naik="' + b.dataset.naik + '"]', box); if (x && !x.disabled) x.focus(); } }));
  $$('[data-turun]', box).forEach(b => b.addEventListener('click', () => { const i = tampil.findIndex(p => p.kode === b.dataset.turun); if (pindahParam(b.dataset.turun, tampil[i + 1].kode, true)) { tandai(); const x = $('[data-turun="' + b.dataset.turun + '"]', box); if (x && !x.disabled) x.focus(); } }));
  let seret = null;
  $$('tr[data-row]', box).forEach(tr => {
    tr.addEventListener('dragstart', e => {
      if (e.target.closest && e.target.closest('input, button, a') && !e.target.closest('.grip')) { e.preventDefault(); return; }
      seret = tr.dataset.row; tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', seret); } catch (x) { }
    });
    tr.addEventListener('dragend', () => { tr.classList.remove('dragging'); $$('tr.drop-atas, tr.drop-bawah', box).forEach(x => x.classList.remove('drop-atas', 'drop-bawah')); seret = null; });
    tr.addEventListener('dragover', e => {
      if (!seret || seret === tr.dataset.row) return;
      e.preventDefault();
      const r = tr.getBoundingClientRect(), bawah = e.clientY > r.top + r.height / 2;
      $$('tr.drop-atas, tr.drop-bawah', box).forEach(x => x.classList.remove('drop-atas', 'drop-bawah'));
      tr.classList.add(bawah ? 'drop-bawah' : 'drop-atas');
    });
    tr.addEventListener('drop', e => {
      if (!seret) return;
      e.preventDefault();
      const bawah = tr.classList.contains('drop-bawah');
      if (pindahParam(seret, tr.dataset.row, bawah)) tandai(); else gambarTemplateKanan(box, el);
    });
  });
  const bt = $('#tp-batal', box);
  if (bt) bt.addEventListener('click', () => { pilihTemplate(TP.id); Halaman.template.render(el); });
  $('#tp-simpan', box).addEventListener('click', async e => {
    if (!String(TP.meta.nama || '').trim()) { $('#tp-nama', box).focus(); return toast('Nama template wajib diisi.', 'warning'); }
    if (Object.keys(err).length) return toast('Perbaiki ' + Object.keys(err).length + ' error validasi dulu (baris merah).', 'warning');
    setBusy(e.currentTarget, true, 'Menyimpan…');
    const r = await api('template.simpan', { template: { template_id: TP.meta.template_id, nama: TP.meta.nama, singkatan: TP.meta.singkatan, aktif: TP.meta.aktif }, params: TP.params });
    setBusy(e.currentTarget, false);
    if (!r.success) return toast(r.message, 'error');
    toast(r.message, 'success');
    TP.kotor = false; TP.id = r.data.template_id;
    await segarkanBoot(true);
    pilihTemplate(r.data.template_id); rute();
  });
}

function toolbarParam() {
  const n = TP.pilih.size, klip = KlipParam.ambil();
  if (!n && !klip) return '<div class="tb-param"><span class="small muted">' + ic('info') + ' Centang parameter untuk menyalin atau menduplikatnya.</span></div>';
  return '<div class="tb-param">' +
    (n ? '<span class="small"><b>' + n + '</b> dipilih</span><button class="btn btn-sm" id="tp-salin">' + ic('clipboard-copy') + 'Salin ke papan klip</button><button class="btn btn-sm" id="tp-dupl-pilih">' + ic('copy-plus') + 'Duplikat di sini</button>' : '') +
    (klip ? '<span class="sp"></span><span class="klip">' + ic('clipboard-paste') + '<span>Papan klip: <b>' + klip.params.length + ' parameter</b> dari "' + esc(klip.asal) + '"</span>' +
      '<button class="btn btn-sm btn-primary" id="tp-tempel">' + ic('clipboard-paste') + 'Tempel di sini</button><button class="btn btn-sm btn-ghost btn-icon" id="tp-klip-x" title="Kosongkan papan klip" aria-label="Kosongkan papan klip">' + ic('x') + '</button></span>' : '') +
    '</div>';
}

function validasiParamLokal(p, kode) {
  if (!/^[A-Z][A-Z0-9_]{0,29}$/.test(p.kode)) return 'Kode harus huruf kapital/angka/garis bawah, diawali huruf.';
  if (p.tipe_input === 'HITUNG') { const m = vrCekRumus(p.formula, kode); if (m) return 'Rumus: ' + m; }
  if (p.tipe_input === 'KUALITATIF') {
    const o = String(p.opsi || '').split('|').map(x => x.trim()).filter(Boolean);
    if (o.length < 2) return 'Isi minimal 2 pilihan.';
    if (p.tipe_toleransi === 'KUALITATIF' && o.indexOf(String(p.acuan || '').trim()) === -1) return 'Acuan harus salah satu pilihan.';
  } else if (p.tipe_toleransi === 'KUALITATIF') return 'Toleransi "sama dengan acuan" hanya untuk tipe pilihan.';
  const perluMin = ['MIN', 'LEBIH', 'RENTANG'].indexOf(p.tipe_toleransi) > -1, perluMaks = ['MAKS', 'KURANG', 'RENTANG', 'MUTLAK_PM'].indexOf(p.tipe_toleransi) > -1;
  if (perluMin && !String(p.batas_min || '').trim()) return 'Batas minimum wajib diisi.';
  if (perluMaks && !String(p.batas_maks || '').trim()) return 'Batas maksimum wajib diisi.';
  for (const b of ['batas_min', 'batas_maks']) { const v = String(p[b] || '').trim(); if (v && vrAngka(v) === null) { const m = vrCekRumus(v, kode); if (m) return 'Batas: ' + m; } }
  return '';
}

function editorParam(p, selesai) {
  const baru = !p;
  const d = Object.assign({ kategori: TP.kat || 'Mekanik', kelompok: '', kode: '', nama: '', tipe_input: 'ANGKA', satuan: '', tipe_toleransi: 'MAKS', batas_min: '', batas_maks: '', formula: '', opsi: 'Berfungsi|Tidak Berfungsi',
    acuan: 'Berfungsi', desimal: '2', urutan: String((TP.params.reduce((m, x) => Math.max(m, Number(x.urutan) || 0), 0)) + 10), wajib: 'TRUE', boleh_na: 'FALSE', aktif: 'TRUE', keterangan: '' }, p || {});
  const kelompok = Array.from(new Set(TP.params.map(x => x.kelompok).filter(Boolean)));
  const kodeLain = TP.params.filter(x => !p || x.kode !== p.kode).map(x => x.kode);
  const m = modal({
    judul: baru ? 'Tambah parameter' : 'Ubah parameter ' + p.kode, ikon: 'sliders-horizontal', lebar: true,
    isi: '<div class="grid-3">' +
      '<div class="field"><label for="e-kat">Kategori</label><select class="input" id="e-kat">' + VR_KATEGORI.map(k => '<option' + (k === d.kategori ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="e-kel">Kelompok</label><input class="input" id="e-kel" list="dl-kel" value="' + esc(d.kelompok) + '" placeholder="mis. Iluminasi"><datalist id="dl-kel">' + kelompok.map(k => '<option value="' + esc(k) + '">').join('') + '</datalist></div>' +
      '<div class="field"><label for="e-kode">Kode unik <span class="req">*</span></label><input class="input mono" id="e-kode" value="' + esc(d.kode) + '" placeholder="mis. IL_SELISIH"' + (baru ? '' : ' readonly') + '><span class="hint">' + (baru ? 'Dipakai di rumus. Huruf kapital, angka, _' : 'Kode tidak bisa diubah (dipakai di riwayat).') + '</span></div>' +
      '<div class="field span-2"><label for="e-nama">Nama parameter <span class="req">*</span></label><input class="input" id="e-nama" value="' + esc(d.nama) + '"></div>' +
      '<div class="field"><label for="e-sat">Satuan</label><input class="input mono" id="e-sat" value="' + esc(d.satuan) + '" placeholder="lux, %, mm, HU…"></div>' +
      '<div class="field"><label for="e-tin">Tipe input</label><select class="input" id="e-tin">' + Object.keys(VR_TIPE_INPUT).map(k => '<option value="' + k + '"' + (k === d.tipe_input ? ' selected' : '') + '>' + VR_TIPE_INPUT[k] + '</option>').join('') + '</select></div>' +
      '<div class="field span-2"><label for="e-dec">Desimal tampilan</label><input class="input mono" id="e-dec" type="number" min="0" max="6" value="' + esc(d.desimal) + '"><span class="hint">Nilai dibulatkan half-up sebelum dinilai.</span></div>' +
      '<div class="field span-2" id="w-rumus"><label for="e-rumus">Rumus</label><input class="input mono" id="e-rumus" value="' + esc(d.formula) + '" placeholder="mis. avg(IL_Q1, IL_Q2, IL_Q3, IL_Q4) - IL_LATAR">' +
      '<span class="hint">Fungsi: avg, sum, min, max, abs, sqrt, pow, round(x,d), atan, deg. Klik kode untuk menyisipkan:</span><div class="hstack" style="gap:4px">' + kodeLain.map(k => '<button type="button" class="chip" style="height:24px;font-family:var(--mono);font-size:11px" data-ins="' + k + '">' + k + '</button>').join('') + '</div></div>' +
      '<div class="field" id="w-opsi"><label for="e-opsi">Pilihan (pisahkan dengan |)</label><input class="input" id="e-opsi" value="' + esc(d.opsi) + '"></div>' +
      '<div class="field"><label for="e-tol">Tipe toleransi</label><select class="input" id="e-tol">' + Object.keys(VR_TIPE_TOL).map(k => '<option value="' + k + '"' + (k === d.tipe_toleransi ? ' selected' : '') + '>' + VR_TIPE_TOL[k] + '</option>').join('') + '</select></div>' +
      '<div class="field" id="w-min"><label for="e-min">Batas minimum</label><input class="input mono" id="e-min" value="' + esc(d.batas_min) + '" placeholder="angka atau kode"></div>' +
      '<div class="field" id="w-maks"><label for="e-maks">Batas maksimum</label><input class="input mono" id="e-maks" value="' + esc(d.batas_maks) + '" placeholder="angka atau kode"></div>' +
      '<div class="field" id="w-acuan"><label for="e-acuan">Acuan (dianggap lulus)</label><select class="input" id="e-acuan"></select></div>' +
      '<div class="field span-2"><label for="e-ket">Keterangan / sumber acuan</label><input class="input" id="e-ket" value="' + esc(d.keterangan) + '" placeholder="Tampil di form QC sebagai catatan"></div>' +
      '<div class="stack" style="gap:8px;justify-content:center"><label class="switch"><input type="checkbox" id="e-wajib"' + (vrBenar(d.wajib) ? ' checked' : '') + '><span class="trk"></span>Wajib diisi</label>' +
      '<label class="switch"><input type="checkbox" id="e-na"' + (vrBenar(d.boleh_na) ? ' checked' : '') + '><span class="trk"></span>Boleh N/A</label>' +
      '<label class="switch"><input type="checkbox" id="e-aktif"' + (vrBenar(d.aktif) ? ' checked' : '') + '><span class="trk"></span>Aktif</label></div>' +
      '</div><div class="banner banner-info small" style="margin-top:16px" id="e-prev"></div>',
    tombol: [{ label: 'Batal' }, { label: baru ? 'Tambahkan' : 'Terapkan', kelas: 'btn-primary', ikon: 'check', aksi: (bg) => {
      const n = baca(bg);
      if (!n.nama.trim()) { toast('Nama parameter wajib diisi.', 'warning'); return false; }
      if (kodeLain.indexOf(n.kode) > -1) { toast('Kode ' + n.kode + ' sudah dipakai.', 'warning'); return false; }
      const msg = validasiParamLokal(n, kodeLain.concat([n.kode]));
      if (msg) { toast(msg, 'warning'); return false; }
      if (baru || n.kategori !== p.kategori) n.urutan = String(1e6);   // taruh di akhir kategorinya; atur ulang dengan seret
      if (baru) TP.params.push(n); else Object.assign(p, n);
      nomoriUlang();
      selesai();
    } }]
  });
  function baca(bg) {
    return Object.assign({}, d, {
      kategori: $('#e-kat', bg).value, kelompok: $('#e-kel', bg).value.trim(), kode: $('#e-kode', bg).value.trim().toUpperCase(), nama: $('#e-nama', bg).value.trim(),
      satuan: $('#e-sat', bg).value.trim(), tipe_input: $('#e-tin', bg).value, desimal: $('#e-dec', bg).value || '2',
      formula: $('#e-rumus', bg).value.trim(), opsi: $('#e-opsi', bg).value.split('|').map(x => x.trim()).filter(Boolean).join('|'), tipe_toleransi: $('#e-tol', bg).value,
      batas_min: $('#e-min', bg).value.trim(), batas_maks: $('#e-maks', bg).value.trim(), acuan: $('#e-acuan', bg).value || '',
      keterangan: $('#e-ket', bg).value.trim(), wajib: $('#e-wajib', bg).checked ? 'TRUE' : 'FALSE', boleh_na: $('#e-na', bg).checked ? 'TRUE' : 'FALSE', aktif: $('#e-aktif', bg).checked ? 'TRUE' : 'FALSE'
    });
  }
  function sinkron() {
    const tin = $('#e-tin', m).value, tol = $('#e-tol', m).value;
    $('#w-rumus', m).classList.toggle('hidden', tin !== 'HITUNG');
    $('#w-opsi', m).classList.toggle('hidden', tin !== 'KUALITATIF');
    $('#w-acuan', m).classList.toggle('hidden', tol !== 'KUALITATIF');
    $('#w-min', m).classList.toggle('hidden', ['MIN', 'LEBIH', 'RENTANG'].indexOf(tol) === -1);
    $('#w-maks', m).classList.toggle('hidden', ['MAKS', 'KURANG', 'RENTANG', 'MUTLAK_PM'].indexOf(tol) === -1);
    const opsi = $('#e-opsi', m).value.split('|').map(x => x.trim()).filter(Boolean), acu = $('#e-acuan', m);
    const cur = acu.value || d.acuan;
    acu.innerHTML = opsi.map(o => '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
    const n = baca(m), msg = validasiParamLokal(n, kodeLain.concat([n.kode]));
    $('#e-prev', m).className = 'banner small ' + (msg ? 'banner-fail' : 'banner-info');
    $('#e-prev', m).innerHTML = msg ? ic('circle-alert') + '<div class="t">' + esc(msg) + '</div>' : ic('info') + '<div class="t">Kriteria di form & laporan: <b class="mono">' + esc(n.tipe_toleransi === 'TIDAK_ADA' ? 'data pendukung (tidak dinilai)' : vrTeksToleransi(n, null, null, sep())) + '</b></div>';
  }
  $$('input, select', m).forEach(x => x.addEventListener('input', sinkron));
  $$('[data-ins]', m).forEach(b => b.addEventListener('click', () => {
    const r = $('#e-rumus', m), pos = r.selectionStart || r.value.length;
    r.value = r.value.slice(0, pos) + b.dataset.ins + r.value.slice(pos); r.focus(); sinkron();
  }));
  sinkron();
}
