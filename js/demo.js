/* =====================================================================
 * VeriRad — MODE DEMO
 * Backend tiruan di memori browser dengan data contoh FIKTIF. Meniru
 * aksi API server (memakai mesin penilaian yang sama dari bersama.js)
 * supaya aplikasi bisa dicoba sebelum Google Apps Script disambungkan.
 * Tidak ada yang dikirim ke server; data hilang saat halaman dimuat ulang.
 * ===================================================================== */
'use strict';

const Demo = (function () {
  let db = null, me = null;
  const jkt = () => new Date(Date.now() + 7 * 3600e3).toISOString();
  const sekarang = () => jkt().slice(0, 19);
  function acak(seed) { let t = 0; for (let i = 0; i < seed.length; i++) t = (t * 31 + seed.charCodeAt(i)) | 0; return function () { t |= 0; t = (t + 0x6D2B79F5) | 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  const id = p => p + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  const r1 = (x, d) => Number(x.toFixed(d === undefined ? 1 : d));

  function nilaiContoh(tplId, a, per, idx, rnd) {
    const v = {}, set = (k, x) => { v[k] = { nilai: typeof x === 'number' ? String(x).replace('.', ',') : String(x) }; }, na = (k, al) => { v[k] = { na: true, alasan: al }; };
    const ukurDos = idx % 3 === 0;
    const dos = (kv) => {
      if (ukurDos) { set('DOS_KV', r1(kv * rnd(), 2)); set('DOS_LIN', r1(0.02 + rnd() * 0.04, 3)); set('DOS_REP', r1(0.01 + rnd() * 0.02, 3)); set('DOS_HVL', r1(3.9 + rnd() * 0.7, 2)); }
      else ['DOS_KV', 'DOS_LIN', 'DOS_REP', 'DOS_HVL'].forEach(k => na(k, 'Alat ukur dosimetri sedang dikalibrasi'));
    };
    if (tplId === 'TPL-RU' || tplId === 'TPL-MOB') {
      set('LAMPU', 'Berfungsi'); set('SIGN', 'Baik'); set('FUNG_TABUNG', 'Berfungsi'); set('FUNG_KOLIMATOR', 'Berfungsi');
      let latar = r1(78 + rnd() * 16), sel = 250 + rnd() * 110;
      if (a.demo_tren) { sel = a.demo_tren[idx]; latar = 79.0; }
      const rata = latar + sel, off = [5.2, -3.6, 2.8, -4.4];
      if (a.demo_tren && idx === 5) { [162.4, 159.4, 166.0, 170.8].forEach((q, i) => set('IL_Q' + (i + 1), q)); }
      else if (a.demo_emas) { [401.4, 419.0, 453.4, 426.0].forEach((q, i) => set('IL_Q' + (i + 1), q)); latar = 92.6; }
      else off.forEach((o, i) => set('IL_Q' + (i + 1), r1(rata + o)));
      set('IL_LATAR', latar);
      if (a.demo_emas) { set('KOL_X1', 0.76); set('KOL_X2', 0.25); set('KOL_Y1', 0.08); set('KOL_Y2', 0.34); set('TEGAK_JARAK', 0.39); set('TEGAK_SUDUT', 1.11); }
      else { set('KOL_X1', r1(rnd() * 0.6, 2)); set('KOL_X2', r1(rnd() * 0.5, 2)); set('KOL_Y1', r1(rnd() * 0.4, 2)); set('KOL_Y2', r1(rnd() * 0.5, 2)); set('TEGAK_JARAK', r1(0.15 + rnd() * 0.3, 2)); set('TEGAK_SUDUT', r1(0.4 + rnd() * 0.8, 2)); }
      dos(8);
    } else if (tplId === 'TPL-CT') {
      set('LAMPU', 'Berfungsi'); set('SIGN', 'Baik'); set('AUDIO', 'Berfungsi'); set('TOMBOL', 'Berfungsi'); set('ARTEFAK', 'Tidak ada artefak');
      set('SLICE_MIN', 0.6); set('LASER_DEV', r1(0.1 + rnd() * 0.4, 2)); set('MEJA_SD', r1(0.2 + rnd() * 0.6, 2));
      set('CT_AIR', r1(-2 + rnd() * 4, 2));
      ['SD_C', 'SD_12', 'SD_3', 'SD_6', 'SD_9'].forEach(k => set(k, r1(6.2 + rnd() * 0.9, 2)));
      const mc = -1 + rnd() * 2; set('M_C', r1(mc, 2)); ['M_12', 'M_3', 'M_6', 'M_9'].forEach(k => set(k, r1(mc - 1.2 + rnd() * 2.2, 2)));
      [['AKRIL_B', 145], ['AKRIL_K', 144], ['LEKSAN', 116], ['NILON', 99], ['PE', -76], ['TEFLON', 1030], ['AIR', 0]].forEach(x => set('LIN_' + x[0], r1(x[1] - 6 + rnd() * 12)));
      set('GEO_UKUR', r1(49.6 + rnd() * 0.8, 2));
      dos(4);
    } else if (tplId === 'TPL-PAN') { set('PAN_PANJANG', r1(150 + rnd() * 5)); set('PAN_LEBAR', r1(7.4 + rnd() * 0.8)); }
    return v;
  }

  function seed() {
    const per = jkt().slice(0, 7), d = { rs: [], alat: [], templates: [], params: [], pengguna: [], sesi: [], hasil: [], lampiran: [], laporan: [], berkas: {}, periode: per };
    vrTemplateBawaan().forEach(t => {
      d.templates.push({ template_id: t.template_id, nama: t.nama, singkatan: t.singkatan, versi: t.versi, aktif: t.aktif, diubah: sekarang() });
      t.params.forEach(p => d.params.push(Object.assign({ param_id: t.template_id + '-' + p.kode, template_id: t.template_id }, p)));
    });
    const rs = [
      ['RS-DEMO1', 'RSHS', 'RS Harapan Sehat', 'Jl. Kesehatan No. 45, Kota Contoh', 'dr. Budi Santoso, Sp.Rad.', 'kains.demo@contoh.id'],
      ['RS-DEMO2', 'RSMM', 'RS Mitra Medika', 'Jl. Melati Raya No. 12, Kota Contoh', 'dr. Ratna Wulandari, Sp.Rad.', 'radiologi.demo@contoh.id'],
      ['RS-DEMO3', 'KUS', 'Klinik Utama Sentosa', 'Jl. Anggrek No. 8, Kabupaten Contoh', 'dr. Hendra Wijaya, Sp.Rad.', 'direktur.demo@contoh.id']];
    rs.forEach(r => d.rs.push({ rs_id: r[0], kode: r[1], nama: r[2], alamat: r[3], telepon: '(021) 555-0100', nama_penandatangan: r[4], jabatan_penandatangan: 'Kepala Instalasi Radiologi',
      nip_penandatangan: '', email_atasan: r[5], email_cc: '', logo_file_id: '', aktif: 'TRUE', dibuat: sekarang(), diubah: sekarang() }));
    const al = [
      ['RS-DEMO1', 'TPL-RU', 'RU-01', 'Siemens', 'Multix Top', 'SN-99420-X', 'Ruang Radiologi 1', { demo_emas: true }],
      ['RS-DEMO1', 'TPL-MOB', 'MX-02', 'GE', 'AMX 4 Plus', 'SN-MX-11029', 'Depo IGD', { demo_tren: [118.0, 112.3, 108.9, 104.2, 101.5, 85.65] }],
      ['RS-DEMO1', 'TPL-CT', 'CT-01', 'Siemens', 'Somatom go.Up', 'SN-CT-88124', 'Ruang CT'],
      ['RS-DEMO1', 'TPL-PAN', 'DP-01', 'Vatech', 'Pax-i', 'SN-DP-44390', 'Poli Gigi'],
      ['RS-DEMO1', 'TPL-RU', 'RU-02', 'Toshiba', 'Radrex', 'SN-TR-77211', 'Ruang Radiologi 2'],
      ['RS-DEMO2', 'TPL-RU', 'RU-01', 'Philips', 'DigitalDiagnost', 'SN-PH-5542', 'Ruang Radiologi 1'],
      ['RS-DEMO2', 'TPL-MOB', 'MX-01', 'Shimadzu', 'MobileDaRt', 'SN-SH-9481', 'Rawat Inap Lt. 2'],
      ['RS-DEMO2', 'TPL-CT', 'CT-01', 'GE', 'Revolution ACT', 'SN-GE-8812', 'Ruang CT'],
      ['RS-DEMO2', 'TPL-RU', 'RU-02', 'Fujifilm', 'FDR Smart', 'SN-FJ-3311', 'Ruang Radiologi 2'],
      ['RS-DEMO3', 'TPL-RU', 'RU-01', 'Shimadzu', 'RADspeed', 'SN-SD-2210', 'Ruang Rontgen'],
      ['RS-DEMO3', 'TPL-PAN', 'DP-01', 'Planmeca', 'ProMax 2D', 'SN-PM-1092', 'Poli Gigi'],
      ['RS-DEMO3', 'TPL-MOB', 'MX-01', 'Carestream', 'DRX-Revolution', 'SN-CS-7731', 'IGD']];
    al.forEach((x, i) => d.alat.push(Object.assign({ alat_id: 'AL-DEMO' + (i + 1), rs_id: x[0], template_id: x[1], kode: x[2], merek: x[3], tipe: x[4], no_seri_tabung: x[5], ruangan: x[6], foto_id: '', aktif: 'TRUE', catatan: '', dibuat: sekarang(), diubah: sekarang() }, x[7] || {})));
    d.pengguna.push({ email: 'fismed.demo@contoh.id', nama: 'Andi Pratama, S.Si., M.Si.', peran: 'FISMED', rs_ids: '', jabatan: 'Fisikawan Medis', aktif: 'TRUE', dibuat: sekarang() });
    d.pengguna.push({ email: 'kains.demo@contoh.id', nama: 'dr. Budi Santoso, Sp.Rad.', peran: 'ATASAN', rs_ids: 'RS-DEMO1', jabatan: 'Kepala Instalasi Radiologi', aktif: 'TRUE', dibuat: sekarang() });
    d.pengaturan = { nama_fismed: 'Andi Pratama, S.Si., M.Si.', no_izin: 'SIP-FM 000/DEMO/2026', kota: 'Kota Contoh', pemisah_desimal: ',', toleransi_disetujui: sekarang() + ' (demo)', ttd_file_id: '' };
    const fis = d.pengguna[0];
    const rencana = { 'AL-DEMO1': 'FINAL', 'AL-DEMO2': 'FINAL', 'AL-DEMO3': 'FINAL', 'AL-DEMO4': 'DRAF', 'AL-DEMO6': 'FINAL', 'AL-DEMO7': 'FINAL' };
    d.alat.forEach(a => {
      for (let i = 0; i < 6; i++) {
        const p = vrGeserPeriode(per, i - 5);
        if (i === 5 && !rencana[a.alat_id]) continue;
        const rnd = acak(a.alat_id + p);
        let input = nilaiContoh(a.template_id, a, p, i, rnd);
        if (i === 5 && rencana[a.alat_id] === 'DRAF') input = { PAN_PANJANG: { nilai: '151,5' } };
        const tgl = p + '-' + String(8 + Math.floor(rnd() * 14)).padStart(2, '0');
        const tpl = d.templates.find(t => t.template_id === a.template_id);
        const b = vrBangunHasil({ sesi_id: 'S-' + a.alat_id + '-' + p, alat: a, template: tpl, params: d.params.filter(x => x.template_id === a.template_id), input,
          catatan: a.demo_tren && i === 5 ? 'Lampu kolimator redup. Disarankan penggantian bohlam dan pembersihan cermin kolimator, lalu uji ulang iluminasi.' : '',
          periode: p, tanggal: tgl, status_sesi: i === 5 ? rencana[a.alat_id] : 'FINAL', penguji_email: fis.email, penguji_nama: fis.nama, sekarang: tgl + 'T10:' + String(10 + i).padStart(2, '0') + ':00' });
        d.sesi.push(b.sesi); d.hasil = d.hasil.concat(b.hasil);
      }
    });
    const lalu = vrGeserPeriode(per, -1);
    d.laporan.push({ laporan_id: 'LAP-D1', rs_id: 'RS-DEMO1', periode: lalu, pdf_file_id: '', nama_file: 'Laporan_QC_RSHS_' + lalu + '.pdf', dikirim_ke: 'kains.demo@contoh.id', cc: '', waktu: lalu + '-28T14:22:00', status_kirim: 'TERKIRIM', pesan_error: '', dibuat_oleh: fis.email });
    d.laporan.push({ laporan_id: 'LAP-D2', rs_id: 'RS-DEMO2', periode: lalu, pdf_file_id: '', nama_file: 'Laporan_QC_RSMM_' + lalu + '.pdf', dikirim_ke: 'radiologi.demo@contoh.id', cc: '', waktu: lalu + '-27T09:15:00', status_kirim: 'TERKIRIM', pesan_error: '', dibuat_oleh: fis.email });
    return d;
  }

  const ok = (data, message) => ({ success: true, data: data === undefined ? null : data, message: message || '' });
  const fail = (message, data) => ({ success: false, message, data });
  const boleh = rsId => me.peran === 'FISMED' || String(me.rs_ids).split(',').indexOf(rsId) > -1;
  function boot() {
    const rs = db.rs.filter(r => boleh(r.rs_id)), ids = rs.map(r => r.rs_id);
    return {
      me: { email: me.email, nama: me.nama, peran: me.peran, jabatan: me.jabatan, rs_ids: me.peran === 'FISMED' ? null : String(me.rs_ids).split(',') },
      versi: VR_VERSI, periode: db.periode, hariIni: jkt().slice(0, 10), pengaturan: me.peran === 'FISMED' ? db.pengaturan : { nama_fismed: db.pengaturan.nama_fismed, pemisah_desimal: db.pengaturan.pemisah_desimal },
      rs, alat: db.alat.filter(a => ids.indexOf(a.rs_id) > -1), templates: db.templates, params: db.params, pengguna: me.peran === 'FISMED' ? db.pengguna : [],
      sesi: db.sesi.filter(s => ids.indexOf(s.rs_id) > -1), sesiDari: '2000-01', laporan: db.laporan.filter(l => ids.indexOf(l.rs_id) > -1)
    };
  }
  function wajibFismed() { if (me.peran !== 'FISMED') throw new Error('Aksi ini hanya untuk fisikawan medis.'); }

  function handle(action, d) {
    if (!db) init('FISMED');
    const tulis = /\.(simpan|hapus|unggah|buat|kirimUlang)$/.test(action);
    if (tulis) wajibFismed();
    switch (action) {
      case 'auth.config': return ok({ googleClientId: '', siap: true });
      case 'auth.login': return ok({ token: 'demo', boot: boot() });
      case 'boot': return ok(boot());
      case 'sesi.list': return ok(db.sesi.filter(s => boleh(s.rs_id)));
      case 'hasil.list': {
        const ids = d.sesi_ids || db.sesi.filter(s => s.alat_id === d.alat_id).map(s => s.sesi_id);
        const okId = db.sesi.filter(s => boleh(s.rs_id) && ids.indexOf(s.sesi_id) > -1).map(s => s.sesi_id);
        return ok({ hasil: db.hasil.filter(h => okId.indexOf(h.sesi_id) > -1), lampiran: db.lampiran.filter(l => okId.indexOf(l.sesi_id) > -1) });
      }
      case 'sesi.simpan': {
        const a = db.alat.find(x => x.alat_id === d.alat_id); if (!a) return fail('Alat tidak ditemukan.');
        const lama = db.sesi.find(s => s.alat_id === a.alat_id && s.periode === d.periode);
        const tpl = db.templates.find(t => t.template_id === a.template_id);
        const params = lama && lama.status_sesi === 'FINAL' ? vrParamDariHasil(db.hasil.filter(h => h.sesi_id === lama.sesi_id)) : db.params.filter(p => p.template_id === tpl.template_id && vrBenar(p.aktif));
        const sid = lama ? lama.sesi_id : id('S');
        let b;
        try { b = vrBangunHasil({ sesi_id: sid, alat: a, template: tpl, params, input: d.input, catatan: d.catatan, periode: d.periode, tanggal: d.tanggal || jkt().slice(0, 10), status_sesi: d.final ? 'FINAL' : 'DRAF', penguji_email: me.email, penguji_nama: me.nama, sekarang: sekarang(), dibuat: lama ? lama.dibuat : '' }); }
        catch (e) { return fail(e.message); }
        db.sesi = db.sesi.filter(s => s.sesi_id !== sid).concat([b.sesi]);
        db.hasil = db.hasil.filter(h => h.sesi_id !== sid).concat(b.hasil);
        return ok(b, d.final ? 'Hasil QC disimpan final.' : 'Draf tersimpan.');
      }
      case 'sesi.hapus': {
        const s = db.sesi.find(x => x.sesi_id === d.sesi_id); if (!s) return fail('Sesi tidak ditemukan.');
        if (s.status_sesi === 'FINAL') return fail('Sesi final tidak bisa dihapus.');
        db.sesi = db.sesi.filter(x => x.sesi_id !== s.sesi_id); db.hasil = db.hasil.filter(h => h.sesi_id !== s.sesi_id);
        return ok({ sesi_id: s.sesi_id }, 'Draf dihapus.');
      }
      case 'rs.simpan': {
        if (!String(d.nama || '').trim()) return fail('Nama rumah sakit wajib diisi.');
        const lama = db.rs.find(r => r.rs_id === d.rs_id);
        const o = Object.assign({}, lama || { rs_id: id('RS'), logo_file_id: '', dibuat: sekarang() }, d, { kode: String(d.kode || '').toUpperCase(), aktif: d.aktif === false ? 'FALSE' : 'TRUE',
          email_atasan: vrDaftarEmail(d.email_atasan).join(', '), email_cc: vrDaftarEmail(d.email_cc).join(', '), diubah: sekarang() });
        if (!o.rs_id) o.rs_id = id('RS');
        db.rs = db.rs.filter(r => r.rs_id !== o.rs_id).concat([o]);
        return ok(o, 'Rumah sakit tersimpan.');
      }
      case 'alat.simpan': {
        const kode = String(d.kode || '').toUpperCase();
        if (db.alat.some(a => a.rs_id === d.rs_id && a.kode === kode && a.alat_id !== d.alat_id)) return fail('Kode ' + kode + ' sudah dipakai di RS ini.');
        const lama = db.alat.find(a => a.alat_id === d.alat_id);
        const o = Object.assign({}, lama || { alat_id: id('AL'), foto_id: '', dibuat: sekarang() }, d, { kode, aktif: d.aktif === false ? 'FALSE' : 'TRUE', diubah: sekarang() });
        if (!o.alat_id) o.alat_id = id('AL');
        db.alat = db.alat.filter(a => a.alat_id !== o.alat_id).concat([o]);
        return ok(o, 'Alat tersimpan.');
      }
      case 'template.simpan': {
        const lama = db.templates.find(t => t.template_id === d.template.template_id);
        const tid = lama ? lama.template_id : id('TPL');
        const versi = lama ? String(Number(lama.versi) + 1) : '1';
        const ps = d.params.map(p => Object.assign({}, p, { template_id: tid, param_id: tid + '-' + p.kode }));
        const ev = vrEvaluasi(ps, {}, '.'), err = Object.keys(ev).filter(k => ev[k].status === 'ERROR' && ev[k].pesan);
        if (err.length) return fail('Template belum valid: ' + err.map(k => k + ' — ' + ev[k].pesan).join('; '));
        db.templates = db.templates.filter(t => t.template_id !== tid).concat([{ template_id: tid, nama: d.template.nama, singkatan: d.template.singkatan, versi, aktif: d.template.aktif, diubah: sekarang() }]);
        db.params = db.params.filter(p => p.template_id !== tid).concat(ps);
        return ok({ template_id: tid, versi }, 'Template tersimpan (versi ' + versi + '). Sesi final lama tetap memakai toleransi lamanya.');
      }
      case 'pengguna.simpan': {
        if (d.email === me.email) return fail('Anda tidak bisa mengubah peran akun Anda sendiri.');
        const o = { email: d.email, nama: d.nama, jabatan: d.jabatan, peran: d.peran, rs_ids: d.peran === 'ATASAN' ? (d.rs_ids || []).join(',') : '', aktif: d.aktif === false ? 'FALSE' : 'TRUE', dibuat: sekarang() };
        db.pengguna = db.pengguna.filter(u => u.email !== d.email).concat([o]);
        return ok(o, 'Pengguna tersimpan.');
      }
      case 'pengguna.hapus': db.pengguna = db.pengguna.filter(u => u.email !== d.email); return ok({ email: d.email }, 'Pengguna dihapus.');
      case 'pengaturan.simpan':
        ['nama_fismed', 'no_izin', 'kota', 'pemisah_desimal'].forEach(k => { if (d[k] !== undefined) db.pengaturan[k] = String(d[k]); });
        if (d.toleransi_disetujui) db.pengaturan.toleransi_disetujui = sekarang();
        return ok(db.pengaturan, 'Pengaturan tersimpan.');
      case 'file.unggah': {
        const fid = id('FILE');
        db.berkas[fid] = { mime: d.mime, base64: d.base64, nama: d.nama };
        const out = { file_id: fid };
        if (d.jenis === 'logo') db.rs.find(r => r.rs_id === d.rs_id).logo_file_id = fid;
        if (d.jenis === 'ttd') db.pengaturan.ttd_file_id = fid;
        if (d.jenis === 'lampiran') {
          const s = db.sesi.find(x => x.sesi_id === d.sesi_id);
          if (!s) return fail('Simpan draf QC dulu.');
          out.lampiran = { lampiran_id: id('LP'), sesi_id: s.sesi_id, alat_id: s.alat_id, rs_id: s.rs_id, nama: d.nama, mime: d.mime, drive_file_id: fid, ukuran: String(d.base64.length * 0.75 | 0), dibuat: sekarang() };
          db.lampiran.push(out.lampiran);
        }
        return ok(out, 'Berkas terunggah.');
      }
      case 'file.ambil': { const f = db.berkas[d.file_id]; return f ? ok({ file_id: d.file_id, nama: f.nama, mime: f.mime, base64: f.base64 }) : fail('Berkas tidak ditemukan.'); }
      case 'lampiran.hapus': db.lampiran = db.lampiran.filter(l => l.lampiran_id !== d.lampiran_id); return ok({ lampiran_id: d.lampiran_id }, 'Lampiran dihapus.');
      case 'laporan.list': return ok(db.laporan.filter(l => boleh(l.rs_id)));
      case 'laporan.buat': {
        const rs = db.rs.find(r => r.rs_id === d.rs_id);
        const row = { laporan_id: id('LAP'), rs_id: rs.rs_id, periode: d.periode, pdf_file_id: '', nama_file: 'Laporan_QC_' + (rs.kode || 'RS') + '_' + d.periode + '.pdf',
          dikirim_ke: d.kirim ? (d.penerima || []).join(', ') : '', cc: d.kirim ? (d.cc || []).join(', ') : '', waktu: sekarang(), status_kirim: d.kirim ? 'TERKIRIM' : 'DIBUAT', pesan_error: '', dibuat_oleh: me.email };
        db.laporan.push(row);
        return ok({ laporan: row, pdf: '', nama_file: row.nama_file }, d.kirim ? 'Mode demo: email tidak benar-benar dikirim, tetapi tercatat di riwayat.' : 'Laporan tercatat (mode demo).');
      }
      case 'laporan.unduh': return ok({ nama_file: 'demo.pdf', base64: '' });
      case 'laporan.kirimUlang': { const l = db.laporan.find(x => x.laporan_id === d.laporan_id); l.status_kirim = 'TERKIRIM'; l.dikirim_ke = (d.penerima || []).join(', ') || l.dikirim_ke; l.waktu = sekarang(); return ok({ laporan_id: l.laporan_id, status_kirim: 'TERKIRIM', dikirim_ke: l.dikirim_ke }, 'Mode demo: tercatat sebagai terkirim ulang.'); }
      case 'auth.keluarSemua': return ok(null, 'OK');
    }
    return fail('Aksi tidak dikenal di mode demo: ' + action);
  }
  function init(peran) { db = seed(); me = peran === 'ATASAN' ? db.pengguna[1] : db.pengguna[0]; }
  return { init, handle };
})();
