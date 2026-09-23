import { type NextRequest, NextResponse } from "next/server";
import { LEGACY_SYSTEM_REDIRECTS, resolveLegacyTaxonomy } from "@/lib/redirects";

/**
 * Middleware de borde.
 *
 * Responsabilidades:
 *  1. Redirecciones 301 de taxonomía legada (mapa estático) + uno-a-uno
 *     (tabla `redirects`, cacheada en memoria vía /api/redirects).
 *  2. Cabeceras de seguridad en todas las respuestas.
 *  3. Puerta de acceso al panel editorial (/panel/*).
 *
 * El archivo histórico (artículos individuales del sistema legado) NUNCA se
 * enruta aquí: vive en su dominio y rutas originales.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

// Cache en memoria del mapa de redirecciones uno-a-uno.
let redirectCache: { at: number; map: Map<string, { to: string; code: number }> } = {
  at: 0,
  map: new Map(),
};
const REDIRECT_TTL_MS = 5 * 60 * 1000;

async function getRedirectMap(origin: string) {
  if (Date.now() - redirectCache.at < REDIRECT_TTL_MS && redirectCache.map.size >= 0 && redirectCache.at > 0) {
    return redirectCache.map;
  }
  try {
    const res = await fetch(`${origin}/api/redirects`, { cache: "no-store" });
    const { map } = (await res.json()) as { map: Array<{ from: string; to: string; code: number }> };
    redirectCache = {
      at: Date.now(),
      map: new Map(map.map((r) => [r.from, { to: r.to, code: r.code }])),
    };
  } catch {
    redirectCache.at = Date.now(); // no reintentar en bucle
  }
  return redirectCache.map;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const clean = pathname.replace(/\/+$/, "") || "/";

  // --- 1. Redirecciones 301 ------------------------------------------------
  const systemTarget = LEGACY_SYSTEM_REDIRECTS[clean];
  if (systemTarget) {
    return applyHeaders(NextResponse.redirect(new URL(systemTarget, req.url), 301));
  }

  const legacyTarget = resolveLegacyTaxonomy(pathname);
  if (legacyTarget) {
    return applyHeaders(NextResponse.redirect(new URL(legacyTarget + search, req.url), 301));
  }

  if (!pathname.startsWith("/panel") && !pathname.startsWith("/api")) {
    const map = await getRedirectMap(req.nextUrl.origin);
    const hit = map.get(clean) ?? map.get(pathname);
    if (hit) {
      return applyHeaders(
        NextResponse.redirect(new URL(hit.to, req.url), hit.code === 302 ? 302 : 301),
      );
    }
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
      return applyHeaders(NextResponse.redirect(url));
    }
  }

  return applyHeaders(NextResponse.next());
}

function applyHeaders(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|feed.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)",
  ],
};
