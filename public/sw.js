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
const SHELL_CACHE = `cg-shell-${VERSION}`;
const PAGES_CACHE = "cg-pages";
const IMAGES_CACHE = "cg-images";
const ASSETS_CACHE = "cg-assets";
// Índice de notas descargadas (títulos) para listarlas en /offline.
const META_CACHE = "cg-meta";
const OFFLINE_INDEX = "/__offline-index";
const OFFLINE_URL = "/offline";

// Límites de espacio: lo más antiguo sale primero.
const MAX_PAGES = 60;
const MAX_IMAGES = 80;
const MAX_ASSETS = 200;

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
  const keep = new Set([SHELL_CACHE, PAGES_CACHE, IMAGES_CACHE, ASSETS_CACHE, META_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
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

async function optimizedImage(request, url) {
  const cache = await caches.open(IMAGES_CACHE);
  const cached = await cache.match(request);
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
    const fallback = original ? await cache.match(new URL(original, self.location.origin).href) : null;
    return fallback ?? Response.error();
  }
}

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

async function syncOffline() {
  if (syncing) return;
  syncing = true;
  try {
    const res = await fetch("/api/offline", { cache: "no-store" });
    if (!res.ok) return;
    const { pages = [], images = [], articles = [] } = await res.json();
    const pagesCache = await caches.open(PAGES_CACHE);
    const imagesCache = await caches.open(IMAGES_CACHE);

    // De a una: descargar sin competir con lo que el lector está viendo.
    for (const path of pages) {
      try {
        const r = await fetch(path, { credentials: "same-origin" });
        if (r.ok) await pagesCache.put(new Request(new URL(path, self.location.origin).href), r);
      } catch {
        /* se reintenta en la próxima sincronización */
      }
    }
    for (const src of images) {
      try {
        const abs = new URL(src, self.location.origin).href;
        if (await imagesCache.match(abs)) continue;
        const sameOrigin = new URL(abs).origin === self.location.origin;
        const r = await fetch(abs, sameOrigin ? {} : { mode: "no-cors" });
        if (r.ok || r.type === "opaque") await imagesCache.put(abs, r);
      } catch {
        /* imagen no disponible: la nota se lee igual */
      }
    }
    await trim(PAGES_CACHE, MAX_PAGES);
    await trim(IMAGES_CACHE, MAX_IMAGES);

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
