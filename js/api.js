/* =====================================================================
 *  KASKU - api.js
 *  Penghubung ke Google Apps Script (mode "sheet") atau data contoh
 *  di HP (mode "demo"). Juga mengelola antrean offline: transaksi baru
 *  yang gagal terkirim disimpan di HP dan dikirim ulang otomatis.
 * ===================================================================== */
(function () {
  'use strict';
  const KK = (globalThis.KK = globalThis.KK || {});
  const U = KK.u, S = KK.store;

  class ApiError extends Error {
    constructor(kode, pesan) { super(pesan); this.kode = kode; }
  }

  /* ---------- konfigurasi ---------- */
  function konfig() { return S.get('cfg', null); }
  function simpanKonfig(c) { S.set('cfg', c); }
  function hapusKonfig() { S.del('cfg'); }
  function modeDemo() { return S.get('demo', false) === true; }
  function setDemo(v) { if (v) S.set('demo', true); else S.del('demo'); }
  function terhubung() { return modeDemo() || !!(konfig() && konfig().url && konfig().key); }

  function urlValid(u) {
    return /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(String(u || '').trim());
  }

  /* ---------- koneksi ke Apps Script ---------- */
  async function kirim(badan, timeoutMs) {
    const c = konfig();
    if (!c) throw new ApiError('BELUM_SETUP', 'Aplikasi belum dihubungkan ke spreadsheet.');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs || 30000);
    let res;
    try {
      // "text/plain" menghindari preflight CORS yang tidak didukung Apps Script.
      res = await fetch(c.url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ key: c.key }, badan)),
        redirect: 'follow',
        credentials: 'omit',
        signal: ctl.signal
      });
    } catch (e) {
      throw new ApiError('JARINGAN', e && e.name === 'AbortError'
        ? 'Server terlalu lama menjawab. Coba lagi.'
        : 'Tidak bisa terhubung. Periksa koneksi internet.');
    } finally { clearTimeout(timer); }

    let data;
    try { data = await res.json(); }
    catch (e) {
      throw new ApiError('RESPON', 'Jawaban server tidak dikenali. Pastikan URL Web App benar dan akses deploy diatur ke "Siapa saja".');
    }
    if (!data || data.ok !== true) throw new ApiError((data && data.kode) || 'SERVER', (data && data.pesan) || 'Terjadi kesalahan di server.');
    return data;
  }

  /* ---------- mode demo (data contoh, hanya di HP ini) ---------- */
  const tunda = (ms) => new Promise((r) => setTimeout(r, ms));

  function seedDemo() {
    let s = 20261116;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const pilih = (a) => a[Math.floor(rnd() * a.length)];
    const bulat = (n, k) => Math.round(n / k) * k;
    const hariIni = U.todayStr();
    const awal = U.addMonths(U.startOfMonth(hariIni), -4);
    const out = [];
    const tambah = (jenis, tgl, kategori, jumlah, catatan) => {
      if (tgl > hariIni) return;
      out.push({ id: U.uid(), jenis, tanggal: tgl, kategori, jumlah, catatan: catatan || '' });
    };
    for (let m = awal; m <= hariIni; m = U.addMonths(m, 1)) {
      const p = U.parts(m), pm = (d) => p.y + '-' + U.pad(p.m) + '-' + U.pad(Math.min(d, U.daysInMonth(p.y, p.m)));
      tambah('masuk', pm(1), 'Gaji', 9500000, 'Gaji bulanan');
      if (rnd() < 0.7) tambah('masuk', pm(3 + Math.floor(rnd() * 11)), 'Usaha & Freelance', bulat(750000 + rnd() * 2500000, 50000), pilih(['Proyek desain', 'Konsultasi', 'Jasa edit']));
      if (p.m === 12 || p.m === 6) tambah('masuk', pm(20), 'Bonus', 4000000, 'Bonus kinerja');
      tambah('keluar', pm(1), 'Hunian', 1800000, 'Sewa unit');
      tambah('keluar', pm(5), 'Cicilan & Utang', 1250000, 'Cicilan motor');
      tambah('keluar', pm(7), 'Tagihan & Utilitas', bulat(250000 + rnd() * 120000, 1000), 'Listrik & air');
      tambah('keluar', pm(8), 'Tagihan & Utilitas', 385000, 'Internet rumah');
      tambah('keluar', pm(14), 'Asuransi', 300000, 'Premi asuransi');
      tambah('keluar', pm(26), 'Tabungan & Investasi', 1000000, 'Reksa dana');
      for (let d = 1; d <= U.daysInMonth(p.y, p.m); d++) {
        const tgl = pm(d);
        if (tgl > hariIni) break;
        tambah('keluar', tgl, 'Makan & Minum', bulat(22000 + rnd() * 48000, 1000), pilih(['Makan siang', 'Nasi padang', 'Kopi', 'Makan malam', 'Sarapan', 'Bakso']));
        if (rnd() < 0.45) tambah('keluar', tgl, 'Makan & Minum', bulat(15000 + rnd() * 40000, 1000), pilih(['Kopi sore', 'Jajan', 'Boba']));
        if (rnd() < 0.7) tambah('keluar', tgl, 'Transportasi', bulat(10000 + rnd() * 40000, 1000), pilih(['Ojek online', 'Bensin', 'Parkir', 'KRL']));
        if (rnd() < 0.2) tambah('keluar', tgl, 'Belanja', bulat(50000 + rnd() * 450000, 5000), pilih(['Belanja bulanan', 'Alat tulis', 'Kebutuhan rumah']));
        if (rnd() < 0.1) tambah('keluar', tgl, 'Gaya Hidup', bulat(80000 + rnd() * 600000, 5000), pilih(['Potong rambut', 'Pakaian', 'Sepatu']));
        if (rnd() < 0.08) tambah('keluar', tgl, 'Hiburan', bulat(50000 + rnd() * 200000, 5000), pilih(['Bioskop', 'Langganan streaming', 'Game']));
        if (rnd() < 0.05) tambah('keluar', tgl, 'Kesehatan', bulat(60000 + rnd() * 300000, 5000), pilih(['Obat', 'Cek dokter', 'Vitamin']));
      }
    }
    return out;
  }

  function demoItems() {
    let d = S.get('demo.items', null);
    if (!d) { d = seedDemo(); S.set('demo.items', d); }
    return d;
  }
  const demo = {
    async ping() { await tunda(250); return { ok: true, demo: true }; },
    async list() { await tunda(450); return { data: demoItems().map((x) => Object.assign({}, x)) }; },
    async add(it) {
      await tunda(350);
      const d = demoItems();
      if (!d.some((x) => x.id === it.id)) d.push(Object.assign({}, it));
      S.set('demo.items', d);
      return { item: it };
    },
    async update(it, jenisLama) {
      await tunda(350);
      const d = demoItems(), i = d.findIndex((x) => x.id === it.id && x.jenis === (jenisLama || it.jenis));
      if (i < 0) throw new ApiError('TIDAK_DITEMUKAN', 'Transaksi tidak ditemukan.');
      d[i] = Object.assign({}, it);
      S.set('demo.items', d);
      return { item: it };
    },
    async remove(it) {
      await tunda(300);
      S.set('demo.items', demoItems().filter((x) => !(x.id === it.id && x.jenis === it.jenis)));
      return {};
    }
  };

  /* ---------- antarmuka tunggal ---------- */
  const api = {
    ApiError, konfig, simpanKonfig, hapusKonfig, modeDemo, setDemo, terhubung, urlValid,

    async ping() { return modeDemo() ? demo.ping() : kirim({ aksi: 'ping' }, 20000); },
    async list() {
      if (modeDemo()) return demo.list();
      return kirim({ aksi: 'daftar' }, 45000);
    },
    async add(it) {
      if (modeDemo()) return demo.add(it);
      return kirim({ aksi: 'tambah', id: it.id, jenis: it.jenis, tanggal: it.tanggal, kategori: it.kategori, jumlah: it.jumlah, catatan: it.catatan });
    },
    async update(it, jenisLama) {
      if (modeDemo()) return demo.update(it, jenisLama);
      return kirim({ aksi: 'ubah', id: it.id, jenis: jenisLama || it.jenis, jenisBaru: it.jenis, tanggal: it.tanggal, kategori: it.kategori, jumlah: it.jumlah, catatan: it.catatan });
    },
    async remove(it) {
      if (modeDemo()) return demo.remove(it);
      return kirim({ aksi: 'hapus', id: it.id, jenis: it.jenis });
    },
    /** Uji koneksi dengan konfigurasi sementara (sebelum disimpan). */
    async coba(url, key) {
      const lama = konfig();
      simpanKonfig({ url: url.trim(), key: key.trim() });
      try { return await kirim({ aksi: 'ping' }, 25000); }
      finally { if (lama) simpanKonfig(lama); else hapusKonfig(); }
    },

    /* ---------- antrean offline ---------- */
    outbox: {
      semua() { return S.get('outbox', []); },
      tulis(a) { S.set('outbox', a); },
      tambah(it) {
        const a = this.semua().filter((x) => x.id !== it.id);
        a.push(it);
        this.tulis(a);
      },
      hapus(id) { this.tulis(this.semua().filter((x) => x.id !== id)); },
      ada(id) { return this.semua().some((x) => x.id === id); },
      jumlah() { return this.semua().length; }
    },

    /**
     * Kirim semua transaksi yang menunggu. Mengembalikan
     * { terkirim: [...], gagal: [{item, galat}], dibuang: [{item, galat}] }.
     * Hanya galat VALIDASI yang membuang transaksi; yang lain tetap antre.
     */
    async kirimAntrean() {
      const hasil = { terkirim: [], gagal: [], dibuang: [] };
      if (modeDemo()) return hasil;
      const daftar = this.outbox.semua();
      for (let i = 0; i < daftar.length; i++) {
        const it = daftar[i];
        try {
          await this.add(it);
          this.outbox.hapus(it.id);
          hasil.terkirim.push(it);
        } catch (e) {
          if (e.kode === 'VALIDASI') { this.outbox.hapus(it.id); hasil.dibuang.push({ item: it, galat: e }); }
          else { hasil.gagal.push({ item: it, galat: e }); if (e.kode === 'JARINGAN' || e.kode === 'AUTH' || e.kode === 'TERKUNCI') break; }
        }
      }
      return hasil;
    },

    /* ---------- cache data terakhir (agar cepat tampil & bisa dilihat offline) ---------- */
    cache: {
      baca() { return S.get(modeDemo() ? 'cache.demo' : 'cache.data', null); },
      tulis(items, waktu) { S.set(modeDemo() ? 'cache.demo' : 'cache.data', { items, waktu: waktu || Date.now() }); },
      hapus() { S.del('cache.data'); S.del('cache.demo'); }
    },

    resetDemo() { S.del('demo.items'); S.del('cache.demo'); }
  };

  KK.api = api;
})();
