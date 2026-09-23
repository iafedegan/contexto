// Service Worker — CONtexto Ganadero
// Offline shell + caché de lectura para el portal público. No cachea /panel
// (editorial), /api/assistant (IA) ni mutaciones: solo contenido de solo lectura.

const VERSION = "v1";
const SHELL_CACHE = `cg-shell-${VERSION}`;
const PAGES_CACHE = `cg-pages-${VERSION}`;
const ASSETS_CACHE = `cg-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

const APP_SHELL = [OFFLINE_URL, "/manifest.webmanifest"];

// Rutas que nunca deben servirse desde caché (editorial/autenticado/IA/streams).
const NEVER_CACHE_PREFIXES = ["/panel", "/api/assistant", "/api/auth", "/api/revalidate", "/api/cron"];

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
  const keep = new Set([SHELL_CACHE, PAGES_CACHE, ASSETS_CACHE]);
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

  // Estáticos de build (_next/static, íconos, manifest): stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/api/pwa-icon")
  ) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
    return;
  }
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    return (await shell.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await fetchPromise) ?? Response.error();
}
