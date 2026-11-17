/* =====================================================================
 *  KASKU - util.js
 *  Fungsi bantu: format Rupiah, tanggal (selalu teks 'YYYY-MM-DD' agar
 *  bebas masalah zona waktu), penyimpanan lokal, dan keamanan HTML.
 * ===================================================================== */
(function () {
  'use strict';
  const KK = (globalThis.KK = globalThis.KK || {});

  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BULAN_P = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const HARI_P = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- tanggal ---------- */
  function toMs(s) { const p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function fromMs(ms) { const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(s, n) { return fromMs(toMs(s) + n * 86400000); }
  function diffDays(a, b) { return Math.round((toMs(b) - toMs(a)) / 86400000); }
  function parts(s) { const p = s.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function addMonths(s, n) {
    const p = parts(s), t = p.m - 1 + n;
    const y = p.y + Math.floor(t / 12), m = ((t % 12) + 12) % 12;
    return fromMs(Date.UTC(y, m, Math.min(p.d, daysInMonth(y, m + 1))));
  }
  function startOfMonth(s) { const p = parts(s); return p.y + '-' + pad(p.m) + '-01'; }
  function endOfMonth(s) { const p = parts(s); return p.y + '-' + pad(p.m) + '-' + pad(daysInMonth(p.y, p.m)); }
  function dow(s) { return new Date(toMs(s)).getUTCDay(); }               // 0 = Minggu
  function startOfWeek(s) { return addDays(s, -((dow(s) + 6) % 7)); }      // Senin
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && fromMs(toMs(s)) === s; }

  function fmtTgl(s) { const p = parts(s); return p.d + ' ' + BULAN_P[p.m - 1] + ' ' + p.y; }
  function fmtTglP(s) { const p = parts(s); return p.d + ' ' + BULAN_P[p.m - 1]; }
  function fmtHari(s) { const p = parts(s); return HARI_P[dow(s)] + ', ' + p.d + ' ' + BULAN_P[p.m - 1]; }
  function fmtBulan(s) { const p = parts(s); return BULAN[p.m - 1] + ' ' + p.y; }
  function fmtRentang(a, b) {
    if (a === b) return fmtTgl(a);
    const pa = parts(a), pb = parts(b);
    if (pa.y === pb.y && pa.m === pb.m) return pa.d + '–' + pb.d + ' ' + BULAN_P[pb.m - 1] + ' ' + pb.y;
    if (pa.y === pb.y) return fmtTglP(a) + ' – ' + fmtTglP(b) + ' ' + pb.y;
    return fmtTgl(a) + ' – ' + fmtTgl(b);
  }
  function labelHari(s, hariIni) {
    if (s === hariIni) return 'Hari ini';
    if (s === addDays(hariIni, -1)) return 'Kemarin';
    return HARI_P[dow(s)] + ', ' + fmtTgl(s);
  }

  /* ---------- angka ---------- */
  function rp(n, tanda) {
    const neg = n < 0, abs = Math.abs(n);
    const t = (neg ? '−' : (tanda && n > 0 ? '+' : '')) + 'Rp ' + nf.format(abs);
    return t;
  }
  function ringkas(n) {
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    const f = (v) => nf.format(Math.round(v * 10) / 10);
    if (a >= 1e12) return s + f(a / 1e12) + ' T';
    if (a >= 1e9) return s + f(a / 1e9) + ' M';
    if (a >= 1e6) return s + f(a / 1e6) + ' jt';
    if (a >= 1e3) return s + f(a / 1e3) + ' rb';
    return s + nf.format(Math.round(a));
  }
  function rpRingkas(n) { return 'Rp ' + ringkas(n); }
  function angkaDariTeks(t) { const d = String(t || '').replace(/\D/g, '').replace(/^0+(?=\d)/, ''); return d ? Number(d) : 0; }
  function ribuan(n) { return n ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n) : ''; }
  function persen(n) { return nf.format(Math.round(n * 10) / 10) + '%'; }

  /* ---------- lain-lain ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]); }
  function uid() {
    try { if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16); } catch (e) { /* lanjut */ }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function kunciKat(s) { return String(s || '').trim().toLowerCase(); }

  /* ---------- penyimpanan lokal (aman bila diblokir) ---------- */
  const mem = {};
  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem('kasku.' + k); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return k in mem ? mem[k] : fallback; }
    },
    set(k, v) {
      try { localStorage.setItem('kasku.' + k, JSON.stringify(v)); } catch (e) { mem[k] = v; }
    },
    del(k) {
      try { localStorage.removeItem('kasku.' + k); } catch (e) { /* abaikan */ }
      delete mem[k];
    }
  };

  KK.u = {
    BULAN, BULAN_P, HARI_P, pad, toMs, fromMs, todayStr, addDays, diffDays, parts, daysInMonth, addMonths,
    startOfMonth, endOfMonth, startOfWeek, dow, validDate, fmtTgl, fmtTglP, fmtHari, fmtBulan, fmtRentang, labelHari,
    rp, ringkas, rpRingkas, angkaDariTeks, ribuan, persen, esc, uid, kunciKat
  };
  KK.store = store;
})();
