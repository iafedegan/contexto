"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requirePermiso } from "@/lib/auth";
import { hit } from "@/lib/rate-limit";
import { esUuid } from "@/lib/lectores-entrada";
import { vincularDesdePanel } from "@/lib/lectores-suscriptor";
import { EMAIL_RE } from "@/lib/validate";

export type VinculoState = { ok: boolean; mensaje: string } | null;

/**
 * Vincula ESTE navegador con un suscriptor. Es para cuando la propia persona está delante (el editor que se suscribió, o alguien
 * del equipo con su permiso) y confirma que el navegador es suyo y que autoriza que su lectura se relacione con su suscripción.
 * Hace falta que este navegador haya aceptado la medición en el sitio (cookies `cg_med` y `cg_vid`).
 */
export async function vincularEsteNavegador(_: VinculoState, fd: FormData): Promise<VinculoState> {
  const user = await requirePermiso("newsletter");
  if (!(await hit(`vinculo-panel:${user.id}`, 20, 3600)).allowed) return { ok: false, mensaje: "Demasiados intentos; vuelve en un rato." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, mensaje: "Escribe el correo con el que se suscribió." };
  if (fd.get("confirmo") !== "on") return { ok: false, mensaje: "Marca la casilla: la persona debe autorizarlo." };
  const c = await cookies();
  const vid = c.get("cg_vid")?.value;
  if (c.get("cg_med")?.value !== "si" || !esUuid(vid)) {
    return { ok: false, mensaje: "Este navegador no ha aceptado la medición. Abre el sitio público en él, acepta «Medir mi lectura», lee una nota y vuelve." };
  }
  const verificado = email === user.email?.toLowerCase();
  const hecho = await vincularDesdePanel(email, vid.toLowerCase(), verificado);
  if (!hecho) return { ok: false, mensaje: "No hay un suscriptor activo con ese correo." };
  revalidatePath("/panel/analitica");
  return { ok: true, mensaje: "Listo: este navegador quedó vinculado y sus lecturas anteriores ya cuentan." };
}
