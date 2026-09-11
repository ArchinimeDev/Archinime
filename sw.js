/* ============================================================
   sw.js - Archinime OS Service Worker
   🔑 ÚNICO ARCHIVO A EDITAR cuando quieras forzar actualización.
   
   CÓMO USARLO:
   - Cambia SOLO la constante SW_VERSION de abajo (ej: 'v107' → 'v108')
   - Al subir el archivo, TODOS los usuarios recibirán la versión nueva
     automáticamente (el SW borra cachés viejas y recarga la página).
   - Los cambios normales en HTML/CSS/JS se ven al instante porque esos
     archivos van a la red con cache:'no-store'.
   ============================================================ */

// ⬇️⬇️⬇️ SOLO ESTA LÍNEA SE CAMBIA ⬇️⬇️⬇️
const SW_VERSION = 'v108';
// ⬆️⬆️⬆️ Súbela cuando quieras forzar actualización masiva ⬆️⬆️⬆️

const CACHE_STATIC  = `archinime-static-${SW_VERSION}`;
const CACHE_DYNAMIC = `archinime-dynamic-${SW_VERSION}`;
const CACHE_IMAGES  = `archinime-images-${SW_VERSION}`;
const CACHE_FONTS   = `archinime-fonts-${SW_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/img/Logo_Archinime.avif',
  '/assets/img/Logo_Archinime.png',
  '/assets/img/invitado.avif',
  '/assets/img/galaxia-morado1.avif',
  '/assets/gifs/chica_corriendo.gif',
  '/assets/gifs/gokuu.gif',
  '/assets/gifs/naruto.gif'
];

// ============================================
// INSTALL
// ============================================
self.addEventListener('install', event => {
  console.log(`[SW] Instalando ${SW_VERSION}...`);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      console.log('[SW] Precaching recursos estáticos');
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => console.warn('[SW] Error en precache:', err))
  );
});

// ============================================
// ACTIVATE — borra TODAS las cachés viejas
// ============================================
self.addEventListener('activate', event => {
  console.log(`[SW] Activando ${SW_VERSION}...`);
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
    }).then(() => self.clients.claim())
  );
});

// ============================================
// FETCH
// ============================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;
  if (request.method !== 'GET') return;

  // Catálogo siempre fresco
  if (url.pathname.endsWith('/data/catalogo.js')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 🔑 HTML, JS, CSS → SIEMPRE RED, sin caché
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/'
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Imágenes, vídeos y fuentes → stale-while-revalidate
  if (
    request.destination === 'image' ||
    request.destination === 'video' ||
    request.destination === 'font'
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Firestore / APIs externas → solo red
  if (
    url.origin.includes('firestore') ||
    url.origin.includes('googleapis') ||
    url.pathname.includes('/api/')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Cualquier otra cosa → network-first
  event.respondWith(networkFirst(request));
});

// ============================================
// ESTRATEGIAS
// ============================================
async function networkFirst(request) {
  const cache = await caches.open(CACHE_DYNAMIC);
  try {
    const res = await fetch(request);
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cacheName =
    request.destination === 'image' || request.destination === 'video' ? CACHE_IMAGES :
    request.destination === 'font' ? CACHE_FONTS :
    CACHE_DYNAMIC;

  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(res => {
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  }).catch(() => {});

  return cached || fetchPromise;
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', event => {
  let data = {
    title: 'Archinime',
    body: 'Nueva actualización',
    icon: '/assets/img/Logo_Archinime.png'
  };
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
