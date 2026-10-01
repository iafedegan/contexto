import { type NextRequest, NextResponse } from "next/server";
import { LEGACY_SYSTEM_REDIRECTS, resolveLegacyTaxonomy } from "@/lib/redirects";
import { isBlockedBot } from "@/lib/bots";

/**
 * Middleware de borde.
 *
 * Responsabilidades:
 *  1. Redirecciones 301 de taxonomía legada (mapa estático) + uno-a-uno
 *     (tabla `redirects`, cacheada en memoria vía /api/redirects).
 *  2. Cabeceras de seguridad en todas las respuestas.
 *  3. Puerta de acceso al panel editorial (/panel/*).
 *  4. Anti-scraping: 403 a herramientas de scraping y crawlers de
 *     entrenamiento de IA (src/lib/bots.ts), y 429 a una IP que pide páginas
 *     a un ritmo que ninguna persona alcanza.
 *
 * El archivo histórico (artículos individuales del sistema legado) NUNCA se
 * enruta aquí: vive en su dominio y rutas originales.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/**
 * Ritmo máximo por IP (por instancia; aproximado a propósito). Una persona
 * leyendo no pasa de unas pocas páginas por minuto; 120 deja margen para
 * oficinas que salen a internet por una misma IP. El freno fuerte y global se
 * configura en el Firewall de Vercel (ver README).
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;
const hits = new Map<string, { n: number; reset: number }>();

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

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const clean = pathname.replace(/\/+$/, "") || "/";

  // --- 0. Anti-scraping -------------------------------------------------
  // Los feeds RSS quedan fuera: los lectores RSS usan clientes genéricos.
  // Tampoco las llamadas internas (cron, Inngest, revalidación): van firmadas.
  // La API pública (v1) es justo lo contrario a lo que bloquea esta sección:
  // clientes automatizados de terceros, ya filtrados por su propia clave.
  const internal = /^\/api\/(cron|inngest|revalidate|boletin|v1|openapi\.json)\b/.test(pathname);
  if (!pathname.endsWith("/feed.xml") && !internal) {
    if (isBlockedBot(req.headers.get("user-agent"))) {
      return applyHeaders(new NextResponse("Acceso automatizado no permitido.", { status: 403 }));
    }
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
    // No cuentan: los prefetch y navegaciones internas de Next (cabeceras `rsc` y
    // `next-router-prefetch`; Next quita `?_rsc=` antes de llegar aquí; una
    // sola página visible dispara decenas, y bloquearlos deja a un lector
    // normal en pantalla negra) ni el panel, que ya exige sesión y limita el
    // login por su cuenta. El raspado va por documentos HTML, que sí cuentan.
    const esNavegacionInterna =
      req.headers.has("rsc") ||
      req.headers.has("next-router-prefetch") ||
      req.headers.get("purpose") === "prefetch";
    const esPanel = pathname.startsWith("/panel");
    if (ip && !esNavegacionInterna && !esPanel && tooFast(ip)) {
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_not-found|favicon.ico|robots.txt|sitemap.xml|llms.txt|feed.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)",
  ],
};
