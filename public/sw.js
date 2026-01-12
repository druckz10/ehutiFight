const CACHE_NAME = 'ehutifight-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/src/main.js',
    '/src/style.css',
    '/src/scenes/BootScene.js',
    '/src/scenes/MenuScene.js',
    '/src/scenes/SelectionScene.js',
    '/src/scenes/FightScene.js',
    '/src/scenes/ModeSelectionScene.js',
    '/src/objects/Fighter.js',
    '/src/services/NetworkManager.js',
    '/src/config/FighterStats.js'
    // Add other assets dynamically or let the fetch handler catch them
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
