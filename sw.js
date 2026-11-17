/* =====================================================================
 *  KASKU - sw.js (service worker)
 *  Menyimpan berkas aplikasi di HP supaya terbuka cepat dan tetap bisa
 *  dibuka tanpa internet. Panggilan ke Google Apps Script TIDAK pernah
 *  disimpan (data keuangan hanya lewat jaringan atau cache aplikasi).
 *  Naikkan VERSI di bawah setiap kali kamu mengubah berkas aplikasi.
 * ===================================================================== */
const VERSI = 'kasku-v1.0.0';
const INTI = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/util.js', 'js/categories.js', 'js/stats.js', 'js/charts.js', 'js/api.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(INTI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('kasku-') && k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Font Google: simpan saat pertama dimuat agar tetap tampil offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSI).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => { c.put(req, r.clone()); return r; }).catch(() => hit))));
    return;
  }
  if (url.origin !== self.location.origin) return;   // selain itu (termasuk Apps Script) langsung ke jaringan

  // Berkas aplikasi: tampilkan dari cache dulu, perbarui di belakang layar.
  e.respondWith(
    caches.open(VERSI).then((c) =>
      c.match(req, { ignoreSearch: true }).then((hit) => {
        const segar = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || segar;
      })
    )
  );
});
