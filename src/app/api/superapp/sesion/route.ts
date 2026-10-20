import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { configSuperApp } from "@/lib/superapp/config";
import { COOKIE_SUPERAPP, revocarSesion, verificarVigencia } from "@/lib/superapp/sesion";

/**
 * Estado del acceso integrado de la SuperApp para la interfaz. `GET` consulta a FEDEGÁN (no a la caché) y responde solo si hay acceso vigente y
 * cuándo vence: nunca devuelve identidad, documento, correo ni la referencia de sesión. `DELETE` cierra la sesión LOCAL (no cierra la de FEDEGÁN).
 */
export const dynamic = "force-dynamic";
const SIN_CACHE = { "cache-control": "no-store" };

export async function GET() {
  const cfg = configSuperApp();
  if (!cfg) return NextResponse.json({ habilitada: false, activo: false }, { headers: SIN_CACHE });
  const jar = await cookies();
  const v = await verificarVigencia(jar.get(COOKIE_SUPERAPP)?.value, cfg);
  if (v.estado === "vigente") return NextResponse.json({ habilitada: true, activo: true, expiraEn: v.sesion.expiresAt.toISOString() }, { headers: SIN_CACHE });
  // «sin_verificar»: no se concede el acceso con datos viejos; la interfaz debe informar que no se pudo verificar.
  return NextResponse.json({ habilitada: true, activo: false, sinVerificar: v.estado === "sin_verificar" }, { headers: SIN_CACHE });
}

export async function DELETE(req: Request) {
  // Protección CSRF: solo desde el mismo origen del sitio.
  const origen = req.headers.get("origin");
  if (origen && origen !== new URL(req.url).origin) return NextResponse.json({ ok: false }, { status: 403, headers: SIN_CACHE });
  const jar = await cookies();
  await revocarSesion(jar.get(COOKIE_SUPERAPP)?.value);
  const res = NextResponse.json({ ok: true }, { headers: SIN_CACHE });
  res.cookies.set(COOKIE_SUPERAPP, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
