import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiClients } from "@/db/schema";

/**
 * Claves de acceso a la API pública (`/api/v1/*`).
 *
 * Formato `cg_live_<40 hex>`, igual de reconocible que las de Stripe o
 * GitHub. Solo se guarda el hash SHA-256: la clave completa se ve una única
 * vez, en el momento de crearla, y no se puede recuperar después.
 */
const PREFIX = "cg_live_";

// Hash SHA-256 en hexadecimal: de la clave solo se guarda esto.
const hash = (key: string) => createHash("sha256").update(key).digest("hex");

// Genera una clave nueva (prefijo + 40 caracteres hex), su hash para guardar y el prefijo visible para reconocerla.
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = PREFIX + randomBytes(20).toString("hex");
  return { key, hash: hash(key), prefix: key.slice(0, 14) };
}

// Datos mínimos del cliente de la API una vez verificada su clave.
export type VerifiedClient = { id: string; name: string; requestsPerHour: number };

/** `null` si la clave no existe, está revocada, o no llega ninguna. */
export async function verifyApiKey(key: string | null): Promise<VerifiedClient | null> {
  if (!key || !key.startsWith(PREFIX)) return null;
  const [row] = await db
    .select({ id: apiClients.id, name: apiClients.name, active: apiClients.active, requestsPerHour: apiClients.requestsPerHour })
    .from(apiClients)
    .where(eq(apiClients.keyHash, hash(key)))
    .limit(1);
  if (!row || !row.active) return null;
  // No bloquea la respuesta: se actualiza en segundo plano.
  db.update(apiClients).set({ lastUsedAt: sql`now()` }).where(eq(apiClients.id, row.id)).catch(() => {});
  return { id: row.id, name: row.name, requestsPerHour: row.requestsPerHour };
}

/** Clave del encabezado `Authorization: Bearer …` o `X-API-Key`. */
export function keyFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key");
}
