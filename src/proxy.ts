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

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const clean = pathname.replace(/\/+$/, "") || "/";

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
    "/((?!_next/static|_next/image|_not-found|favicon.ico|robots.txt|sitemap.xml|llms.txt|feed.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)",
  ],
};
