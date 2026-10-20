import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { superappSesiones } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { consultarSesion } from "./cliente";
import type { ConfigSuperApp } from "./config";
import type { IdentidadSuperApp } from "./contrato";

/** Nombre de la cookie de la sesión local de la SuperApp (HttpOnly, Secure, SameSite=Lax; el valor es un token aleatorio, no una credencial de FEDEGÁN). */
export const COOKIE_SUPERAPP = "cg_sa";

const huella = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Crea la sesión local. El identificador es NUEVO en cada entrada (no se reutiliza ninguno anterior) y la sesión nunca dura más de lo que FEDEGÁN
 * comunicó. Devuelve el token para la cookie y su vencimiento.
 */
export async function crearSesionLocal(i: IdentidadSuperApp): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(superappSesiones).values({
    tokenHash: huella(token),
    audience: i.audience,
    subject: i.subject,
    sessionReference: encryptSecret(i.sessionReference),
    assuranceLevel: i.assuranceLevel,
    capabilities: i.capabilities,
    issuedAt: i.issuedAt,
    expiresAt: i.expiresAt,
    correlationId: i.correlationId,
  });
  return { token, expiresAt: i.expiresAt };
}

export type SesionLocal = { id: string; audience: string; subject: string; assuranceLevel: number; capabilities: string[]; expiresAt: Date; sessionReference: string };

/** Lee la sesión local por el token de la cookie; `null` si no existe, venció o fue revocada. No consulta a FEDEGÁN. */
export async function leerSesionLocal(token: string | undefined | null): Promise<SesionLocal | null> {
  if (!token || token.length < 32 || token.length > 100) return null;
  const [s] = await db
    .select()
    .from(superappSesiones)
    .where(and(eq(superappSesiones.tokenHash, huella(token)), isNull(superappSesiones.revokedAt), gt(superappSesiones.expiresAt, new Date())))
    .limit(1);
  if (!s) return null;
  const ref = decryptSecret(s.sessionReference);
  if (!ref) return null; // la clave de cifrado cambió: la sesión ya no se puede verificar
  return { id: s.id, audience: s.audience, subject: s.subject, assuranceLevel: s.assuranceLevel, capabilities: s.capabilities, expiresAt: s.expiresAt, sessionReference: ref };
}

/** Invalida la sesión local (cierre, cambio de cuenta o revocación en origen). */
export async function revocarSesion(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.update(superappSesiones).set({ revokedAt: new Date() }).where(and(eq(superappSesiones.tokenHash, huella(token)), isNull(superappSesiones.revokedAt)));
}

export type Verificacion = { estado: "vigente"; sesion: SesionLocal } | { estado: "invalida" } | { estado: "sin_verificar" };

/**
 * Comprueba contra FEDEGÁN que la sesión sigue vigente, ANTES de cada operación que requiera el acceso integrado y al reanudar. «invalida» (403, o
 * respuesta que no corresponde a la persona) revoca la sesión local; «sin_verificar» (red, 5xx, tiempo agotado) NO concede acceso ni extiende nada.
 */
export async function verificarVigencia(token: string | undefined | null, cfg: ConfigSuperApp, f?: typeof fetch): Promise<Verificacion> {
  const sesion = await leerSesionLocal(token);
  if (!sesion) return { estado: "invalida" };
  const r = await consultarSesion(sesion.sessionReference, sesion.subject, cfg, f);
  if (r.ok) {
    await db.update(superappSesiones).set({ validatedAt: new Date(), correlationId: r.correlationId }).where(eq(superappSesiones.id, sesion.id));
    return { estado: "vigente", sesion };
  }
  if (r.motivo === "rechazado" || r.motivo === "respuesta") {
    await revocarSesion(token);
    return { estado: "invalida" };
  }
  return { estado: "sin_verificar" };
}

/** Borra las sesiones vencidas o revocadas hace más de un día (mantenimiento diario). */
export async function purgarSesionesSuperApp(): Promise<number> {
  const corte = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const r = await db.delete(superappSesiones).where(or(lt(superappSesiones.expiresAt, corte), and(sql`${superappSesiones.revokedAt} is not null`, lt(superappSesiones.revokedAt, corte)))).returning({ id: superappSesiones.id });
  return r.length;
}
