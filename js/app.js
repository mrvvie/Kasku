/* =====================================================================
 *  KASKU - app.js
 *  Layar, form transaksi, sinkronisasi, dan antrean offline.
 * ===================================================================== */
(function () {
  'use strict';
  const KK = globalThis.KK, U = KK.u, S = KK.store, A = KK.api, ST = KK.stats, CH = KK.charts, IC = KK.ic, esc = U.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const VERSI = '1.0.0';
  const NBSP = ' ';

  const state = {
    tab: S.get('tab', 'beranda'),
    items: [],
    periode: Object.assign({ tipe: 'bulan', offset: 0 }, S.get('periode', {}), { offset: 0 }),
    muat: 'idle', galat: null, waktu: null, sedangMuat: false, ver: 0,
    filter: { q: '', jenis: 'semua', kategori: '', dari: '', sampai: '' },
    limit: 40, trenMode: 'harian', katJenis: 'keluar',
    online: navigator.onLine !== false,
    dilewati: null, installEvt: null, scroll: {}, heroTerakhir: null
  };
  if (['beranda', 'riwayat', 'grafik', 'setelan'].indexOf(state.tab) < 0) state.tab = 'beranda';
  if (['hari', 'minggu', 'bulan', 'kustom'].indexOf(state.periode.tipe) < 0) state.periode.tipe = 'bulan';

  const hariIni = () => U.todayStr();
  const rp = (n, t) => U.rp(n, t);

  /* ===================================================================
   *  Toast
   * =================================================================== */
  const TOAST_IKON = { ok: 'check', err: 'alert', info: 'info', warn: 'alert', load: 'refresh' };
  function toast(tipe, teks, sub, durasi) {
    const wrap = $('#toasts');
    while (wrap.children.length >= 3) wrap.firstChild.remove();
    const el = document.createElement('div');
    let timer;
    const api = {
      tutup() { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 200); },
      ubah(t2, teks2, sub2, dur2) {
        el.className = 'toast ' + t2;
        el.setAttribute('role', t2 === 'err' ? 'alert' : 'status');
        el.innerHTML = '<span class="ti">' + IC(TOAST_IKON[t2], 17) + '</span><span class="t">' + esc(teks2) + (sub2 ? '<small>' + esc(sub2) + '</small>' : '') + '</span>';
        clearTimeout(timer);
        const d = dur2 || { ok: 2800, err: 6000, info: 3500, warn: 6000 }[t2];
        if (d) timer = setTimeout(api.tutup, d);
      }
    };
    wrap.appendChild(el);
    api.ubah(tipe, teks, sub, durasi);
    return api;
  }

  /* ===================================================================
   *  Sheet & dialog (tombol Kembali di HP menutupnya dulu)
   * =================================================================== */
  const stack = [];
  function bukaSheet(html, opsi) {
    opsi = opsi || {};
    const ovl = document.createElement('div');
    ovl.className = 'ovl';
    ovl.innerHTML = opsi.dialog
      ? '<div class="dlg" role="alertdialog" aria-modal="true">' + html + '</div>'
      : '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    ovl.addEventListener('pointerdown', (e) => { if (e.target === ovl) tutupSheet(); });
    $('#layer').appendChild(ovl);
    stack.push({ el: ovl, onClose: opsi.onClose });
    history.pushState({ kasku: stack.length }, '');
    return ovl;
  }
  function tutupSheet(semua) {
    if (!stack.length) return;
    history.go(semua ? -stack.length : -1);
  }
  function animasiTutup(s) {
    s.el.classList.add('out');
    setTimeout(() => s.el.remove(), 210);
    if (s.onClose) s.onClose();
  }
  window.addEventListener('popstate', (e) => {
    const n = (e.state && e.state.kasku) || 0;
    while (stack.length > n) animasiTutup(stack.pop());
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) tutupSheet(); });

  /* ===================================================================
   *  Data & sinkronisasi
   * =================================================================== */
  function norm(x) {
    return { id: String(x.id), jenis: x.jenis === 'masuk' ? 'masuk' : 'keluar', tanggal: x.tanggal, kategori: x.kategori || 'Tanpa Kategori', jumlah: Number(x.jumlah) || 0, catatan: x.catatan || '', baris: x.baris || 0 };
  }
  const tandaiPending = (it) => Object.assign({}, norm(it), { pending: true, baris: 1e9 });
  function gantiItems(fn) { state.ver++; state.items = fn(state.items); }
  function simpanCache() { A.cache.tulis(state.items.filter((i) => !i.pending).map(({ pending, ...r }) => r)); }
  const jumlahPending = () => state.items.filter((i) => i.pending).length;

  function terapkanDariServer(r) {
    const server = r.data.map(norm);
    const adaDiServer = {};
    server.forEach((s) => { adaDiServer[s.id] = true; });
    A.outbox.semua().forEach((o) => { if (adaDiServer[o.id]) A.outbox.hapus(o.id); });   // sudah sampai, hanya jawabannya yang hilang
    const sisa = A.outbox.semua().filter((o) => !adaDiServer[o.id]).map(tandaiPending);
    state.items = server.concat(sisa);
    state.dilewati = r.dilewati && r.dilewati.jumlah ? r.dilewati : null;
    A.cache.tulis(server);
  }

  async function sinkronAntrean(senyap) {
    if (!A.outbox.jumlah()) return;
    const h = await A.kirimAntrean();
    if (h.terkirim.length) {
      const ids = {};
      h.terkirim.forEach((i) => { ids[i.id] = true; });
      gantiItems((a) => a.map((i) => (ids[i.id] ? Object.assign({}, i, { pending: false }) : i)));
      if (!senyap) toast('ok', h.terkirim.length + ' transaksi tertunda sudah terkirim', 'Tersimpan di spreadsheet.');
    }
    h.dibuang.forEach((d) => {
      gantiItems((a) => a.filter((i) => i.id !== d.item.id));
      toast('err', 'Transaksi ditolak: ' + d.galat.message, U.fmtTgl(d.item.tanggal) + ', ' + d.item.kategori + ', ' + rp(d.item.jumlah));
    });
  }

  async function muatData(opsi) {
    opsi = opsi || {};
    if (!A.terhubung()) return;
    if (state.sedangMuat) return;
    state.sedangMuat = true; state.muat = 'loading';
    renderStatus();
    try {
      await sinkronAntrean(opsi.senyap);
      let r;
      for (let k = 0; k < 3; k++) {
        const v = state.ver;
        r = await A.list();
        if (v === state.ver || k === 2) break;      // ada perubahan lokal saat memuat: ambil lagi
      }
      terapkanDariServer(r);
      state.muat = 'ok'; state.galat = null; state.waktu = Date.now();
    } catch (e) {
      state.muat = 'error'; state.galat = e;
      if (e.kode === 'AUTH' || e.kode === 'TERKUNCI') toast('err', e.message, 'Periksa kunci akses di Setelan.');
      else if (!opsi.senyap) toast('err', 'Gagal memuat data', e.message);
    } finally { state.sedangMuat = false; }
    render();
  }

  /* ===================================================================
   *  Potongan tampilan bersama
   * =================================================================== */
  const LOGO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14"/><path d="M8 12.5L16 5"/><path d="M11.4 10.4L16.5 19"/></svg>';

  function statusInfo() {
    const p = jumlahPending();
    if (A.modeDemo()) return { kelas: '', teks: 'Mode demo', busy: false };
    if (state.muat === 'loading') return { kelas: 'busy', teks: 'Menyinkronkan', busy: true };
    if (!state.online) return { kelas: 'off', teks: p ? 'Offline, ' + p + ' menunggu' : 'Offline', busy: false };
    if (p) return { kelas: 'warn', teks: p + ' menunggu dikirim', busy: false };
    if (state.muat === 'error') return { kelas: 'warn', teks: 'Gagal memuat', busy: false };
    return { kelas: '', teks: 'Tersinkron', busy: false };
  }
  function htmlStatus() {
    const s = statusInfo();
    return '<button id="status" class="pill ' + s.kelas + '" data-aksi="sinkron" aria-label="Sinkronkan sekarang. Status: ' + esc(s.teks) + '"><span class="dot"></span>' + esc(s.teks) + '</button>';
  }
  function renderStatus() {
    const el = $('#status');
    if (el) el.outerHTML = htmlStatus();
  }
  function kepala(judul) {
    return '<header class="top">' + (judul
      ? '<h1 class="page-title">' + esc(judul) + '</h1>'
      : '<div class="brand"><span class="brand-mark">' + LOGO + '</span>Kasku</div>') + htmlStatus() + '</header>';
  }

  function pemilihPeriode(r) {
    const hari = hariIni();
    const tipe = state.periode.tipe;
    const chip = (t, nama) => '<button class="chip" data-aksi="periode" data-tipe="' + t + '" aria-pressed="' + (tipe === t) + '">' + nama + '</button>';
    const kecil = r.mulai === r.akhir ? '' : U.fmtRentang(r.mulai, r.akhir);
    const lalu = tipe === 'kustom' ? r.akhir >= hari : (state.periode.offset || 0) >= 0;
    return '<div class="chips" role="group" aria-label="Pilih periode">' + chip('hari', 'Hari ini') + chip('minggu', 'Minggu ini') + chip('bulan', 'Bulan ini') + chip('kustom', 'Kustom') + '</div>' +
      '<div class="stepper"><button class="step-btn" data-aksi="geser" data-n="-1" aria-label="Periode sebelumnya">' + IC('left', 20) + '</button>' +
      '<div class="st-lbl">' + esc(r.label) + (kecil && kecil !== r.label ? '<small>' + esc(kecil) + '</small>' : '') + '</div>' +
      '<button class="step-btn" data-aksi="geser" data-n="1" aria-label="Periode berikutnya"' + (lalu ? ' disabled' : '') + '>' + IC('right', 20) + '</button></div>';
  }

  function baris(it, opsi) {
    opsi = opsi || {};
    const masuk = it.jenis === 'masuk';
    const sub = it.catatan || (masuk ? 'Pemasukan' : 'Pengeluaran');
    const kecil = (it.pending ? IC('cloud', 12) + 'Menunggu' : '') + (opsi.tgl && !it.pending ? esc(U.fmtTglP(it.tanggal)) : '');
    return '<li><button class="tx" data-aksi="ubah" data-id="' + esc(it.id) + '" data-jenis="' + it.jenis + '">' +
      '<span class="tile ' + (masuk ? 'in' : 'out') + '">' + IC(KK.kat.ikon(it.kategori), 21) + '</span>' +
      '<span class="tx-main"><b>' + esc(it.kategori) + '</b><small>' + esc(sub) + '</small></span>' +
      '<span class="tx-amt ' + (masuk ? 'in' : 'out') + '">' + (masuk ? '+' : '−') + esc(rp(it.jumlah)) + (kecil ? '<small>' + kecil + '</small>' : '') + '</span></button></li>';
  }

  const SENI = '<svg class="art" viewBox="0 0 160 120" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f6bf0"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>' +
    '<rect x="20" y="28" width="120" height="78" rx="20" fill="#eef0ff"/><rect x="32" y="40" width="96" height="54" rx="14" fill="#fff" stroke="#d6daec"/>' +
    '<rect x="44" y="68" width="11" height="16" rx="3.5" fill="url(#eg)" opacity=".45"/><rect x="61" y="58" width="11" height="26" rx="3.5" fill="url(#eg)" opacity=".7"/><rect x="78" y="62" width="11" height="22" rx="3.5" fill="url(#eg)" opacity=".55"/><rect x="95" y="50" width="11" height="34" rx="3.5" fill="url(#eg)"/>' +
    '<circle cx="128" cy="32" r="17" fill="url(#eg)"/><path d="M128 24.5v15M120.5 32h15" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>';

  function kosongSemua() {
    return '<div class="empty">' + SENI + '<h3>Belum ada transaksi</h3><p>Catat pengeluaran atau pemasukan pertamamu. Cukup beberapa ketukan.</p>' +
      '<button class="btn pri" data-aksi="tambah">' + IC('plus', 20) + 'Tambah transaksi</button></div>';
  }
  function skeletonBeranda() {
    return '<div class="sk" style="height:178px;border-radius:28px"></div><div class="sk" style="height:84px;margin-top:22px"></div><div class="sk" style="height:84px;margin-top:10px"></div><div class="sk" style="height:200px;margin-top:22px"></div>';
  }

  /* ===================================================================
   *  Beranda
   * =================================================================== */
  function badge(delta, naikBaik) {
    if (delta === null) return '<span class="badge flat">Tanpa pembanding</span>';
    if (Math.abs(delta) < 0.5) return '<span class="badge flat">Sama</span>';
    const naik = delta > 0;
    const baik = naikBaik ? naik : !naik;
    return '<span class="badge ' + (baik ? 'good' : 'bad') + '">' + IC(naik ? 'up' : 'down', 13) + (naik ? 'Naik ' : 'Turun ') + esc(U.persen(Math.abs(delta))) + '</span>';
  }
  const NAMA_LALU = { hari: 'kemarin', minggu: 'minggu lalu', bulan: 'bulan lalu', kustom: 'periode sebelumnya' };

  function htmlInsight(r) {
    const i = ST.insight(state.items, r);
    if (!i.sekarang.n) return '<div class="empty small"><p class="muted" style="margin:0">Belum ada transaksi pada periode ini.</p></div>';
    let h = '';
    const row = (ikon, t, v, s) => '<div class="ins-row"><span class="ins-ic">' + IC(ikon, 19) + '</span><div><div class="ins-t">' + t + '</div><div class="ins-v">' + v + '</div>' + (s ? '<div class="ins-s">' + s + '</div>' : '') + '</div></div>';
    if (i.kategoriTerbesar) {
      const k = i.kategoriTerbesar;
      h += row(KK.kat.ikon(k.kategori), 'Kategori pengeluaran terbesar', esc(k.kategori), esc(rp(k.total)) + ', ' + esc(U.persen(k.persen)) + ' dari total pengeluaran');
    }
    if (i.sekarang.keluar > 0) {
      h += row('calendar', 'Rata-rata pengeluaran harian', esc(rp(Math.round(i.rataHarian))) + ' per hari', r.hari === 1 ? 'Dihitung untuk hari ini' : 'Dihitung dari ' + r.hari + ' hari berjalan');
    }
    h += '<div class="ins-row"><span class="ins-ic">' + IC('trend', 19) + '</span><div style="flex:1;min-width:0"><div class="ins-t">Dibanding ' + NAMA_LALU[r.tipe] + '</div>' +
      '<div class="cmp"><div class="cmp-r"><span>Pengeluaran</span>' + badge(i.deltaKeluar, false) + '</div><div class="ins-s" style="margin-top:-4px">' + esc(rp(i.sekarang.keluar)) + ' dari ' + esc(rp(i.sebelum.keluar)) + '</div>' +
      '<div class="cmp-r"><span>Pemasukan</span>' + badge(i.deltaMasuk, true) + '</div><div class="ins-s" style="margin-top:-4px">' + esc(rp(i.sekarang.masuk)) + ' dari ' + esc(rp(i.sebelum.masuk)) + '</div></div>' +
      '<div class="ins-s" style="margin-top:8px">Pembanding: ' + esc(U.fmtRentang(r.prev.mulai, r.prev.akhir)) + '</div></div></div>';
    if (i.rasioTabung !== null) {
      h += row('percent', 'Rasio tabungan', esc(U.persen(i.rasioTabung)) + ' dari pemasukan', i.sekarang.bersih >= 0 ? esc(rp(i.sekarang.bersih)) + ' tersisa pada periode ini' : 'Pengeluaran melebihi pemasukan sebesar ' + esc(rp(-i.sekarang.bersih)));
    }
    if (i.transaksiTerbesar) {
      const t = i.transaksiTerbesar;
      h += row('flame', 'Pengeluaran tunggal terbesar', esc(rp(t.jumlah)), esc(t.kategori) + (t.catatan ? ', ' + esc(t.catatan) : '') + ', ' + esc(U.fmtTglP(t.tanggal)));
    }
    return '<div class="ins">' + h + '</div>';
  }

  function renderBeranda() {
    const ukuran = (txt) => (txt.length > 15 ? ' s' : '');
    const adaData = state.items.length > 0;
    let isi = kepala();
    if (!adaData && (state.muat === 'loading' || state.muat === 'idle')) return isi + skeletonBeranda();
    if (!adaData) return isi + kosongSemua();

    const r = ST.rentang(state.periode, hariIni());
    const rg = ST.ringkas(ST.dalam(state.items, r.mulai, r.akhir));
    const semua = ST.ringkas(state.items);
    const teksBersih = rp(rg.bersih);
    const kecil = (n) => (n >= 1e9 ? U.rpRingkas(n) : rp(n));

    isi += pemilihPeriode(r);
    isi += '<section class="hero" aria-label="Ringkasan periode"><div class="hero-lbl">Saldo bersih, ' + esc(r.label) + '</div>' +
      '<div class="hero-val' + ukuran(teksBersih) + '" id="heroVal" data-nilai="' + rg.bersih + '">' + esc(teksBersih) + '</div>' +
      '<div class="hero-sub">Saldo keseluruhan ' + esc(rp(semua.bersih)) + '</div>' +
      '<div class="hero-row"><div class="gmini"><span class="mi in">' + IC('down', 17) + '</span><div><small>Pemasukan</small><b>' + esc(kecil(rg.masuk)) + '</b></div></div>' +
      '<div class="gmini"><span class="mi out">' + IC('up', 17) + '</span><div><small>Pengeluaran</small><b>' + esc(kecil(rg.keluar)) + '</b></div></div></div></section>';

    isi += '<section class="sec"><div class="sec-h"><h2>Sekilas periode ini</h2></div>' + htmlInsight(r) + '</section>';

    const terbaru = state.items.slice().sort(ST.urutTerbaru).slice(0, 5);
    isi += '<section class="sec"><div class="sec-h"><h2>Transaksi terbaru</h2><button class="link" data-aksi="tab" data-tab="riwayat">Lihat semua</button></div>' +
      '<div class="card" style="padding:4px 12px"><ul class="divided">' + terbaru.map((t) => baris(t, { tgl: true })).join('') + '</ul></div></section>';
    return isi;
  }

  /* ===================================================================
   *  Grafik
   * =================================================================== */
  function renderGrafik() {
    let isi = kepala('Grafik');
    if (!state.items.length) return isi + (state.muat === 'loading' ? skeletonBeranda() : kosongSemua());
    const r = ST.rentang(state.periode, hariIni());
    const dalamP = ST.dalam(state.items, r.mulai, r.akhir);
    const rg = ST.ringkas(dalamP);
    isi += pemilihPeriode(r);

    const kJenis = state.katJenis;
    const kat = ST.topN(ST.perKategori(dalamP, kJenis), 6);
    isi += '<div class="card"><div class="card-h"><h3>' + (kJenis === 'keluar' ? 'Pengeluaran' : 'Pemasukan') + ' per kategori</h3>' +
      '<div class="seg" role="group" aria-label="Jenis"><button data-aksi="segkat" data-v="keluar" aria-pressed="' + (kJenis === 'keluar') + '">Keluar</button><button data-aksi="segkat" data-v="masuk" aria-pressed="' + (kJenis === 'masuk') + '">Masuk</button></div></div>' +
      (kat.length ? CH.batangKategori(kat, kJenis) + '<p class="note">Ketuk kategori untuk melihat transaksinya.</p>' : '<div class="empty small"><p class="muted" style="margin:0">Belum ada ' + (kJenis === 'keluar' ? 'pengeluaran' : 'pemasukan') + ' pada periode ini.</p></div>') + '</div>';

    const mode = state.trenMode;
    const j = ST.jendelaTren(r, mode);
    const deret = mode === 'harian' ? ST.harian(state.items, j.mulai, j.akhir) : ST.bulanan(state.items, j.mulai, j.akhir);
    const rentangTeks = mode === 'harian' ? U.fmtRentang(j.mulai, j.akhir) : U.fmtBulan(deret[0].tgl) + ' sampai ' + U.fmtBulan(deret[deret.length - 1].tgl);
    isi += '<div class="card"><div class="card-h"><h3>Tren ' + mode + '</h3><div class="seg" role="group" aria-label="Rentang tren"><button data-aksi="segtren" data-v="harian" aria-pressed="' + (mode === 'harian') + '">Harian</button><button data-aksi="segtren" data-v="bulanan" aria-pressed="' + (mode === 'bulanan') + '">Bulanan</button></div></div>' +
      '<p class="note" style="margin:-4px 0 8px">' + esc(rentangTeks) + '</p>' + CH.tren(deret, mode) + '</div>';

    isi += '<div class="card"><div class="card-h"><h3>Pemasukan vs pengeluaran</h3></div>' + CH.banding(rg) + '</div>';
    return isi;
  }

  /* ===================================================================
   *  Riwayat
   * =================================================================== */
  function filterAktif() {
    const f = state.filter;
    return (f.kategori ? 1 : 0) + (f.dari || f.sampai ? 1 : 0);
  }
  function terfilter() {
    const f = state.filter, kk = U.kunciKat(f.kategori);
    return state.items.filter((it) =>
      (f.jenis === 'semua' || it.jenis === f.jenis) &&
      (!kk || U.kunciKat(it.kategori) === kk) &&
      (!f.dari || it.tanggal >= f.dari) && (!f.sampai || it.tanggal <= f.sampai) &&
      ST.cocokTeks(it, f.q)).sort(ST.urutTerbaru);
  }
  function htmlRiwayatList() {
    if (!state.items.length) return state.muat === 'loading' ? skeletonBeranda() : kosongSemua();
    const l = terfilter();
    if (!l.length) {
      return '<div class="empty small">' + SENI + '<h3>Tidak ada yang cocok</h3><p>Coba kata kunci lain atau longgarkan filter.</p><button class="btn sec2 sm" data-aksi="filter-reset">Atur ulang filter</button></div>';
    }
    const tampil = l.slice(0, state.limit);
    const hari = hariIni();
    const grup = [];
    tampil.forEach((it) => {
      let g = grup[grup.length - 1];
      if (!g || g.tgl !== it.tanggal) { g = { tgl: it.tanggal, items: [] }; grup.push(g); }
      g.items.push(it);
    });
    const ket = state.items.length === l.length ? l.length + ' transaksi' : l.length + ' dari ' + state.items.length + ' transaksi';
    let h = '<p class="note" style="margin:0 4px">' + ket + '</p>';
    grup.forEach((g) => {
      const net = ST.ringkas(g.items).bersih;
      h += '<section class="grp"><div class="grp-h"><span>' + esc(U.labelHari(g.tgl, hari)) + '</span><small>' + (g.items.length === (l.filter((x) => x.tanggal === g.tgl).length) ? esc(rp(net, true)) : '') + '</small></div><div class="card"><ul class="divided">' + g.items.map((t) => baris(t)).join('') + '</ul></div></section>';
    });
    if (l.length > tampil.length) h += '<button class="more" data-aksi="lagi">Muat lebih banyak (' + (l.length - tampil.length) + ' lagi)</button>';
    return h;
  }
  function renderRiwayat() {
    const f = state.filter;
    const n = filterAktif();
    let isi = kepala('Riwayat');
    isi += '<div class="bar"><label class="search">' + IC('search', 19) + '<input id="q" type="search" placeholder="Cari kategori, catatan, nominal" value="' + esc(f.q) + '" autocomplete="off" enterkeyhint="search"><span class="sr">Cari transaksi</span></label>' +
      '<button class="fbtn" data-aksi="filter-buka" aria-label="Filter">' + IC('sliders', 20) + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button></div>';
    isi += '<div class="chips" role="group" aria-label="Jenis transaksi" style="margin-bottom:4px">' +
      [['semua', 'Semua'], ['masuk', 'Pemasukan'], ['keluar', 'Pengeluaran']].map((x) => '<button class="chip" data-aksi="rjenis" data-v="' + x[0] + '" aria-pressed="' + (f.jenis === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
    let tags = '';
    if (f.kategori) tags += '<span class="tag">' + esc(f.kategori) + '<button data-aksi="hapus-tag" data-f="kategori" aria-label="Hapus filter kategori">' + IC('x', 16) + '</button></span>';
    if (f.dari || f.sampai) tags += '<span class="tag">' + esc(f.dari && f.sampai ? U.fmtRentang(f.dari, f.sampai) : f.dari ? 'Sejak ' + U.fmtTgl(f.dari) : 'Sampai ' + U.fmtTgl(f.sampai)) + '<button data-aksi="hapus-tag" data-f="tanggal" aria-label="Hapus filter tanggal">' + IC('x', 16) + '</button></span>';
    isi += '<div class="tags" id="tags" style="margin-top:8px">' + tags + '</div><div id="rlist">' + htmlRiwayatList() + '</div>';
    return isi;
  }
  function segarkanDaftar() {
    const el = $('#rlist');
    if (el) el.innerHTML = htmlRiwayatList();
  }

  /* ===================================================================
   *  Setelan
   * =================================================================== */
  function infoPasang() {
    const mandiri = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (mandiri) return '<div class="help">Kasku sudah terpasang di layar utama.</div>';
    if (state.installEvt) return '<button class="btn pri block" style="margin-top:12px" data-aksi="pasang">' + IC('phone', 20) + 'Pasang di layar utama</button>';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return ios
      ? '<ol class="steps"><li>Buka halaman ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li><li>Pilih <b>Tambahkan ke Layar Utama</b>, lalu ketuk <b>Tambah</b>.</li></ol>'
      : '<ol class="steps"><li>Buka halaman ini di <b>Chrome</b>.</li><li>Ketuk menu <b>titik tiga</b> di kanan atas.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li></ol>';
  }
  function renderSetelan() {
    const demo = A.modeDemo();
    const c = A.konfig();
    const s = ST.ringkas(state.items);
    let isi = kepala('Setelan');
    isi += '<div class="card"><div class="card-h"><h3>Koneksi</h3></div><div class="kv">' +
      '<div><span>Sumber data</span><span>' + (demo ? 'Data contoh (mode demo)' : 'Google Sheets') + '</span></div>' +
      (demo ? '' : '<div><span>Alamat API</span><span>' + esc(c && c.url ? '...' + c.url.slice(-22) : '-') + '</span></div><div><span>Kunci akses</span><span>' + (c && c.key ? 'Tersimpan di HP ini' : 'Belum diisi') + '</span></div>') +
      '<div><span>Transaksi terbaca</span><span>' + s.n + ' (' + s.nMasuk + ' masuk, ' + s.nKeluar + ' keluar)</span></div>' +
      '<div><span>Terakhir disinkron</span><span>' + (state.waktu ? esc(new Date(state.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })) : '-') + '</span></div></div>' +
      (state.dilewati ? '<div class="help"><b>' + state.dilewati.jumlah + ' baris dilewati</b> karena tanggal atau jumlahnya tidak terbaca. Contoh: ' + state.dilewati.contoh.map((x) => esc(x.sheet) + ' baris ' + x.baris).join(', ') + '.</div>' : '') +
      '<div class="grid2" style="margin-top:14px"><button class="btn sec2 sm" data-aksi="sinkron">' + IC('refresh', 18) + 'Sinkronkan</button>' +
      (demo ? '<button class="btn sec2 sm" data-aksi="demo-reset">Reset contoh</button>' : '<button class="btn sec2 sm" data-aksi="ubah-koneksi">' + IC('key', 18) + 'Ubah koneksi</button>') + '</div></div>';

    isi += '<div class="card"><div class="card-h"><h3>Pasang di layar utama</h3></div><p class="muted">Buka Kasku seperti aplikasi biasa, layar penuh, tanpa bilah alamat.</p>' + infoPasang() + '</div>';

    isi += '<div class="card"><div class="card-h"><h3>' + (demo ? 'Mode demo' : 'Lainnya') + '</h3></div><div class="set">' +
      (demo
        ? '<button class="set-r" data-aksi="demo-keluar"><span class="tile">' + IC('link', 19) + '</span><span class="tx-main"><b>Hubungkan ke spreadsheet</b><small>Keluar dari mode demo dan pakai data aslimu.</small></span></button>'
        : '<button class="set-r" data-aksi="demo-mulai"><span class="tile">' + IC('sparkle', 19) + '</span><span class="tx-main"><b>Coba mode demo</b><small>Lihat tampilan dengan data contoh. Sheet-mu tidak disentuh.</small></span></button>' +
          '<button class="set-r" data-aksi="putus"><span class="tile" style="background:var(--bad-soft);color:var(--bad)">' + IC('trash', 19) + '</span><span class="tx-main"><b>Hapus data aplikasi di HP ini</b><small>Menghapus kunci akses dan cache. Isi spreadsheet tidak berubah.</small></span></button>') +
      '</div></div><p class="note" style="text-align:center;margin:18px 0 6px">Kasku versi ' + VERSI + '</p>';
    return isi;
  }

  /* ===================================================================
   *  Layar sambutan / hubungkan
   * =================================================================== */
  function renderSetup(pra) {
    pra = pra || {};
    return '<div class="welcome page"><div class="logo">' + LOGO.replace('width="18" height="18"', 'width="32" height="32"') + '</div>' +
      '<h1>Catat keuangan dari HP, langsung ke spreadsheet-mu.</h1>' +
      '<p class="lead">Hubungkan Kasku ke Google Sheets milikmu. Data tetap di spreadsheet, hanya kamu yang punya kunci aksesnya.</p>' +
      '<form id="fsetup" novalidate><div><label for="s-url">Alamat Web App (URL)</label><input id="s-url" class="field" type="url" inputmode="url" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(pra.url || '') + '"></div>' +
      '<div><label for="s-key">Kunci akses</label><input id="s-key" class="field" type="text" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(pra.key || '') + '"></div>' +
      '<div id="s-err"></div><button class="btn pri block" id="s-btn" type="submit">' + IC('link', 20) + 'Hubungkan</button></form>' +
      '<p class="or">Belum punya? Ikuti panduan setup, atau</p>' +
      '<button class="btn sec2 block" data-aksi="demo-mulai">' + IC('sparkle', 20) + 'Coba dulu dengan data contoh</button></div>';
  }
  function pesanGalat(e) {
    if (e.kode === 'AUTH') return 'Kunci akses salah. Salin ulang dari menu Kasku di spreadsheet (Kasku > Tampilkan kunci akses).';
    return e.message || 'Gagal terhubung.';
  }
  async function hubungkan(ev) {
    ev.preventDefault();
    const url = $('#s-url').value.trim(), key = $('#s-key').value.trim();
    const err = $('#s-err'), btn = $('#s-btn');
    const tampilErr = (t) => { err.innerHTML = '<div class="errbox">' + IC('alert', 19) + '<span>' + esc(t) + '</span></div>'; };
    err.innerHTML = '';
    if (!A.urlValid(url)) return tampilErr('Alamat harus diawali https://script.google.com/ dan diakhiri /exec. Salin utuh dari hasil deploy Apps Script.');
    if (!key) return tampilErr('Kunci akses wajib diisi.');
    btn.disabled = true; btn.innerHTML = IC('refresh', 20, 'spin-i') + 'Menghubungkan';
    try {
      const r = await A.coba(url, key);
      A.simpanKonfig({ url, key }); A.setDemo(false);
      A.cache.hapus(); state.items = []; state.muat = 'idle';
      const m = r.sheet && r.sheet.masuk, k = r.sheet && r.sheet.keluar;
      toast('ok', 'Terhubung ke spreadsheet', m && k ? 'Pemasukan: ' + m.baris + ' baris, Pengeluaran: ' + k.baris + ' baris.' : '');
      state.tab = 'beranda'; render(); muatData({ senyap: true });
    } catch (e) {
      tampilErr(pesanGalat(e));
      btn.disabled = false; btn.innerHTML = IC('link', 20) + 'Hubungkan';
    }
  }
  function bukaUbahKoneksi() {
    const c = A.konfig() || {};
    const o = bukaSheet('<div class="sheet-h"><h2>Ubah koneksi</h2><button class="icon-btn" data-aksi="tutup" aria-label="Tutup">' + IC('x', 20) + '</button></div>' +
      '<div class="sheet-b"><div class="welcome" style="min-height:0;padding:0"><form id="fsetup" novalidate style="margin-top:6px"><div><label for="s-url">Alamat Web App (URL)</label><input id="s-url" class="field" type="url" value="' + esc(c.url || '') + '" autocomplete="off" autocapitalize="off" spellcheck="false"></div>' +
      '<div><label for="s-key">Kunci akses</label><input id="s-key" class="field" type="text" value="' + esc(c.key || '') + '" autocomplete="off" autocapitalize="characters" spellcheck="false"></div><div id="s-err"></div>' +
      '<button class="btn pri block" id="s-btn" type="submit" style="margin-bottom:14px">Simpan dan uji koneksi</button></form></div></div>');
    o.querySelector('#fsetup').addEventListener('submit', async (ev) => { await hubungkan(ev); if (A.terhubung() && !$('#s-err')) tutupSheet(); });
  }

  /* ===================================================================
   *  Render utama
   * =================================================================== */
  const NAV = [['beranda', 'Beranda', 'navHome'], ['riwayat', 'Riwayat', 'navList'], ['grafik', 'Grafik', 'navChart'], ['setelan', 'Setelan', 'navGear']];
  function renderNav() {
    const nav = $('#nav');
    if (!A.terhubung()) { nav.hidden = true; return; }
    nav.hidden = false;
    const b = (t) => '<button class="nav-b" data-aksi="tab" data-tab="' + t[0] + '"' + (state.tab === t[0] ? ' aria-current="page"' : '') + '>' + IC(t[2], 23) + t[1] + '</button>';
    nav.innerHTML = b(NAV[0]) + b(NAV[1]) +
      '<button class="nav-add" data-aksi="tambah" aria-label="Tambah Transaksi"><span class="fab">' + IC('plus', 30) + '</span><span>Tambah</span></button>' +
      b(NAV[2]) + b(NAV[3]);
  }

  let tabTerakhir = null;
  function render() {
    const view = $('#view');
    if (!A.terhubung()) {
      view.innerHTML = renderSetup(state.pra);
      renderNav();
      $('#fsetup').addEventListener('submit', hubungkan);
      return;
    }
    const aktif = document.activeElement;
    const adaFokusCari = aktif && aktif.id === 'q';
    CH.bersihkan();
    const fn = { beranda: renderBeranda, riwayat: renderRiwayat, grafik: renderGrafik, setelan: renderSetelan }[state.tab];
    const ganti = tabTerakhir !== state.tab;
    view.innerHTML = '<div class="' + (ganti ? 'page' : '') + '">' + fn() + '</div>';
    renderNav();
    CH.aktifkan(view);
    if (adaFokusCari && $('#q')) { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    if (state.tab === 'beranda') animasiHero();
    if (ganti) { window.scrollTo(0, state.scroll[state.tab] || 0); tabTerakhir = state.tab; }
  }

  function animasiHero() {
    const el = $('#heroVal');
    if (!el) return;
    const ke = Number(el.getAttribute('data-nilai'));
    const dari = state.heroTerakhir;
    state.heroTerakhir = ke;
    if (dari === null || dari === ke || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const t0 = performance.now();
    (function f(t) {
      const p = Math.min(1, (t - t0) / 520), e = 1 - Math.pow(1 - p, 3);
      el.textContent = rp(Math.round(dari + (ke - dari) * e));
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }

  function pindahTab(t) {
    state.scroll[state.tab] = window.scrollY;
    state.tab = t; S.set('tab', t);
    render();
  }

  /* ===================================================================
   *  Form transaksi
   * =================================================================== */
  let form = null;
  const MAKS = 999999999999;

  function kategoriUntuk(jenis) {
    return KK.kat.daftar(jenis, state.items, S.get('kat.' + jenis, []));
  }
  const BATAS_KAT = 8;
  function htmlKategori() {
    const l = kategoriUntuk(form.jenis);
    const terpilih = U.kunciKat(form.kategori);
    if (form.kategori && !l.some((k) => U.kunciKat(k) === terpilih)) l.unshift(form.kategori);
    let tampil = l;
    if (!form.semuaKat && l.length > BATAS_KAT + 1) {
      tampil = l.slice(0, BATAS_KAT);
      const pilih = l.find((k) => U.kunciKat(k) === terpilih);
      if (pilih && tampil.indexOf(pilih) < 0) tampil[BATAS_KAT - 1] = pilih;   // yang dipilih selalu kelihatan
    }
    const lebih = l.length > BATAS_KAT + 1
      ? '<button type="button" class="cat new" data-aksi="fkat-semua">' + (form.semuaKat ? 'Lebih sedikit' : 'Lihat semua (' + (l.length - tampil.length) + ' lagi)') + '</button>' : '';
    return tampil.map((k) => '<button type="button" class="cat ' + form.jenis + '" data-aksi="fkat" data-kat="' + esc(k) + '" aria-pressed="' + (U.kunciKat(k) === terpilih) + '">' + IC(KK.kat.ikon(k), 18) + esc(k) + '</button>').join('') + lebih +
      '<button type="button" class="cat new" data-aksi="fkat-baru">' + IC('plus', 18) + 'Kategori baru</button>';
  }
  function htmlTanggalBtns() {
    const hari = hariIni(), kemarin = U.addDays(hari, -1), t = form.tanggal;
    const lain = t !== hari && t !== kemarin;
    return '<button type="button" class="dbtn" data-aksi="ftgl" data-v="' + hari + '" aria-pressed="' + (t === hari) + '">Hari ini</button>' +
      '<button type="button" class="dbtn" data-aksi="ftgl" data-v="' + kemarin + '" aria-pressed="' + (t === kemarin) + '">Kemarin</button>' +
      '<label class="dbtn" aria-pressed="' + lain + '">' + IC('calendar', 17) + (lain ? esc(U.fmtTgl(t)) : 'Tanggal lain') + '<input id="f-tgl" type="date" value="' + esc(t) + '" aria-label="Pilih tanggal"></label>';
  }
  function labelSimpan() {
    if (form.mode === 'ubah') return 'Simpan perubahan';
    return form.jenis === 'masuk' ? 'Simpan pemasukan' : 'Simpan pengeluaran';
  }

  function bukaForm(awal) {
    form = Object.assign({ mode: 'baru', jenis: 'keluar', jumlah: 0, kategori: '', tanggal: hariIni(), catatan: '', id: null, jenisLama: null, menyimpan: false }, awal || {});
    const ubah = form.mode === 'ubah';
    const o = bukaSheet(
      '<div class="sheet-h"><h2>' + (ubah ? 'Ubah transaksi' : 'Transaksi baru') + '</h2><button class="icon-btn" data-aksi="tutup" aria-label="Tutup">' + IC('x', 20) + '</button></div>' +
      '<div class="sheet-b"><div class="seg big" id="f-seg" role="group" aria-label="Jenis transaksi"></div>' +
      '<div class="amount-w" id="f-aw"><span class="rp">Rp</span><input id="f-jumlah" class="amount" type="text" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="Nominal" value="' + esc(U.ribuan(form.jumlah)) + '"></div>' +
      '<div class="err-t" id="f-err-j" role="alert"></div>' +
      '<div class="quick" aria-label="Tambah cepat">' + [10000, 50000, 100000, 500000].map((n) => '<button type="button" data-aksi="fquick" data-n="' + n + '">+' + esc(U.ringkas(n)) + '</button>').join('') + '<button type="button" data-aksi="fquick" data-n="0">Kosongkan</button></div>' +
      '<div class="lbl">Kategori</div><div class="cats" id="f-cats"></div><div id="f-katbaru" hidden style="margin-top:10px"><input id="f-katnama" class="field" maxlength="60" placeholder="Nama kategori, lalu tekan Enter" autocomplete="off"></div><div class="err-t" id="f-err-k" role="alert"></div>' +
      '<div class="lbl">Tanggal</div><div class="dates" id="f-tgls"></div>' +
      '<div class="lbl">Catatan <span class="muted" style="font-weight:500">opsional</span></div><input id="f-cat" class="field" maxlength="300" placeholder="Misalnya: makan siang bareng tim" autocomplete="off" enterkeyhint="done" value="' + esc(form.catatan) + '"><div style="height:8px"></div></div>' +
      '<div class="sheet-f">' + (ubah ? '<button class="btn ghost-danger" data-aksi="fhapus" aria-label="Hapus transaksi">' + IC('trash', 22) + '</button>' : '') + '<button class="btn pri" id="f-simpan" data-aksi="fsimpan"></button></div>',
      { onClose: () => { form = null; } });
    lukisJenis(); lukisKategori(); lukisTanggal(); lukisTombol();
    // Fokus langsung (masih di dalam ketukan pengguna) supaya keyboard angka terbuka di iPhone & Android.
    if (!ubah) { const j = $('#f-jumlah', o); if (j) j.focus({ preventScroll: true }); }
  }
  function lukisJenis() {
    $('#f-seg').innerHTML = '<button type="button" data-aksi="fjenis" data-v="keluar" aria-pressed="' + (form.jenis === 'keluar') + '">Pengeluaran</button><button type="button" data-aksi="fjenis" data-v="masuk" aria-pressed="' + (form.jenis === 'masuk') + '">Pemasukan</button>';
  }
  function lukisKategori() { $('#f-cats').innerHTML = htmlKategori(); }
  function lukisTanggal() { $('#f-tgls').innerHTML = htmlTanggalBtns(); }
  function lukisTombol() {
    const b = $('#f-simpan');
    if (!b) return;
    b.className = 'btn pri' + (form.jenis === 'masuk' ? ' in' : '');
    b.disabled = form.menyimpan;
    b.innerHTML = form.menyimpan ? IC('refresh', 20, 'spin-i') + 'Menyimpan' : IC('check', 20) + labelSimpan();
  }
  function galatJumlah(teks) {
    const e = $('#f-err-j'), w = $('#f-aw');
    if (!e) return;
    e.innerHTML = teks ? IC('alert', 15) + esc(teks) : '';
    w.classList.toggle('err', !!teks);
  }
  function galatKategori(teks) { const e = $('#f-err-k'); if (e) e.innerHTML = teks ? IC('alert', 15) + esc(teks) : ''; }

  function setJumlah(n) {
    form.jumlah = Math.min(MAKS, Math.max(0, n));
    const el = $('#f-jumlah');
    if (el) el.value = U.ribuan(form.jumlah);
  }
  function validasiForm() {
    let pesan = null;
    if (!form.jumlah) { galatJumlah('Nominal wajib diisi.'); pesan = 1; }
    else if (form.jumlah < 0) { galatJumlah('Nominal tidak boleh negatif.'); pesan = 1; }
    else galatJumlah('');
    if (!form.kategori.trim()) { galatKategori('Pilih kategori dulu.'); pesan = pesan || 2; }
    else galatKategori('');
    if (!U.validDate(form.tanggal)) { toast('err', 'Tanggal tidak valid'); pesan = pesan || 3; }
    if (pesan === 1) { const j = $('#f-jumlah'); if (j) j.focus(); }
    return pesan;
  }

  async function simpanForm() {
    if (!form || form.menyimpan) return;
    if (validasiForm()) return;
    const item = { id: form.id || U.uid(), jenis: form.jenis, tanggal: form.tanggal, kategori: form.kategori.trim(), jumlah: form.jumlah, catatan: form.catatan.trim() };
    const simpanKat = S.get('kat.' + item.jenis, []);
    if (!simpanKat.some((k) => U.kunciKat(k) === U.kunciKat(item.kategori)) && !KK.kat.DEFAULT[item.jenis].some((k) => U.kunciKat(k.n) === U.kunciKat(item.kategori))) {
      simpanKat.push(item.kategori); S.set('kat.' + item.jenis, simpanKat);
    }
    if (form.mode === 'baru') await tambahItem(item);
    else await ubahItem(item);
  }

  async function tambahItem(item) {
    const demo = A.modeDemo();
    tutupSheet(true);
    gantiItems((a) => a.concat([tandaiPending(item)]));
    if (!demo) A.outbox.tambah(item);       // dicatat dulu di HP; aman walau aplikasi tertutup di tengah jalan
    render();
    const t = toast('load', 'Menyimpan ke ' + (demo ? 'data contoh' : 'spreadsheet') + '...');
    try {
      await A.add(item);
      A.outbox.hapus(item.id);
      gantiItems((a) => a.map((i) => (i.id === item.id ? Object.assign({}, i, { pending: false }) : i)));
      if (demo) simpanDemoCache(); else simpanCache();
      t.ubah('ok', (item.jenis === 'masuk' ? 'Pemasukan ' : 'Pengeluaran ') + rp(item.jumlah) + ' tersimpan', demo ? 'Disimpan di data contoh.' : 'Masuk ke sheet ' + (item.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran') + '.');
    } catch (e) {
      if (e.kode === 'VALIDASI') {
        A.outbox.hapus(item.id);
        gantiItems((a) => a.filter((i) => i.id !== item.id));
        t.ubah('err', 'Tidak tersimpan: ' + e.message, 'Periksa isian lalu coba lagi.');
        setTimeout(() => bukaForm(Object.assign({}, item, { mode: 'baru', id: null })), 250);
      } else {
        const jaringan = e.kode === 'JARINGAN';
        t.ubah('warn', jaringan ? 'Belum ada koneksi' : 'Belum terkirim: ' + e.message, jaringan ? 'Tersimpan di HP dan dikirim otomatis saat online.' : 'Tersimpan di HP dan akan dicoba lagi otomatis.');
      }
    }
    render();
  }
  function simpanDemoCache() { /* mode demo sudah menyimpan sendiri */ }

  async function ubahItem(item) {
    form.menyimpan = true; lukisTombol();
    try {
      await A.update(item, form.jenisLama);
      gantiItems((a) => a.map((i) => (i.id === item.id ? Object.assign({}, item, { baris: i.baris }) : i)));
      if (!A.modeDemo()) simpanCache();
      tutupSheet(true);
      toast('ok', 'Perubahan tersimpan', A.modeDemo() ? '' : 'Spreadsheet sudah diperbarui.');
      render();
    } catch (e) {
      if (form) { form.menyimpan = false; lukisTombol(); }
      toast('err', e.kode === 'TIDAK_DITEMUKAN' ? e.message : 'Gagal menyimpan perubahan', e.kode === 'TIDAK_DITEMUKAN' ? 'Tarik data terbaru lewat tombol Sinkronkan.' : e.message);
    }
  }

  function konfirmasiHapus(it) {
    const sheet = it.jenis === 'masuk' ? 'Pemasukan' : 'Pengeluaran';
    const demo = A.modeDemo();
    const o = bukaSheet('<div class="big-ic">' + IC('trash', 26) + '</div><h2>Hapus transaksi ini?</h2>' +
      '<p>' + (demo ? 'Transaksi akan dihapus dari data contoh.' : 'Barisnya akan dihapus dari sheet ' + sheet + '. Salinannya disimpan di sheet Log Kasku.') + '</p>' +
      '<div class="sum"><span class="muted">' + esc(it.kategori) + ', ' + esc(U.fmtTgl(it.tanggal)) + '</span><b>' + (it.jenis === 'masuk' ? '+' : '−') + esc(rp(it.jumlah)) + '</b></div>' +
      '<div class="acts"><button class="btn sec2" data-aksi="tutup">Batal</button><button class="btn danger" id="h-ya" data-aksi="hapus-ya">Hapus</button></div>', { dialog: true });
    o.__item = it;
    return o;
  }
  async function hapusItem(it) {
    const b = $('#h-ya');
    if (b) { b.disabled = true; b.innerHTML = IC('refresh', 20, 'spin-i') + 'Menghapus'; }
    try {
      await A.remove(it);
      gantiItems((a) => a.filter((i) => i.id !== it.id));
      if (!A.modeDemo()) simpanCache();
      tutupSheet(true);
      toast('ok', 'Transaksi dihapus', A.modeDemo() ? '' : 'Salinannya ada di sheet Log Kasku.');
      render();
    } catch (e) {
      if (b) { b.disabled = false; b.textContent = 'Hapus'; }
      toast('err', 'Gagal menghapus', e.message);
    }
  }

  /* ===================================================================
   *  Sheet filter & periode kustom
   * =================================================================== */
  function bukaFilter() {
    const f = state.filter;
    const semuaKat = KK.kat.daftar('keluar', state.items).concat(KK.kat.daftar('masuk', state.items)).filter((k, i, a) => a.findIndex((x) => U.kunciKat(x) === U.kunciKat(k)) === i).sort((a, b) => a.localeCompare(b, 'id'));
    bukaSheet('<div class="sheet-h"><h2>Filter riwayat</h2><button class="icon-btn" data-aksi="tutup" aria-label="Tutup">' + IC('x', 20) + '</button></div><div class="sheet-b">' +
      '<div class="lbl" style="margin-top:6px">Kategori</div><select id="ff-kat" class="field"><option value="">Semua kategori</option>' + semuaKat.map((k) => '<option value="' + esc(k) + '"' + (U.kunciKat(k) === U.kunciKat(f.kategori) ? ' selected' : '') + '>' + esc(k) + '</option>').join('') + '</select>' +
      '<div class="lbl">Rentang tanggal</div><div class="grid2"><div><small class="muted">Dari</small><input id="ff-dari" class="field" type="date" value="' + esc(f.dari) + '"></div><div><small class="muted">Sampai</small><input id="ff-sampai" class="field" type="date" value="' + esc(f.sampai) + '"></div></div>' +
      '<div class="quick" style="margin-top:12px"><button type="button" data-aksi="ff-cepat" data-v="bulan">Bulan ini</button><button type="button" data-aksi="ff-cepat" data-v="30">30 hari terakhir</button><button type="button" data-aksi="ff-cepat" data-v="tahun">Tahun ini</button></div><div style="height:8px"></div></div>' +
      '<div class="sheet-f"><button class="btn sec2" data-aksi="filter-reset-tutup">Atur ulang</button><button class="btn pri" data-aksi="filter-terapkan">Terapkan</button></div>');
  }
  function bukaKustom() {
    const hari = hariIni(), p = state.periode;
    const dari = p.tipe === 'kustom' && p.dari ? p.dari : U.startOfMonth(hari), sampai = p.tipe === 'kustom' && p.sampai ? p.sampai : hari;
    bukaSheet('<div class="sheet-h"><h2>Periode kustom</h2><button class="icon-btn" data-aksi="tutup" aria-label="Tutup">' + IC('x', 20) + '</button></div><div class="sheet-b">' +
      '<div class="grid2" style="margin-top:6px"><div><small class="muted">Dari</small><input id="k-dari" class="field" type="date" value="' + esc(dari) + '"></div><div><small class="muted">Sampai</small><input id="k-sampai" class="field" type="date" value="' + esc(sampai) + '"></div></div>' +
      '<div class="quick" style="margin-top:12px"><button type="button" data-aksi="k-cepat" data-v="7">7 hari</button><button type="button" data-aksi="k-cepat" data-v="30">30 hari</button><button type="button" data-aksi="k-cepat" data-v="90">90 hari</button><button type="button" data-aksi="k-cepat" data-v="tahun">Tahun ini</button></div><div class="err-t" id="k-err"></div></div>' +
      '<div class="sheet-f"><button class="btn pri" data-aksi="k-terapkan">Terapkan periode</button></div>');
  }

  /* ===================================================================
   *  Aksi (delegasi klik)
   * =================================================================== */
  const aksi = {
    tab: (el) => pindahTab(el.dataset.tab),
    tutup: () => tutupSheet(),
    batal: () => tutupSheet(),
    tambah: () => { if (!A.terhubung()) return; if (stack.length) return; bukaForm(); },
    sinkron: () => {
      if (!A.terhubung() || state.sedangMuat) return;
      if (!state.online) { toast('warn', 'Sedang offline', 'Sambungkan internet lalu coba lagi.'); return; }
      muatData();
    },

    periode: (el) => {
      const t = el.dataset.tipe;
      if (t === 'kustom') { bukaKustom(); return; }
      state.periode = { tipe: t, offset: 0 };
      S.set('periode', { tipe: t });
      render();
    },
    geser: (el) => {
      const n = Number(el.dataset.n), p = state.periode;
      if (p.tipe === 'kustom') {
        const r = ST.rentang(p, hariIni()), len = U.diffDays(r.mulai, r.akhir) + 1;
        if (n > 0 && r.akhir >= hariIni()) return;
        state.periode = { tipe: 'kustom', offset: 0, dari: U.addDays(r.mulai, n * len), sampai: U.addDays(r.akhir, n * len) };
      } else {
        const off = Math.min(0, (p.offset || 0) + n);
        if (n > 0 && (p.offset || 0) >= 0) return;
        state.periode = Object.assign({}, p, { offset: off });
      }
      render();
    },
    'k-cepat': (el) => {
      const hari = hariIni(), v = el.dataset.v;
      $('#k-sampai').value = hari;
      $('#k-dari').value = v === 'tahun' ? U.parts(hari).y + '-01-01' : U.addDays(hari, -(Number(v) - 1));
    },
    'k-terapkan': () => {
      const dari = $('#k-dari').value, sampai = $('#k-sampai').value;
      if (!U.validDate(dari) || !U.validDate(sampai)) { $('#k-err').innerHTML = IC('alert', 15) + 'Isi kedua tanggal.'; return; }
      state.periode = { tipe: 'kustom', offset: 0, dari: dari <= sampai ? dari : sampai, sampai: dari <= sampai ? sampai : dari };
      S.set('periode', { tipe: 'kustom' });
      tutupSheet(); render();
    },
    segkat: (el) => { state.katJenis = el.dataset.v; render(); },
    segtren: (el) => { state.trenMode = el.dataset.v; render(); },
    kategori: (el) => {
      const r = ST.rentang(state.periode, hariIni());
      state.filter = { q: '', jenis: state.katJenis, kategori: el.dataset.kat, dari: r.mulai, sampai: r.akhir < hariIni() ? r.akhir : '' };
      state.limit = 40;
      pindahTab('riwayat');
    },

    ubah: (el) => {
      const it = state.items.find((i) => i.id === el.dataset.id && i.jenis === el.dataset.jenis);
      if (!it) return;
      if (it.pending) { toast('info', 'Transaksi ini masih menunggu dikirim', 'Tunggu sampai tersinkron untuk mengubahnya.'); return; }
      bukaForm({ mode: 'ubah', id: it.id, jenis: it.jenis, jenisLama: it.jenis, jumlah: it.jumlah, kategori: it.kategori, tanggal: it.tanggal, catatan: it.catatan });
    },
    fjenis: (el) => {
      if (!form || form.jenis === el.dataset.v) return;
      form.jenis = el.dataset.v; form.kategori = '';
      lukisJenis(); lukisKategori(); lukisTombol(); galatKategori('');
    },
    'fkat-semua': () => { form.semuaKat = !form.semuaKat; lukisKategori(); },
    fkat: (el) => { form.kategori = el.dataset.kat; $('#f-katbaru').hidden = true; lukisKategori(); galatKategori(''); },
    'fkat-baru': () => { const b = $('#f-katbaru'); b.hidden = !b.hidden; if (!b.hidden) $('#f-katnama').focus(); },
    fquick: (el) => { const n = Number(el.dataset.n); setJumlah(n === 0 ? 0 : form.jumlah + n); galatJumlah(''); },
    ftgl: (el) => { form.tanggal = el.dataset.v; lukisTanggal(); },
    fsimpan: () => simpanForm(),
    fhapus: () => {
      if (!form) return;
      const it = state.items.find((i) => i.id === form.id);
      if (it) konfirmasiHapus(it);
    },
    'hapus-ya': (el) => { const o = el.closest('.ovl'); if (o && o.__item) hapusItem(o.__item); },

    rjenis: (el) => { state.filter.jenis = el.dataset.v; state.limit = 40; render(); },
    lagi: () => { state.limit += 40; segarkanDaftar(); },
    'filter-buka': () => bukaFilter(),
    'filter-terapkan': () => {
      state.filter.kategori = $('#ff-kat').value;
      state.filter.dari = $('#ff-dari').value; state.filter.sampai = $('#ff-sampai').value;
      state.limit = 40; tutupSheet(); render();
    },
    'filter-reset': () => { state.filter = { q: '', jenis: 'semua', kategori: '', dari: '', sampai: '' }; state.limit = 40; render(); },
    'filter-reset-tutup': () => { aksi['filter-reset'](); tutupSheet(); },
    'hapus-tag': (el) => {
      if (el.dataset.f === 'kategori') state.filter.kategori = ''; else { state.filter.dari = ''; state.filter.sampai = ''; }
      render();
    },
    'ff-cepat': (el) => {
      const hari = hariIni(), v = el.dataset.v;
      $('#ff-sampai').value = hari;
      $('#ff-dari').value = v === 'bulan' ? U.startOfMonth(hari) : v === 'tahun' ? U.parts(hari).y + '-01-01' : U.addDays(hari, -29);
    },

    'ubah-koneksi': () => bukaUbahKoneksi(),
    'demo-mulai': () => {
      A.setDemo(true); A.resetDemo();
      state.items = []; state.muat = 'idle'; state.tab = 'beranda'; state.heroTerakhir = null;
      render(); muatData({ senyap: true });
      toast('info', 'Mode demo aktif', 'Data contoh hanya ada di HP ini.');
    },
    'demo-keluar': () => { A.setDemo(false); state.items = []; state.pra = null; state.tab = 'beranda'; render(); },
    'demo-reset': () => { A.resetDemo(); state.items = []; muatData({ senyap: true }); toast('ok', 'Data contoh dikembalikan'); },
    putus: () => {
      const o = bukaSheet('<div class="big-ic">' + IC('trash', 26) + '</div><h2>Hapus data aplikasi?</h2><p>Kunci akses dan cache di HP ini dihapus. Isi spreadsheet tidak berubah. Transaksi yang belum terkirim ikut hilang.</p>' +
        '<div class="acts"><button class="btn sec2" data-aksi="tutup">Batal</button><button class="btn danger" data-aksi="putus-ya">Hapus</button></div>', { dialog: true });
      return o;
    },
    'putus-ya': () => {
      A.hapusKonfig(); A.setDemo(false); A.cache.hapus(); A.outbox.tulis([]);
      state.items = []; state.muat = 'idle'; state.waktu = null;
      tutupSheet(true); render();
    },
    pasang: async () => {
      if (!state.installEvt) return;
      state.installEvt.prompt();
      try { await state.installEvt.userChoice; } catch (e) { /* abaikan */ }
      state.installEvt = null; render();
    }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-aksi]');
    if (!el || el.disabled) return;
    const fn = aksi[el.dataset.aksi];
    if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); }
  });

  /* ---------- input ---------- */
  let timerCari;
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'f-jumlah' && form) {
      const mentah = t.value;
      if (/-/.test(mentah)) galatJumlah('Nominal tidak boleh negatif.'); else galatJumlah('');
      setJumlah(U.angkaDariTeks(mentah));
    } else if (t.id === 'f-cat' && form) {
      form.catatan = t.value;
    } else if (t.id === 'q') {
      clearTimeout(timerCari);
      timerCari = setTimeout(() => { state.filter.q = t.value; state.limit = 40; segarkanDaftar(); }, 120);
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'f-tgl' && form && U.validDate(e.target.value)) { form.tanggal = e.target.value; lukisTanggal(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'f-katnama' && form) {
      e.preventDefault();
      const v = e.target.value.trim();
      if (v) { form.kategori = v; e.target.value = ''; $('#f-katbaru').hidden = true; lukisKategori(); galatKategori(''); }
    } else if ((e.target.id === 'f-cat' || e.target.id === 'f-jumlah') && form) {
      e.preventDefault(); simpanForm();
    } else if (e.target.id === 'q') { e.target.blur(); }
  });

  /* ---------- jaringan & siklus aplikasi ---------- */
  window.addEventListener('online', () => { state.online = true; renderStatus(); if (A.terhubung()) muatData({ senyap: true }); });
  window.addEventListener('offline', () => { state.online = false; renderStatus(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && A.terhubung() && !stack.length && (!state.waktu || Date.now() - state.waktu > 60000)) muatData({ senyap: true });
  });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installEvt = e; if (state.tab === 'setelan') render(); });
  window.addEventListener('appinstalled', () => { state.installEvt = null; if (state.tab === 'setelan') render(); });

  /* ===================================================================
   *  Mulai
   * =================================================================== */
  function mulai() {
    // Tautan pintas: #u=<url>&k=<kunci> mengisi layar hubungkan, lalu hash dihapus dari riwayat.
    if (location.hash.length > 3) {
      try {
        const p = new URLSearchParams(location.hash.slice(1));
        if (p.get('u') && p.get('k')) {
          state.pra = { url: p.get('u'), key: p.get('k') };
          if (!A.modeDemo()) { A.hapusKonfig(); }
        }
        history.replaceState(null, '', location.pathname + location.search);
      } catch (e) { /* abaikan */ }
    }
    if (A.terhubung()) {
      const c = A.cache.baca();
      state.items = ((c && c.items) || []).map(norm).concat(A.outbox.semua().map(tandaiPending));
      if (c) state.waktu = null;
      state.muat = c ? 'ok' : 'idle';
    }
    render();
    if (A.terhubung()) muatData({ senyap: true });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* aplikasi tetap jalan tanpa mode offline */ });
    }
    if (state.pra && !A.terhubung()) { const b = $('#s-btn'); if (b) setTimeout(() => $('#fsetup').requestSubmit && $('#fsetup').requestSubmit(), 200); }
    // Pintasan ikon aplikasi "Tambah Transaksi"
    if (A.terhubung() && /[?&]tambah=1/.test(location.search)) {
      history.replaceState(null, '', location.pathname);
      setTimeout(() => { if (!stack.length) bukaForm(); }, 150);
    }
  }
  KK.app = { state, render, toast };
  mulai();
})();
