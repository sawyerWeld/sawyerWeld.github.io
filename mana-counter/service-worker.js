const CACHE_NAME = 'mana-counter-v2'
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  '../paupergenesis2026/survivorship/mana/W.svg',
  '../paupergenesis2026/survivorship/mana/U.svg',
  '../paupergenesis2026/survivorship/mana/B.svg',
  '../paupergenesis2026/survivorship/mana/R.svg',
  '../paupergenesis2026/survivorship/mana/G.svg',
  '../paupergenesis2026/survivorship/mana/C.svg'
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
      return response
    }))
  )
})
