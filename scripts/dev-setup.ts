/**
 * Bootstrap de la base de datos embebida (PGlite) para desarrollo local.
 * Se ejecuta antes de `npm run dev` (script `predev`). Idempotente y rápido si
 * ya está listo.
 *
 * Si defines DATABASE_URL en .env.local, este script no hace nada: usa el flujo
 * `npm run db:setup` contra tu Postgres gestionado.
 */
import "dotenv/config";
import { existsSync, rmSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed-data";

const DIR = process.env.PGLITE_DATA_DIR ?? `${process.cwd()}/.pglite`;

async function main() {
  if (process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED) {
    console.log("DATABASE_URL definido -> se omite PGlite. Usa `npm run db:setup`.");
    return;
  }

  const firstRun = !existsSync(DIR);

  // La persistencia de PGlite no tolera bien que otro proceso (p. ej. `next build`)
  // abra el mismo directorio. Para una demo local determinista, se recrea la BD
  // en cada arranque salvo que se pida conservarla (KEEP_LOCAL_DB=1).
  let client: InstanceType<typeof PGlite>;
  try {
    client = new PGlite(DIR, { extensions: { vector } });
    await client.waitReady;
  } catch {
    console.warn("PGlite: base local ilegible, se recrea.");
    rmSync(DIR, { recursive: true, force: true });
    client = new PGlite(DIR, { extensions: { vector } });
    await client.waitReady;
  }

  if (!firstRun && process.env.KEEP_LOCAL_DB !== "1") {
    await client.close();
    rmSync(DIR, { recursive: true, force: true });
    client = new PGlite(DIR, { extensions: { vector } });
    await client.waitReady;
  }

  await client.exec("CREATE EXTENSION IF NOT EXISTS vector;");

  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: `${process.cwd()}/drizzle` });

  // Índices que no vienen en las migraciones generadas.
  await client.exec(`
    CREATE INDEX IF NOT EXISTS articles_fts_es
      ON articles USING gin (to_tsvector('spanish', title || ' ' || excerpt || ' ' || body));
    CREATE INDEX IF NOT EXISTS archive_fts_es
      ON archive_index USING gin (to_tsvector('spanish', title || ' ' || summary));
  `);

  const { created } = await seed(db as never);
  await client.close();

  console.log(
    firstRun
      ? `PGlite creado en ${DIR}. Datos de ejemplo: ${created ? "sí" : "ya existían"}.`
      : `PGlite listo (${DIR}). Seed: ${created ? "aplicado" : "sin cambios"}.`,
  );
  console.log("Login del panel:  editor@contextoganadero.com  /  contexto2026");
}

main().catch((e) => {
  console.error("dev-setup falló:", e);
  process.exit(1);
});
