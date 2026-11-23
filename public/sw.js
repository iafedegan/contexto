// Service Worker — CONtexto Ganadero
// Lectura sin conexión del portal público. No cachea /panel (editorial),
// /api/assistant (IA) ni mutaciones: solo contenido de solo lectura.
//
// La versión llega en la URL de registro (/sw.js?v=<build>): cada despliegue
// cambia la URL, el navegador instala el SW nuevo y se renueva el shell.
// Páginas, imágenes y estáticos NO llevan versión: así lo descargado para
// leer sin conexión sobrevive a los despliegues (los estáticos de Next llevan
// hash en el nombre, así que nunca quedan desactualizados).

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
// Caché de la estructura mínima de la aplicación, con la versión del despliegue.
const SHELL_CACHE = `cg-shell-${VERSION}`;
// Caché de páginas visitadas.
const PAGES_CACHE = "cg-pages";
// Caché de imágenes.
const IMAGES_CACHE = "cg-images";
// Fotos de las notas descargadas para leer sin conexión. Va aparte de IMAGES_CACHE para que navegar no las expulse: antes
// compartían caché, cada visita las sacaba por el límite de 80 y la siguiente sincronización volvía a bajarlas.
const OFFLINE_IMAGES_CACHE = "cg-offline-images";
// Caché de archivos estáticos de la compilación.
const ASSETS_CACHE = "cg-assets";
// Índice de notas descargadas (títulos) para listarlas en /offline.
const META_CACHE = "cg-meta";
// Dirección interna del índice de notas descargadas.
const OFFLINE_INDEX = "/__offline-index";
// Página que se muestra sin conexión.
const OFFLINE_URL = "/offline";

// Límites de espacio: lo más antiguo sale primero.
const MAX_PAGES = 60;
// Máximo de imágenes guardadas.
const MAX_IMAGES = 80;
// Máximo de archivos estáticos guardados.
const MAX_ASSETS = 200;

// Archivos que se guardan al instalar el Service Worker.
const APP_SHELL = [OFFLINE_URL, "/manifest.webmanifest"];

// Rutas que nunca deben servirse desde caché (editorial/autenticado/IA/streams).
const NEVER_CACHE_PREFIXES = [
  "/panel",
  "/vista-previa",
  "/vista-portada",
  "/api/assistant",
  "/api/auth",
  "/api/revalidate",
  "/api/cron",
  "/api/vista",
  "/api/offline",
];

// Indica si una ruta no debe guardarse nunca en caché.
function isNeverCache(pathname) {
  return NEVER_CACHE_PREFIXES.some((p) => pathname.startsWith(p));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, PAGES_CACHE, IMAGES_CACHE, OFFLINE_IMAGES_CACHE, ASSETS_CACHE, META_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(borrarOriginalesAjenos)
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCache(url.pathname)) return;

  // Navegaciones (HTML): red primero, con caché de página y fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Fotos optimizadas por Next (/_next/image?url=…): caché primero. Sin red y
  // sin esa medida exacta, se sirve la original descargada para leer offline.
  if (url.pathname === "/_next/image") {
    event.respondWith(optimizedImage(request, url));
    return;
  }

  // Estáticos de build (_next/static, íconos, manifest): stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/api/pwa-icon")
  ) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE, MAX_ASSETS));
    return;
  }

  // Imágenes propias servidas tal cual (/fotos, /uploads…).
  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGES_CACHE, MAX_IMAGES));
  }
});

// Las versiones anteriores guardaban el original de Supabase de cada portada (2-3 MB, opaco): se liberan.
async function borrarOriginalesAjenos() {
  try {
    const cache = await caches.open(IMAGES_CACHE);
    for (const req of await cache.keys()) {
      if (new URL(req.url).origin !== self.location.origin) await cache.delete(req);
    }
  } catch {
    /* sin caché: nada que borrar */
  }
}

// Navegación: primero la red; si falla, la copia guardada o la página sin conexión.
async function networkFirstNavigation(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      await cache.put(request, fresh.clone());
      trim(PAGES_CACHE, MAX_PAGES);
    }
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    return (await shell.match(OFFLINE_URL)) ?? Response.error();
  }
}

// Imagen optimizada: primero la caché (la de navegación o la descargada para leer sin conexión); si no está, la red; sin
// red, la misma foto en otro ancho de los ya guardados.
async function optimizedImage(request, url) {
  const cache = await caches.open(IMAGES_CACHE);
  const offline = await caches.open(OFFLINE_IMAGES_CACHE);
  const cached = (await cache.match(request)) ?? (await offline.match(request, { ignoreVary: true }));
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      await cache.put(request, fresh.clone());
      trim(IMAGES_CACHE, MAX_IMAGES);
    }
    return fresh;
  } catch {
    const original = url.searchParams.get("url");
    const fallback = original ? (await mismaFoto(offline, original)) ?? (await mismaFoto(cache, original)) : null;
    return fallback ?? Response.error();
  }
}

