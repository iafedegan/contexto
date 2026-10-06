import "server-only";
import { sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";

/**
 * Límite de intentos por clave y ventana, guardado en Postgres para que valga
 * igual en todas las instancias serverless. Un solo UPSERT atómico: si la
 * ventana caducó se reinicia; si no, suma uno.
 *
 * Si la tabla no existe aún (migración 0007 sin aplicar) o la base falla, deja
 * pasar: un fallo del limitador nunca debe bloquear a usuarios legítimos.
 */
export async function hit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  try {
    const res = await db.execute(sql`
      insert into rate_limits (key, count, reset_at)
      values (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
      on conflict (key) do update set
        count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at < now()
          then now() + make_interval(secs => ${windowSeconds}) else rate_limits.reset_at end
      returning count, extract(epoch from (reset_at - now()))::int as retry_after
    `);
    const row = rowsOf<{ count: number; retry_after: number }>(res)[0];
    const count = Number(row?.count ?? 1);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: Number(row?.retry_after ?? 0) };
  } catch {
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

/**
 * Marca una clave como usada: `true` solo la PRIMERA vez dentro de `ttlSeconds`. Sirve para lo que debe valer una sola
 * vez (el token puente de una passkey, un código TOTP ya consumido). Es el mismo UPSERT atómico de `hit`, con tope 1,
 * y por eso hereda su política: si la tabla no existe o la base falla, deja pasar.
 */
export async function usoUnico(key: string, ttlSeconds: number): Promise<boolean> {
  return (await hit(key, 1, ttlSeconds)).allowed;
}

/**
 * Borra los contadores cuya ventana venció hace más de una hora (hallazgo H-25). Sin esto la tabla crecía con cada IP y
 * cada correo que intentaba entrar o suscribirse, y con cada código de un solo uso. Una hora de margen no afecta a
 * nada: un contador vencido se reinicia solo en su próximo uso. Devuelve cuántos borró (0 si la tabla no existe).
 */
export async function purgarLimitesVencidos(): Promise<number> {
  try {
    const res = await db.execute(sql`delete from rate_limits where reset_at < now() - interval '1 hour' returning key`);
    return rowsOf(res).length;
  } catch {
    return 0;
  }
}

/** Borra el contador (p. ej. tras un login correcto). */
export async function clearHits(key: string): Promise<void> {
  try {
    await db.execute(sql`delete from rate_limits where key = ${key}`);
  } catch {
    /* sin tabla: nada que limpiar */
  }
}

/** IP del cliente tras el proxy de Vercel. */
export function clientIp(h: Headers): string {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "0.0.0.0").trim();
}
