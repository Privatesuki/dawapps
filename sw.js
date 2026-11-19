/* DAWAPPS service worker
 * - Precaches the whole app shell + all 28 mini-apps and every language pack on first visit (offline-ready).
 * - Stale-while-revalidate for everything same-origin afterwards.
 * - A new deploy changes BUILD (see scripts/stamp-sw.mjs) -> new cache -> update prompt in the hub.
 */
const VERSION = '1.0.0';
const BUILD = 'dev';
const CACHE = `dawapps-${VERSION}-${BUILD}`;

const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'assets/css/global.css',
  'assets/css/hub.css',
  'assets/js/theme.js',
  'assets/js/common.js',
  'assets/js/apps.js',
  'assets/js/hub.js',
  'assets/js/qr.js',
  'assets/js/i18n.js',
  'assets/i18n/id.js',
  'assets/i18n/jv.js',
  'assets/i18n/ja.js',
  'assets/i18n/de.js',
  'assets/i18n/ko.js',
  'assets/i18n/zh.js',
  'assets/i18n/es.js',
  'assets/i18n/ar.js',
  'assets/icons/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'apps/text-counter.html',
  'apps/password-generator.html',
  'apps/pomodoro.html',
  'apps/color-palette.html',
  'apps/box-shadow.html',
  'apps/markdown-preview.html',
  'apps/encoder.html',
  'apps/unit-converter.html',
  'apps/decision-maker.html',
  'apps/sticky-notes.html',
  'apps/qr-generator.html',
  'apps/json-formatter.html',
  'apps/stopwatch.html',
  'apps/tip-calculator.html',
  'apps/aspect-ratio.html',
  'apps/gradient-generator.html',
  'apps/text-case.html',
  'apps/calculator.html',
  'apps/number-converter.html',
  'apps/countdown.html',
  'apps/code-scanner.html',
  'apps/svg-converter.html',
  'apps/image-compressor.html',
  'apps/css-units.html',
  'apps/timestamp.html',
  'apps/serial-monitor.html',
  'apps/snippet-vault.html',
  'apps/electronics-calc.html',
  'data/snippets.json',
  'data/snippets/esp32_relay_webserver.ino',
  'data/snippets/oled_ssd1306_i2c.ino',
  'data/snippets/lcd_i2c_16x2.ino',
  'data/snippets/wifi_mqtt_client.ino'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
  );
  // No skipWaiting() here: the hub asks for it (SKIP_WAITING) so an update never swaps code mid-use.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dawapps-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Cache key without the query string so "?embed=1" and "?source=pwa" share one entry.
const keyFor = (url) => new Request(url.origin + url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  event.respondWith(handle(event, req, url));
});

async function handle(event, req, url) {
  const cache = await caches.open(CACHE);
  const key = keyFor(url);
  const cached = await cache.match(key);

  const network = fetch(req)
    .then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  const res = await network;
  if (res) return res;

  // Offline and not cached: send page navigations to the hub, fail everything else cleanly.
  if (req.mode === 'navigate') {
    const hub = await cache.match(new Request(url.origin + '/'));
    if (hub) return hub;
  }
  return new Response('Offline', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } });
}
