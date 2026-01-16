const CACHE_NAME = 'ehutifight-v1.0.62';
const ASSETS = [
    './',
    './index.html',
    './assets/index.js', // Vite bundles usually
    './assets/index.css'
];

// Install: Cache Files
self.addEventListener('install', (e) => {
    self.skipWaiting(); // Force activate new SW
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // In Vite, we rely more on network-first or stale-while-revalidate, 
            // but let's cache core.
            // return cache.addAll(ASSETS);
            return Promise.resolve();
        })
    );
});

// Activate: Clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim(); // Take control immediately
});

// Fetch: Network First, Fallback to Cache (Safer for Dev)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});
