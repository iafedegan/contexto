import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

/**
 * Base de datos real y en memoria para las pruebas que necesitan SQL de verdad (límites, un solo uso, UPSERT atómico,
 * transacciones): PGlite, el mismo Postgres embebido que usa el desarrollo local, sin servidor ni red.
 *
 * Aplica las migraciones numeradas de `drizzle/` sobre una base vacía, así que de paso comprueba que el esquema se
 * puede crear desde cero. Hay que llamarla ANTES de importar nada que use `@/db`, y siempre con importaciones
 * dinámicas, porque `@/db` lee su configuración al cargarse:
 *
 *   await prepararBd();
 *   const { hit } = await import("@/lib/rate-limit");
 */
export async function prepararBd(): Promise<void> {
  process.env.PGLITE_DATA_DIR = "memory://";
  for (const v of ["DATABASE_URL", "DATABASE_URL_POOLED", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"]) {
    delete process.env[v];
  }
  const { getPglite, schema } = await import("@/db");
  const cliente = getPglite();
  await cliente.waitReady;
  await cliente.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await migrate(drizzle(cliente, { schema }), { migrationsFolder: `${process.cwd()}/drizzle` });
}
