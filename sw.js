/* ============================================================
   sw.js - Archinime OS Service Worker
   Estrategia híbrida con control absoluto sobre catalogo.js
   MEJORADO: Caché más inteligente, actualizaciones en caliente
   ACTUALIZADO: Rutas a la nueva estructura de carpetas
   ============================================================ */

const CACHE_STATIC = 'archinime-static-v91';
const CACHE_DYNAMIC = 'archinime-dynamic-v91';
const CACHE_IMAGES = 'archinime-images-v91';
const CACHE_FONTS = 'archinime-fonts-v91';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pages/anime-detail.html',
  '/pages/video-player.html',
  '/pages/carga.html',
  '/pages/opciones.html',
  '/manifest.json',
  '/assets/img/Logo_Archinime.avif',
  '/assets/img/Logo_Archinime.png',
  '/assets/img/invitado.avif',
  '/assets/img/galaxia-morado1.avif',
  '/assets/gifs/chica_corriendo.gif',
  '/assets/gifs/gokuu.gif',
  '/assets/gifs/naruto.gif'
];

// Instalación
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      console.log('[SW] Precaching recursos estáticos');
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => console.warn('[SW] Error en precache:', err))
  );
});

// Activación
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  const currentCaches = [CACHE_STATIC, CACHE_DYNAMIC, CACHE_IMAGES, CACHE_FONTS];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Eliminando caché obsoleta:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;
  if (request.method !== 'GET') return;

  // Catálogo siempre fresco (nueva ruta)
  if (url.pathname.endsWith('/data/catalogo.js')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_DYNAMIC).then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // HTML -> network-first
  if (request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fuentes, CSS, JS -> stale-while-revalidate
  if (request.destination === 'font' || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Imágenes, vídeos -> stale-while-revalidate
  if (request.destination === 'image' || request.destination === 'video') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // API / Firestore -> solo red
  if (url.origin.includes('firestore') || url.origin.includes('googleapis') || url.pathname.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Resto -> network-first
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_DYNAMIC);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await cache.match(request);
    return cachedResponse || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cacheName = getCacheNameForRequest(request);
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {});

  return cachedResponse || fetchPromise;
}

function getCacheNameForRequest(request) {
  const dest = request.destination;
  if (dest === 'image' || dest === 'video') return CACHE_IMAGES;
  if (dest === 'font') return CACHE_FONTS;
  if (dest === 'style' || dest === 'script') return CACHE_STATIC;
  return CACHE_DYNAMIC;
}

// Push
self.addEventListener('push', event => {
  let data = { title: 'Archinime', body: 'Nueva actualización', icon: '/assets/img/Logo_Archinime.png' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/assets/img/Logo_Archinime.png',
      badge: '/assets/img/Logo_Archinime.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});