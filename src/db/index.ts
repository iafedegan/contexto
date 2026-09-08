import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexión perezosa: el cliente no se crea hasta la primera consulta. Así el
 * build (SSG) no exige DATABASE_URL y las páginas que capturan el error de DB
 * pueden pre-renderizarse igualmente.
 */
let _db: PostgresJsDatabase<typeof schema> | null = null;

function init(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL (o DATABASE_URL_POOLED) en el entorno.");
  }
  const client = postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    prepare: false,
  });
  return drizzle(client, { schema });
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    _db ??= init();
    return Reflect.get(_db, prop, _db);
  },
});

export { schema };
