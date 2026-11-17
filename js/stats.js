/* =====================================================================
 *  KASKU - stats.js
 *  Semua perhitungan dashboard: periode, ringkasan, per kategori, tren,
 *  perbandingan periode sebelumnya, dan insight. Murni fungsi (tanpa DOM)
 *  sehingga bisa diuji otomatis.
 * ===================================================================== */
(function () {
  'use strict';
  const KK = (globalThis.KK = globalThis.KK || {});
  const U = () => KK.u;

  const min = (a, b) => (a < b ? a : b);
  const max = (a, b) => (a > b ? a : b);

  /**
   * periode: { tipe: 'hari'|'minggu'|'bulan'|'kustom', offset: 0 (0 = sekarang, -1 = sebelumnya), dari, sampai }
   * Mengembalikan rentang penuh, rentang yang sudah berjalan (untuk rata-rata
   * yang adil), dan rentang pembanding dengan panjang yang sama.
   */
  function rentang(p, hariIni) {
    const u = U();
    let mulai, akhir, prev, label;
    const off = Math.min(0, p.offset || 0);

    if (p.tipe === 'hari') {
      mulai = akhir = u.addDays(hariIni, off);
      prev = { mulai: u.addDays(mulai, -1), akhir: u.addDays(mulai, -1) };
      label = off === 0 ? 'Hari ini' : off === -1 ? 'Kemarin' : u.fmtTgl(mulai);
    } else if (p.tipe === 'minggu') {
      mulai = u.addDays(u.startOfWeek(hariIni), off * 7);
      akhir = u.addDays(mulai, 6);
      label = off === 0 ? 'Minggu ini' : off === -1 ? 'Minggu lalu' : u.fmtRentang(mulai, akhir);
    } else if (p.tipe === 'bulan') {
      mulai = u.addMonths(u.startOfMonth(hariIni), off);
      akhir = u.endOfMonth(mulai);
      label = u.fmtBulan(mulai);
    } else {
      mulai = u.validDate(p.dari) ? p.dari : u.startOfMonth(hariIni);
      akhir = u.validDate(p.sampai) ? p.sampai : hariIni;
      if (akhir < mulai) { const t = mulai; mulai = akhir; akhir = t; }
      label = u.fmtRentang(mulai, akhir);
    }

    const akhirEf = min(akhir, hariIni);                      // hari terakhir yang sudah terjadi
    const hari = max(1, u.diffDays(mulai, akhirEf) + 1);      // jumlah hari berjalan

    if (p.tipe === 'minggu') {
      const ps = u.addDays(mulai, -7);
      prev = { mulai: ps, akhir: u.addDays(ps, hari - 1) };
    } else if (p.tipe === 'bulan') {
      const ps = u.addMonths(mulai, -1);
      prev = { mulai: ps, akhir: min(u.addDays(ps, hari - 1), u.endOfMonth(ps)) };
    } else if (p.tipe === 'kustom') {
      const pe = u.addDays(mulai, -1);
      prev = { mulai: u.addDays(pe, -(hari - 1)), akhir: pe };
    }
    return { mulai, akhir, akhirEf, hari, prev, label, tipe: p.tipe };
  }

  function dalam(items, mulai, akhir) {
    return items.filter((it) => it.tanggal >= mulai && it.tanggal <= akhir);
  }

  function ringkas(items) {
    let masuk = 0, keluar = 0, nMasuk = 0, nKeluar = 0;
    items.forEach((it) => {
      if (it.jenis === 'masuk') { masuk += it.jumlah; nMasuk++; } else { keluar += it.jumlah; nKeluar++; }
    });
    return { masuk: r2(masuk), keluar: r2(keluar), bersih: r2(masuk - keluar), nMasuk, nKeluar, n: nMasuk + nKeluar };
  }
  function r2(n) { return Math.round(n * 100) / 100; }

  /** Total per kategori (nama digabung tanpa membedakan huruf besar/kecil). */
  function perKategori(items, jenis) {
    const peta = {};
    let total = 0;
    items.forEach((it) => {
      if (it.jenis !== jenis) return;
      const k = U().kunciKat(it.kategori);
      const e = peta[k] || (peta[k] = { kategori: it.kategori, total: 0, n: 0 });
      e.total += it.jumlah; e.n++; total += it.jumlah;
    });
    return Object.keys(peta).map((k) => {
      const e = peta[k];
      return { kategori: e.kategori, total: r2(e.total), n: e.n, persen: total ? (e.total / total) * 100 : 0 };
    }).sort((a, b) => b.total - a.total);
  }

  /** Bagi daftar kategori jadi N teratas + "Lainnya". */
  function topN(daftar, n) {
    if (daftar.length <= n + 1) return daftar.slice();
    const atas = daftar.slice(0, n);
    const sisa = daftar.slice(n);
    const total = sisa.reduce((a, e) => a + e.total, 0);
    const persen = sisa.reduce((a, e) => a + e.persen, 0);
    atas.push({ kategori: 'Kategori lainnya', total: r2(total), n: sisa.reduce((a, e) => a + e.n, 0), persen, gabungan: sisa.length });
    return atas;
  }

  /** Deret harian (hari tanpa transaksi = 0). */
  function harian(items, mulai, akhir) {
    const u = U();
    const idx = {}, out = [];
    for (let d = mulai; d <= akhir; d = u.addDays(d, 1)) { const b = { tgl: d, masuk: 0, keluar: 0 }; idx[d] = b; out.push(b); }
    items.forEach((it) => {
      const b = idx[it.tanggal];
      if (b) b[it.jenis] += it.jumlah;
    });
    return out;
  }

  /** Deret bulanan; mulai/akhir berupa tanggal, dibulatkan ke awal bulan. */
  function bulanan(items, mulai, akhir) {
    const u = U();
    const idx = {}, out = [];
    const akhirB = u.startOfMonth(akhir);
    for (let m = u.startOfMonth(mulai); m <= akhirB; m = u.addMonths(m, 1)) {
      const b = { tgl: m, bulan: m.slice(0, 7), masuk: 0, keluar: 0 };
      idx[b.bulan] = b; out.push(b);
    }
    items.forEach((it) => {
      const b = idx[it.tanggal.slice(0, 7)];
      if (b) b[it.jenis] += it.jumlah;
    });
    return out;
  }

  /** Jendela waktu tren: harian = minimal 7 hari; bulanan = 6 sampai 12 bulan. */
  function jendelaTren(r, mode) {
    const u = U();
    if (mode === 'bulanan') {
      const akhirB = u.startOfMonth(r.akhirEf);
      let mulaiB = min(u.startOfMonth(r.mulai), u.addMonths(akhirB, -5));
      mulaiB = max(mulaiB, u.addMonths(akhirB, -11));
      return { mulai: mulaiB, akhir: r.akhirEf };
    }
    let mulai = min(r.mulai, u.addDays(r.akhirEf, -6));
    mulai = max(mulai, u.addDays(r.akhirEf, -91));
    return { mulai, akhir: r.akhirEf };
  }

  function selisihPersen(sekarang, sebelum) {
    if (!sebelum) return sekarang ? null : 0;       // tidak ada pembanding yang berarti
    return ((sekarang - sebelum) / sebelum) * 100;
  }

  function insight(items, r) {
    const ini = dalam(items, r.mulai, r.akhir);
    const lalu = dalam(items, r.prev.mulai, r.prev.akhir);
    const a = ringkas(ini), b = ringkas(lalu);
    const kat = perKategori(ini, 'keluar');
    let terbesar = null;
    ini.forEach((it) => { if (it.jenis === 'keluar' && (!terbesar || it.jumlah > terbesar.jumlah)) terbesar = it; });
    return {
      sekarang: a,
      sebelum: b,
      kategoriTerbesar: kat[0] || null,
      rataHarian: a.keluar / r.hari,
      rataHarianSebelum: b.keluar / r.hari,
      transaksiTerbesar: terbesar,
      deltaKeluar: selisihPersen(a.keluar, b.keluar),
      deltaMasuk: selisihPersen(a.masuk, b.masuk),
      rasioTabung: a.masuk > 0 ? (a.bersih / a.masuk) * 100 : null,
      adaPembanding: b.n > 0,
      hari: r.hari
    };
  }

  /** Cari transaksi: teks bebas pada kategori & catatan, plus nominal. */
  function cocokTeks(it, q) {
    if (!q) return true;
    const h = (it.kategori + ' ' + it.catatan + ' ' + it.jumlah + ' ' + (it.jenis === 'masuk' ? 'pemasukan' : 'pengeluaran')).toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => h.indexOf(t) >= 0 || h.replace(/[.,]/g, '').indexOf(t.replace(/[.,]/g, '')) >= 0);
  }

  function urutTerbaru(a, b) {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
    return (b.baris || 0) - (a.baris || 0);
  }

  KK.stats = { rentang, dalam, ringkas, perKategori, topN, harian, bulanan, jendelaTren, insight, selisihPersen, cocokTeks, urutTerbaru };
})();
