import { type NextRequest, NextResponse } from "next/server";
import { LEGACY_SYSTEM_REDIRECTS, resolveLegacyTaxonomy } from "@/lib/redirects";

/**
 * Middleware de borde. Sin acceso a base de datos (los 301 uno-a-uno de la tabla
 * `redirects` se resuelven en la página not-found).
 *
 * Responsabilidades:
 *  1. Redirecciones 301 de taxonomía legada.
 *  2. Cabeceras de seguridad en todas las respuestas.
 *  3. Puerta de acceso al panel editorial (/panel/*) — comprobación de cookie de
 *     sesión; la verificación real de rol ocurre en cada Server Action / layout.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // --- 1. Redirecciones 301 -------------------------------------------------
  const systemTarget = LEGACY_SYSTEM_REDIRECTS[pathname.replace(/\/+$/, "")];
  if (systemTarget) {
    return applyHeaders(NextResponse.redirect(new URL(systemTarget, req.url), 301));
  }

  const legacyTarget = resolveLegacyTaxonomy(pathname);
  if (legacyTarget) {
    return applyHeaders(NextResponse.redirect(new URL(legacyTarget + search, req.url), 301));
  }

  // --- 2. Puerta del panel editorial -------------------------------------
  if (pathname.startsWith("/panel")) {
    const hasSession =
      req.cookies.has("authjs.session-token") ||
      req.cookies.has("__Secure-authjs.session-token");
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
  // Excluye assets estáticos y las rutas de infraestructura de crawling.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|feed.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)",
  ],
};
