const CACHE = 'ergofit-v4';
const CORE = [
  './','./index.html','./manifest.json','./assets/css/styles.css','./assets/js/supabase-config.js','./assets/js/admin-cloud.js','./assets/js/cloud-sync.js','./assets/images/logo.svg',
  './registro/','./registro/index.html','./registro/styles.css','./registro/app.js','./registro/app-cloud.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if(response && response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
