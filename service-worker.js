// Service worker minimal : cache-first pour les assets statiques, fonctionnement hors-ligne.
// CACHE_NAME embarque la version de l'app pour forcer l'invalidation du cache à chaque
// nouveau lot déployé — garder ce numéro synchronisé avec src/version.js (APP_VERSION).

const CACHE_NAME = 'golf-app-cache-v1.2.2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './src/main.js',
  './src/version.js',
  './src/db/schema.js',
  './src/db/repository.js',
  './src/db/exportImport.js',
  './src/scoring/handicap.js',
  './src/scoring/stableford.js',
  './src/scoring/distance.js',
  './src/scoring/calibration.js',
  './src/geo/geolocation.js',
  './src/geo/openStreetMap.js',
  './src/ui/formHelpers.js',
  './src/ui/lineChart.js',
  './src/ui/icons.js',
  './src/icons/icons.js',
  './src/data/standardClubs.js',
  './src/data/shotOptions.js',
  './src/import/pdfScorecard.js',
  './src/lib/pdf.js',
  './src/lib/pdf.worker.js',
  './src/views/menu.js',
  './src/views/settings.js',
  './src/views/courseManage.js',
  './src/views/courseFormShared.js',
  './src/views/courseNew.js',
  './src/views/courseImportPdf.js',
  './src/views/courseEdit.js',
  './src/views/courseDelete.js',
  './src/views/courseCalibrate.js',
  './src/views/resumeRound.js',
  './src/views/roundNew.js',
  './src/views/play.js',
  './src/views/scorecard.js',
  './src/views/history.js',
  './src/views/stats.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
