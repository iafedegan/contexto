/**
 * Seed para Postgres gestionado (Supabase/Neon). Requiere DATABASE_URL.
 * Para desarrollo local sin infraestructura usa PGlite: `npm run dev` ya lo hace.
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed-data";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

seed(db as never)
  .then((r) => console.log(r.created ? "seed aplicado." : "ya había contenido; sin cambios."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
