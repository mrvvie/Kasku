/* =====================================================================
 *  KASKU - charts.js
 *  Grafik SVG/HTML tanpa pustaka luar: batang kategori, tren harian
 *  (garis) dan bulanan (batang berkelompok), serta perbandingan
 *  pemasukan vs pengeluaran. Warna sudah lulus validasi kontras & CVD.
 * ===================================================================== */
(function () {
  'use strict';
  const KK = (globalThis.KK = globalThis.KK || {});
  const U = KK.u, esc = KK.u.esc;

  const C_IN = '#0e9486', C_OUT = '#6d4aff';
  const registry = {};
  let seq = 0;

  /* ---------- skala sumbu Y yang "enak dibaca" ---------- */
  function skala(maks) {
    const v = maks > 0 ? maks : 100000;
    const mentah = v / 4;
    const e = Math.pow(10, Math.floor(Math.log10(mentah)));
    const f = mentah / e;
    const langkah = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
    const n = Math.max(1, Math.ceil(v / langkah));
    return { langkah, n, maks: langkah * n };
  }

  /* ---------- batang per kategori ---------- */
  function batangKategori(daftar, jenis) {
    if (!daftar.length) return '';
    const maks = daftar[0].total || 1;
    const warna = jenis === 'masuk' ? C_IN : C_OUT;
    return '<ul class="kb">' + daftar.map((e) => {
      const gabungan = !!e.gabungan;
      const lebar = Math.max(2, (e.total / maks) * 100);
      const nama = gabungan ? 'Kategori lainnya (' + e.gabungan + ')' : e.kategori;
      const isi =
        '<div class="kb-top"><span class="kb-name"><i class="kb-ic">' + KK.ic(gabungan ? 'dots' : KK.kat.ikon(e.kategori), 15) + '</i><span>' + esc(nama) + '</span></span>' +
        '<span class="kb-val">' + esc(U.rp(e.total)) + '<small>' + esc(U.persen(e.persen)) + '</small></span></div>' +
        '<div class="kb-track"><div class="kb-fill' + (gabungan ? ' rest' : '') + '" style="width:' + lebar.toFixed(1) + '%;--c:' + warna + '"></div></div>';
      return gabungan
        ? '<li><div class="kb-row">' + isi + '</div></li>'
        : '<li><button class="kb-row tap" data-aksi="kategori" data-kat="' + esc(e.kategori) + '" aria-label="Lihat transaksi ' + esc(e.kategori) + '">' + isi + '</button></li>';
    }).join('') + '</ul>';
  }

  /* ---------- perbandingan pemasukan vs pengeluaran ---------- */
  function banding(r) {
    const maks = Math.max(r.masuk, r.keluar, 1);
    const baris = (nama, nilai, warna) =>
      '<div class="vs-r"><div class="kb-top"><span class="kb-name"><span>' + nama + '</span></span><span class="kb-val">' + esc(U.rp(nilai)) + '</span></div>' +
      '<div class="kb-track"><div class="kb-fill" style="width:' + (nilai > 0 ? Math.max(2, (nilai / maks) * 100).toFixed(1) : 0) + '%;--c:' + warna + '"></div></div></div>';
    return '<div class="vs">' + baris('Pemasukan', r.masuk, C_IN) + baris('Pengeluaran', r.keluar, C_OUT) +
      '<div class="vs-net"><span>' + (r.bersih >= 0 ? 'Surplus' : 'Defisit') + '</span><span class="num">' + esc(U.rp(r.bersih)) + '</span></div></div>';
  }

  /* ---------- tren ---------- */
  const W = 360, H = 206, ML = 46, MR = 8, MT = 10, MB = 26;
  const PW = W - ML - MR, PH = H - MT - MB;

  function sumbuY(sk) {
    let s = '';
    for (let i = 0; i <= sk.n; i++) {
      const y = MT + PH - (i / sk.n) * PH;
      s += '<line class="grid" x1="' + ML + '" x2="' + (W - MR) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="axl" x="' + (ML - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + (i === 0 ? '0' : esc(U.ringkas(sk.langkah * i))) + '</text>';
    }
    return s;
  }

  function legenda() {
    return '<div class="legend"><span><i style="background:' + C_IN + '"></i>Pemasukan</span><span><i style="background:' + C_OUT + '"></i>Pengeluaran</span></div>';
  }

  function tabelTren(titik, kolom) {
    return '<details class="tbl"><summary>Lihat sebagai tabel</summary><table><thead><tr><th>' + kolom + '</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>' +
      titik.map((t) => '<tr><td>' + esc(t.label) + '</td><td>' + esc(U.rp(t.masuk)) + '</td><td>' + esc(U.rp(t.keluar)) + '</td></tr>').join('') +
      '</tbody></table></details>';
  }

  function tren(deret, mode) {
    const harian = mode === 'harian';
    const titik = deret.map((d) => ({
      masuk: d.masuk, keluar: d.keluar,
      label: harian ? U.fmtHari(d.tgl) : U.fmtBulan(d.tgl),
      pendek: harian ? String(U.parts(d.tgl).d) : U.BULAN_P[U.parts(d.tgl).m - 1],
      tgl: d.tgl
    }));
    const n = titik.length;
    const maks = titik.reduce((a, t) => Math.max(a, t.masuk, t.keluar), 0);
    const total = titik.reduce((a, t) => a + t.masuk + t.keluar, 0);
    if (!total) return '<div class="empty small"><p class="muted" style="margin:0">Belum ada transaksi pada rentang ini.</p></div>';

    const sk = skala(maks);
    const id = 'c' + (++seq);
    const yOf = (v) => MT + PH - (v / sk.maks) * PH;
    let isi = sumbuY(sk), xOf, lebarBand = 0;

    if (harian) {
      xOf = (i) => ML + (n === 1 ? PW / 2 : (i / (n - 1)) * PW);
      const jalur = (kunci) => titik.map((t, i) => (i ? 'L' : 'M') + xOf(i).toFixed(1) + ' ' + yOf(t[kunci]).toFixed(1)).join(' ');
      isi += '<path class="ln" d="' + jalur('masuk') + '" stroke="' + C_IN + '"/><path class="ln" d="' + jalur('keluar') + '" stroke="' + C_OUT + '"/>';
      const langkahLabel = n <= 8 ? 1 : n <= 16 ? 2 : n <= 31 ? 5 : 10;
      titik.forEach((t, i) => {
        if (i % langkahLabel === 0 || i === n - 1) {
          if (i !== n - 1 && n - 1 - i < langkahLabel * 0.6) return;
          isi += '<text class="axl" x="' + xOf(i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(t.pendek) + '</text>';
        }
      });
      isi += '<line class="cross" id="' + id + 'x" x1="0" x2="0" y1="' + MT + '" y2="' + (MT + PH) + '" style="display:none"/>' +
        '<circle class="pt" id="' + id + 'a" r="5" fill="' + C_IN + '" style="display:none"/><circle class="pt" id="' + id + 'b" r="5" fill="' + C_OUT + '" style="display:none"/>';
    } else {
      lebarBand = PW / n;
      xOf = (i) => ML + lebarBand * (i + 0.5);
      const bw = Math.min(22, lebarBand * 0.32), gap = 2;
      titik.forEach((t, i) => {
        const cx = xOf(i);
        isi += '<rect class="grpbg" id="' + id + 'g' + i + '" x="' + (ML + lebarBand * i + 2).toFixed(1) + '" y="' + MT + '" width="' + (lebarBand - 4).toFixed(1) + '" height="' + PH + '" rx="10"/>';
        isi += batangAtas(cx - gap / 2 - bw, yOf(t.masuk), bw, MT + PH, C_IN);
        isi += batangAtas(cx + gap / 2, yOf(t.keluar), bw, MT + PH, C_OUT);
        isi += '<text class="axl" x="' + cx.toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(t.pendek) + '</text>';
      });
    }
    isi += '<rect class="hit" x="' + ML + '" y="' + MT + '" width="' + PW + '" height="' + PH + '" fill="transparent"/>';

    registry[id] = { titik, harian, n, xOf, yOf, lebarBand };
    const ringkasan = harian ? 'Tren harian pemasukan dan pengeluaran' : 'Tren bulanan pemasukan dan pengeluaran';
    return legenda() +
      '<div class="cht" data-chart="' + id + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + ringkasan + '">' + isi + '</svg><div class="tip" id="' + id + 't" role="status"></div></div>' +
      tabelTren(titik, harian ? 'Tanggal' : 'Bulan');
  }

  /** Batang dengan ujung atas membulat 4px dan dasar rata di garis dasar. */
  function batangAtas(x, yAtas, lebar, yDasar, warna) {
    const tinggi = yDasar - yAtas;
    if (tinggi <= 0.5) return '';
    const r = Math.min(4, lebar / 2, tinggi);
    return '<path d="M' + x.toFixed(1) + ' ' + yDasar.toFixed(1) + 'V' + (yAtas + r).toFixed(1) + 'Q' + x.toFixed(1) + ' ' + yAtas.toFixed(1) + ' ' + (x + r).toFixed(1) + ' ' + yAtas.toFixed(1) +
      'H' + (x + lebar - r).toFixed(1) + 'Q' + (x + lebar).toFixed(1) + ' ' + yAtas.toFixed(1) + ' ' + (x + lebar).toFixed(1) + ' ' + (yAtas + r).toFixed(1) + 'V' + yDasar.toFixed(1) + 'Z" fill="' + warna + '"/>';
  }

  /* ---------- interaksi (crosshair & tooltip) ---------- */
  function aktifkan(root) {
    root.querySelectorAll('.cht[data-chart]').forEach((el) => {
      const id = el.getAttribute('data-chart'), d = registry[id];
      if (!d || el.__aktif) return;
      el.__aktif = true;
      const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
      let sebelumnya = -1;

      function tunjuk(clientX) {
        const box = svg.getBoundingClientRect();
        const x = ((clientX - box.left) / box.width) * W;
        let i;
        if (d.harian) i = Math.round(((x - ML) / PW) * (d.n - 1));
        else i = Math.floor((x - ML) / d.lebarBand);
        i = Math.max(0, Math.min(d.n - 1, i));
        const t = d.titik[i];
        if (d.harian) {
          const cx = d.xOf(i);
          const g = (s) => svg.querySelector('#' + id + s);
          g('x').setAttribute('x1', cx); g('x').setAttribute('x2', cx); g('x').style.display = '';
          g('a').setAttribute('cx', cx); g('a').setAttribute('cy', d.yOf(t.masuk)); g('a').style.display = '';
          g('b').setAttribute('cx', cx); g('b').setAttribute('cy', d.yOf(t.keluar)); g('b').style.display = '';
        } else {
          if (sebelumnya >= 0) svg.querySelector('#' + id + 'g' + sebelumnya).classList.remove('on');
          svg.querySelector('#' + id + 'g' + i).classList.add('on');
        }
        sebelumnya = i;
        tip.innerHTML = '<b>' + esc(t.label) + '</b>' +
          '<div><span><i style="background:' + C_IN + '"></i>Pemasukan</span><span>' + esc(U.rp(t.masuk)) + '</span></div>' +
          '<div><span><i style="background:' + C_OUT + '"></i>Pengeluaran</span><span>' + esc(U.rp(t.keluar)) + '</span></div>';
        const px = (d.xOf(i) / W) * box.width, lebarTip = tip.offsetWidth || 170;
        let kiri = px + 12;
        if (kiri + lebarTip > box.width) kiri = px - lebarTip - 12;
        tip.style.left = Math.max(0, kiri) + 'px';
        tip.classList.add('on');
      }
      function sembunyi() {
        tip.classList.remove('on');
        if (d.harian) ['x', 'a', 'b'].forEach((s) => { svg.querySelector('#' + id + s).style.display = 'none'; });
        else if (sebelumnya >= 0) svg.querySelector('#' + id + 'g' + sebelumnya).classList.remove('on');
        sebelumnya = -1;
      }
      el.addEventListener('pointerdown', (e) => tunjuk(e.clientX));
      el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) tunjuk(e.clientX); });
      el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') sembunyi(); });
      el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(sembunyi, 1600); });
      el.addEventListener('pointercancel', sembunyi);
    });
  }

  function bersihkan() { Object.keys(registry).forEach((k) => delete registry[k]); }

  KK.charts = { batangKategori, banding, tren, aktifkan, bersihkan, skala, C_IN, C_OUT };
})();