// Busca en una caché la misma foto (mismo parámetro `url` de /_next/image) en cualquier ancho.
async function mismaFoto(cache, original) {
  for (const req of await cache.keys()) {
    const u = new URL(req.url);
    // ignoreVary: /_next/image responde con `Vary: Accept` y la petición guardada no lleva el Accept del navegador.
    if (u.pathname === "/_next/image" && u.searchParams.get("url") === original) return cache.match(req, { ignoreVary: true });
  }
  return null;
}

// Responde con lo guardado y lo actualiza en segundo plano.
async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
        if (max) trim(cacheName, max);
      }
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await fetchPromise) ?? Response.error();
}

/** Borra las entradas más antiguas (orden de inserción) por encima de `max`. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/* ---------------------------------------------------------- Lectura offline
   La página pide {type: "sync-offline"} cuando hay buena conexión (wifi o
   desconocida, sin ahorro de datos). Se descargan la portada y las últimas
   notas con su foto, para leerlas luego sin señal (p. ej. en la finca).
   ---------------------------------------------------------------------- */
let syncing = false;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "sync-offline") event.waitUntil(syncOffline());
});

// Descarga las páginas e imágenes de las últimas notas para leer sin conexión.
async function syncOffline() {
  if (syncing) return;
  syncing = true;
  try {
    const res = await fetch("/api/offline", { cache: "no-store" });
    if (!res.ok) return;
    const { pages = [], images = [], articles = [] } = await res.json();
    const pagesCache = await caches.open(PAGES_CACHE);
    const imagesCache = await caches.open(OFFLINE_IMAGES_CACHE);

    // De a una: descargar sin competir con lo que el lector está viendo.
    for (const path of pages) {
      try {
        const r = await fetch(path, { credentials: "same-origin" });
        if (r.ok) await pagesCache.put(new Request(new URL(path, self.location.origin).href), r);
      } catch {
        /* se reintenta en la próxima sincronización */
      }
    }
    // Solo fotos del propio sitio (/_next/image): nunca el original de otro dominio (Supabase cobra cada descarga), y
    // cada foto se baja una sola vez por teléfono.
    const vigentes = new Set();
    for (const src of images) {
      try {
        const abs = new URL(src, self.location.origin).href;
        if (new URL(abs).origin !== self.location.origin) continue;
        vigentes.add(abs);
        if (await imagesCache.match(abs, { ignoreVary: true })) continue;
        // Con `Accept` de imagen el optimizador entrega WebP (~65 KB); sin él, PNG (más del doble).
        const r = await fetch(abs, { headers: { Accept: "image/webp,image/*,*/*;q=0.8" } });
        if (r.ok) await imagesCache.put(abs, r);
      } catch {
        /* imagen no disponible: la nota se lee igual */
      }
    }
    // Quedan solo las fotos de las notas vigentes (si la lista llegó vacía, se conserva lo que había).
    if (vigentes.size > 0) {
      for (const req of await imagesCache.keys()) {
        if (!vigentes.has(req.url)) await imagesCache.delete(req);
      }
    }
    await trim(PAGES_CACHE, MAX_PAGES);

    const meta = await caches.open(META_CACHE);
    await meta.put(
      OFFLINE_INDEX,
      new Response(JSON.stringify({ savedAt: Date.now(), articles }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } finally {
    syncing = false;
  }
}

/* ------------------------------------------------------------------ Push
   Notificaciones de última hora (FM-01). El payload lo construye el servidor
   en src/lib/push.ts; aquí solo se pinta y se gestiona el clic.
   ---------------------------------------------------------------------- */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let datos = {};
  try {
    datos = event.data.json();
  } catch {
    datos = { title: "CONtexto Ganadero", body: event.data.text() };
  }
  const opciones = {
    body: datos.body || "",
    icon: datos.icon || "/api/pwa-icon?size=192",
    badge: datos.badge || "/api/pwa-icon?size=96",
    tag: datos.tag || "cg-noticia",
    renotify: true,
    timestamp: Date.now(),
    vibrate: [120, 60, 120],
    lang: "es-CO",
    data: { url: datos.url || "/" },
  };
  // Foto de la nota: Android y escritorio la muestran grande; donde no se admite, se ignora.
  if (datos.image) opciones.image = datos.image;
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(datos.title || "CONtexto Ganadero", opciones),
      // Marca en el ícono de la app instalada (donde el sistema lo permite); la página la limpia al abrirse.
      self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : undefined,
    ]),
  );
});

// El navegador a veces renueva o invalida la suscripción por su cuenta: se vuelve a registrar sin que el lector haga nada.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const opciones = (event.oldSubscription && event.oldSubscription.options) || { userVisibleOnly: true };
        const nueva = event.newSubscription || (await self.registration.pushManager.subscribe(opciones));
        await fetch("/api/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nueva.toJSON()),
        });
      } catch {
        /* se reintenta la próxima vez que el lector abra la app */
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (self.navigator && self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(() => {});
  const destino = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      // Si ya hay una pestaña del portal abierta, se reutiliza en vez de
      // abrir una nueva cada vez que llega un aviso.
      for (const v of ventanas) {
        if (v.url.includes(self.location.origin) && "focus" in v) {
          v.navigate(destino);
          return v.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
