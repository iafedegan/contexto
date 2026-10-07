import { type NextRequest, NextResponse } from "next/server";
import { LEGACY_SYSTEM_REDIRECTS, resolveLegacyTaxonomy } from "@/lib/redirects";
import { isBlockedBot } from "@/lib/bots";

/**
 * Proxy de borde (en Next.js 16 el antiguo «middleware» se llama `proxy.ts`).
 *
 * Responsabilidades:
 *  1. Redirecciones 301 de la taxonomía legada (mapa estático de `src/lib/redirects.ts`, sin tocar la base de datos).
 *     Las redirecciones uno-a-uno (tabla `redirects`) las resuelve la ruta comodín `src/app/(public)/[...path]`, que
 *     solo consulta la base cuando una dirección no existe: ninguna página que sí existe paga esa consulta.
 *  2. Cabeceras de seguridad en todas las respuestas.
 *  3. Puerta de acceso al panel editorial (/panel/*).
 *  4. Anti-abuso, sin depender del User-Agent para nada que importe (H-13): 403 solo a los crawlers de entrenamiento
 *     de IA y a los copiadores de sitios que se declaran como tales (src/lib/bots.ts, lista explícita y documentada;
 *     las auditorías, los monitores y los validadores nunca se bloquean) y 429 a una IP que pide páginas a un ritmo que
 *     ninguna persona alcanza. El freno global y fuerte contra el raspado se configura en el Firewall de Vercel
 *     (docs/seguridad.md); el límite de aquí es por instancia y aproximado a propósito.
 *
 * El archivo histórico (artículos individuales del sistema legado) NUNCA se
 * enruta aquí: vive en su dominio y rutas originales.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/**
 * Ritmo máximo por IP (por instancia; aproximado a propósito). Una persona
 * leyendo no pasa de unas pocas páginas por minuto; 120 deja margen para
 * oficinas que salen a internet por una misma IP. El freno fuerte y global se
 * configura en el Firewall de Vercel (ver README).
 */
const RATE_WINDOW_MS = 60_000;
// Máximo de peticiones por IP y minuto (por instancia, aproximado a propósito).
const RATE_MAX = 120;
// Recursos que el navegador pide junto a cada página y no son páginas: no cuentan para el ritmo por IP.
const RECURSOS_PWA = /^\/(manifest\.webmanifest|icon|apple-icon|opengraph-image|twitter-image|offline)(\/|$)/;
// Contadores de peticiones por IP; se vacían al crecer demasiado.
const hits = new Map<string, { n: number; reset: number }>();

// Indica si una IP pide páginas a un ritmo que ninguna persona alcanza.
function tooFast(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + RATE_WINDOW_MS });
    if (hits.size > 50_000) hits.clear(); // cota de memoria
    return false;
  }
  h.n += 1;
  return h.n > RATE_MAX;
}

// Filtro de todas las peticiones: anti-scraping, redirecciones 301 de la taxonomía antigua, puerta del panel y cabeceras de seguridad.
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const clean = pathname.replace(/\/+$/, "") || "/";

  // --- 0. Anti-scraping -------------------------------------------------
  // Los feeds RSS quedan fuera: los lectores RSS usan clientes genéricos.
  // Tampoco las llamadas internas (cron, Inngest, revalidación): van firmadas.
  // La API pública (v1) es justo lo contrario a lo que bloquea esta sección:
  // clientes automatizados de terceros, ya filtrados por su propia clave.
  const internal = /^\/api\/(cron|inngest|revalidate|boletin|telegram|v1|openapi\.json)\b/.test(pathname);
  if (!pathname.endsWith("/feed.xml") && !internal) {
    if (isBlockedBot(req.headers.get("user-agent"))) {
      return applyHeaders(new NextResponse("Acceso automatizado no permitido.", { status: 403 }));
    }
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
    // No cuentan: los prefetch y navegaciones internas de Next (una sola página
    // visible dispara decenas, y bloquearlos deja a un lector normal en pantalla
    // negra). Next 16 quita `rsc` y `next-router-prefetch` ANTES de llegar al
    // proxy, pero esas peticiones del enrutador del navegador conservan
    // `next-url` y viajan como `fetch` (`sec-fetch-dest: empty`), no como
    // documento; es lo que se mira, además de las cabeceras antiguas. El panel (que ya exige sesión y limita el
    // login por su cuenta), las rutas `/api` (cada una con su propio límite en la
    // base de datos) ni los recursos de la PWA que el navegador pide con cada
    // página (manifiesto e íconos): contarlos hacía que una sola visita gastara
    // cuatro o cinco de las 120 peticiones y que una oficina con varias personas
    // detrás de una IP quedara bloqueada con un uso normal. El raspado va por
    // documentos HTML, que sí cuentan.
    const esNavegacionInterna =
      req.headers.has("next-url") ||
      req.headers.get("sec-fetch-dest") === "empty" ||
      req.headers.has("rsc") ||
      req.headers.has("next-router-prefetch") ||
      req.headers.get("purpose") === "prefetch";
    const esPanel = pathname.startsWith("/panel");
    const esPagina = !pathname.startsWith("/api/") && !RECURSOS_PWA.test(pathname);
    if (ip && esPagina && !esNavegacionInterna && !esPanel && tooFast(ip)) {
      return applyHeaders(
        new NextResponse("Demasiadas peticiones. Espera un momento.", {
          status: 429,
          headers: { "Retry-After": "60" },
        }),
      );
    }
  }

  // --- 1. Redirecciones 301 de taxonomía legada (estáticas, en memoria) ----
  const systemTarget = LEGACY_SYSTEM_REDIRECTS[clean];
  if (systemTarget) {
    return applyHeaders(NextResponse.redirect(new URL(systemTarget, req.url), 301));
  }

  const legacyTarget = resolveLegacyTaxonomy(pathname);
  if (legacyTarget) {
    return applyHeaders(NextResponse.redirect(new URL(legacyTarget + search, req.url), 301));
  }

  // --- 2. Puerta del panel editorial ------------------------------------
  if (pathname.startsWith("/panel")) {
    // Nombres propios del proyecto: ver `SESSION_COOKIE` en src/lib/auth.ts.
    const hasSession =
      req.cookies.has("contexto.session-token") ||
      req.cookies.has("__Secure-contexto.session-token");
    if (!hasSession && pathname !== "/panel/login") {
      const url = new URL("/panel/login", req.url);
      url.searchParams.set("next", pathname);
      return applyHeaders(NextResponse.redirect(url), pathname);
    }
  }

  // La ruta debe viajar en la PETICIÓN (no solo en la respuesta): es lo que
  // lee `headers()` en el layout del panel. Se sobrescribe siempre, así un
  // cliente no puede falsearla enviando su propio `x-pathname`.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return applyHeaders(NextResponse.next({ request: { headers: requestHeaders } }), pathname);
}

/**
 * Además de las cabeceras de seguridad, reenvía la ruta actual: el layout
 * del panel (`src/app/panel/(app)/layout.tsx`, en Node.js) la usa para
 * decidir si forzar el alta del segundo factor sin depender de
 * `usePathname` en cliente.
 */
function applyHeaders(res: NextResponse, pathname?: string): NextResponse {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  if (pathname) res.headers.set("x-pathname", pathname);
  return res;
}

// Rutas a las que se aplica el filtro: todas menos los archivos estáticos.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_not-found|favicon.ico|robots.txt|sitemap.xml|feed.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)",
  ],
};
