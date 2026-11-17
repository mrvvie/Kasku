/* =====================================================================
 *  KASKU - categories.js
 *  Daftar kategori bawaan (lazim dipakai pembukuan pribadi), ikon, dan
 *  warna. Kategori dari spreadsheet-mu yang sudah ada otomatis ikut muncul.
 * ===================================================================== */
(function () {
  'use strict';
  const KK = (globalThis.KK = globalThis.KK || {});

  /* ---------- ikon (garis tipis 24x24, gaya konsisten) ---------- */
  const P = {
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v2"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M21 10h-5a2 2 0 0 0 0 4h5z"/>',
    utensils: '<path d="M6 3v7a2 2 0 0 0 4 0V3"/><path d="M8 3v18"/><path d="M17 3c-2 1.5-3 4-3 7 0 1.5 1 2.5 3 2.5V21"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h3"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    car: '<path d="M4 15v-4l2-5h12l2 5v4"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><path d="M7 17h.01M17 17h.01"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
    gift: '<rect x="3" y="9" width="18" height="4" rx="1"/><path d="M5 13v7h14v-7M12 9v11"/><path d="M12 9C9.5 9 8 8 8 6.5a2 2 0 0 1 4 0V9zM12 9c2.5 0 4-1 4-2.5a2 2 0 0 0-4 0"/>',
    trend: '<path d="M3 17l6-6 4 4 7-8"/><path d="M15 7h5v5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    dots: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    navHome: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    navList: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    navChart: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
    navGear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
    cloudOff: '<path d="M3 3l18 18"/><path d="M17 17H7a4 4 0 0 1-.6-7.96M9.5 5.5A6 6 0 0 1 18 10a4 4 0 0 1 2 3.4"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 10a4 4 0 0 1 0 8z"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    flame: '<path d="M12 21c4 0 6-2.7 6-6 0-3-2-4.5-3-7-2 1-3 2.5-3 4-1-1-2-2-2-4-3 2-4 5-4 7 0 3.3 2 6 6 6z"/>'
  };

  KK.ic = function (nama, ukuran, kelas) {
    const s = ukuran || 20;
    return '<svg class="ic' + (kelas ? ' ' + kelas : '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[nama] || P.tag) + '</svg>';
  };

  /* ---------- kategori bawaan ---------- */
  const DEFAULT = {
    keluar: [
      { n: 'Makan & Minum', i: 'utensils' },
      { n: 'Transportasi', i: 'car' },
      { n: 'Hunian', i: 'home' },
      { n: 'Cicilan & Utang', i: 'card' },
      { n: 'Tagihan & Utilitas', i: 'bolt' },
      { n: 'Belanja', i: 'bag' },
      { n: 'Gaya Hidup', i: 'sparkle' },
      { n: 'Kesehatan', i: 'heart' },
      { n: 'Pendidikan', i: 'book' },
      { n: 'Hiburan', i: 'film' },
      { n: 'Asuransi', i: 'shield' },
      { n: 'Donasi & Zakat', i: 'gift' },
      { n: 'Tabungan & Investasi', i: 'trend' },
      { n: 'Lainnya', i: 'dots' }
    ],
    masuk: [
      { n: 'Gaji', i: 'wallet' },
      { n: 'Bonus', i: 'star' },
      { n: 'Usaha & Freelance', i: 'briefcase' },
      { n: 'Hasil Investasi', i: 'trend' },
      { n: 'Hadiah & Angpao', i: 'gift' },
      { n: 'Pengembalian Dana', i: 'undo' },
      { n: 'Pemasukan Lain', i: 'dots' }
    ]
  };

  // Kata kunci -> ikon, untuk nama kategori buatan sendiri / dari sheet lama.
  const KATA = [
    ['makan', 'utensils'], ['minum', 'utensils'], ['kuliner', 'utensils'], ['kopi', 'utensils'], ['jajan', 'utensils'],
    ['hunian', 'home'], ['rumah', 'home'], ['sewa', 'home'], ['kost', 'home'], ['kos', 'home'], ['kpr', 'home'], ['housing', 'home'],
    ['cicil', 'card'], ['utang', 'card'], ['hutang', 'card'], ['kredit', 'card'], ['pinjam', 'card'],
    ['tagihan', 'bolt'], ['listrik', 'bolt'], ['utilitas', 'bolt'], ['internet', 'bolt'], ['pulsa', 'bolt'], ['air', 'bolt'],
    ['transport', 'car'], ['bensin', 'car'], ['ojek', 'car'], ['parkir', 'car'], ['bbm', 'car'], ['tol', 'car'],
    ['belanja', 'bag'], ['shopping', 'bag'], ['kebutuhan', 'bag'],
    ['gaya', 'sparkle'], ['lifestyle', 'sparkle'], ['fashion', 'sparkle'], ['kecantikan', 'sparkle'],
    ['kesehatan', 'heart'], ['obat', 'heart'], ['dokter', 'heart'], ['medis', 'heart'],
    ['pendidikan', 'book'], ['sekolah', 'book'], ['kuliah', 'book'], ['kursus', 'book'], ['buku', 'book'],
    ['hiburan', 'film'], ['nonton', 'film'], ['game', 'film'], ['liburan', 'film'], ['wisata', 'film'], ['langganan', 'film'],
    ['asuransi', 'shield'], ['donasi', 'gift'], ['zakat', 'gift'], ['sedekah', 'gift'], ['hadiah', 'gift'], ['angpao', 'gift'],
    ['tabung', 'trend'], ['investasi', 'trend'], ['saham', 'trend'], ['dividen', 'trend'], ['reksa', 'trend'],
    ['gaji', 'wallet'], ['salary', 'wallet'], ['bonus', 'star'], ['thr', 'star'], ['tunjangan', 'star'],
    ['usaha', 'briefcase'], ['freelance', 'briefcase'], ['proyek', 'briefcase'], ['komisi', 'briefcase'], ['jual', 'briefcase'],
    ['pengembalian', 'undo'], ['refund', 'undo'], ['cashback', 'undo'],
    ['lain', 'dots']
  ];

  // 8 hue kategorikal yang sudah lulus validasi CVD & kontras (urutan tetap).
  const WARNA = ['#3f6bf0', '#e0701a', '#0e9486', '#8b5cf6', '#e8629a', '#7a8f1a', '#0e92cf', '#e5484d'];

  const namaKunci = (s) => KK.u.kunciKat(s);
  const peta = {};
  ['keluar', 'masuk'].forEach((j) => DEFAULT[j].forEach((k, idx) => { peta[namaKunci(k.n)] = { i: k.i, w: j === 'keluar' ? idx % 8 : (idx + 2) % 8 }; }));

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  function ikon(nama) {
    const k = namaKunci(nama);
    if (peta[k]) return peta[k].i;
    for (let i = 0; i < KATA.length; i++) if (k.indexOf(KATA[i][0]) >= 0) return KATA[i][1];
    return 'tag';
  }
  function warna(nama) {
    const k = namaKunci(nama);
    return WARNA[peta[k] ? peta[k].w : hash(k) % 8];
  }

  /**
   * Daftar kategori untuk form: yang sering dipakai (dari data) di depan,
   * lalu kategori bawaan yang belum pernah dipakai. Nama dari sheet lama
   * dipertahankan persis seperti tertulis di sana.
   */
  function daftar(jenis, items, tambahan) {
    const hitung = {}, asli = {};
    (items || []).forEach((it) => {
      if (it.jenis !== jenis) return;
      const k = namaKunci(it.kategori);
      if (!k) return;
      hitung[k] = (hitung[k] || 0) + 1;
      if (!asli[k]) asli[k] = it.kategori;
    });
    const hasil = [], ada = {};
    Object.keys(hitung).sort((a, b) => hitung[b] - hitung[a]).forEach((k) => { hasil.push(asli[k]); ada[k] = 1; });
    (tambahan || []).forEach((n) => { const k = namaKunci(n); if (k && !ada[k]) { hasil.push(n); ada[k] = 1; } });
    DEFAULT[jenis].forEach((c) => { const k = namaKunci(c.n); if (!ada[k]) { hasil.push(c.n); ada[k] = 1; } });
    return hasil;
  }

  KK.kat = { DEFAULT, ikon, warna, daftar, WARNA };
})();
