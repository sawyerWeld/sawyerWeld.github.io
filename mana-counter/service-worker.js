const CACHE_NAME = 'mana-counter-v5'
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=5',
  './app.js?v=5',
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
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()

    const windows = await self.clients.matchAll({ type: 'window' })
    await Promise.all(windows.map((client) => client.navigate(client.url)))
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    try {
      const response = await fetch(event.request)
      if (response.ok) cache.put(event.request, response.clone())
      return response
    } catch (_) {
      const cached = await cache.match(event.request, { ignoreSearch: true })
      if (cached) return cached
      if (event.request.mode === 'navigate') return cache.match('./index.html')
      return Response.error()
    }
  })())
})
