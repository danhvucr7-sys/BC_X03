// Service Worker tối giản — chỉ cache giao diện tĩnh (app shell) để mở nhanh hơn
// khi thêm vào màn hình chính. KHÔNG cache dữ liệu API (luôn lấy mới từ Supabase).
const CACHE_NAME = 'htbc-x03-shell-v1';
const SHELL_FILES = [
  './index.html', './admin.html', './css/style.css',
  './js/utils.js', './js/supabaseClient.js', './js/report-form.js', './js/admin.js', './js/env.js',
  './manifest.json', './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Không cache request tới Supabase / API — luôn phải là dữ liệu mới nhất
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
