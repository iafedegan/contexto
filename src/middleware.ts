import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Reenvía la ruta actual como cabecera para que el layout del panel
 * (`src/app/panel/(app)/layout.tsx`, en Node.js, con acceso a la base de
 * datos) pueda decidir si forzar el alta del segundo factor (2FA
 * obligatorio) sin depender de `usePathname` en cliente.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("x-pathname", req.nextUrl.pathname);
  return res;
}

export const config = { matcher: ["/panel/:path*"] };
