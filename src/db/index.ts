import "server-only";
import postgresClient from "postgres";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Selección de driver:
 *  - Con DATABASE_URL / DATABASE_URL_POOLED -> Postgres gestionado (postgres-js). Producción.
 *  - Sin variable de conexión               -> PGlite (Postgres embebido en `.pglite/`).
 *    Cero infraestructura: `npm run dev` funciona sin instalar nada. Solo dev/demo.
 *
 * Conexión perezosa y singleton (sobrevive al HMR de Next).
 */
type DB = PostgresJsDatabase<typeof schema> & PgliteDatabase<typeof schema>;

// Carpeta de la base embebida: /tmp en Vercel, o la configurada.
export const PGLITE_DIR = process.env.VERCEL
  ? `/tmp/.pglite`
  : process.env.PGLITE_DATA_DIR ?? `${process.cwd()}/.pglite`;

// Instancias compartidas en globalThis, para que la recarga en caliente no abra conexiones nuevas.
const g = globalThis as unknown as {
  __cg_db?: DB;
  __cg_pglite?: import("@electric-sql/pglite").PGlite;
};

/**
 * Cadena de conexión efectiva, en orden de preferencia.
 *
 * Se aceptan también los nombres que inyecta la integración Vercel↔Supabase
 * (`POSTGRES_URL*`), para que conectarla desde el panel de Vercel baste y no
 * haya que copiar credenciales a mano. Se prefiere siempre la variante con
 * pooler: en serverless, cada invocación abriría su propia conexión directa y
 * agotaría el límite de la base.
 *
 * Se descartan las cadenas vacías, no solo las ausentes: una variable definida
 * sin valor es un error de configuración frecuente y, tratada como válida,
 * rompe el arranque con un mensaje incomprensible.
 */
function connectionString(): string | null {
  const candidatas = [
    process.env.DATABASE_URL_POOLED,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  for (const c of candidatas) {
    const v = c?.trim();
    if (v) return v;
  }
  return null;
}

// Indica si se usa la base embebida (no hay cadena de conexión).
export function isEmbeddedDb(): boolean {
  return connectionString() === null;
}

/** Instancia PGlite compartida (también la usa el bootstrap de dev en scripts/). */
export function getPglite() {
  if (!g.__cg_pglite) {
    // require síncrono: el paquete está en serverExternalPackages (no se bundlea).
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    const { vector } = require("@electric-sql/pglite/vector") as typeof import("@electric-sql/pglite/vector");
    /* eslint-enable @typescript-eslint/no-require-imports */
    g.__cg_pglite = new PGlite(PGLITE_DIR, { extensions: { vector } });
  }
  return g.__cg_pglite;
}

// Crea la conexión real: Postgres gestionado si hay cadena, o PGlite embebida.
function init(): DB {
  const url = connectionString();
  if (url) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    const client = postgresClient(url, {
      // Pocas conexiones por instancia: con el pooler en modo transacción de Supabase el cupo total es pequeño, y muchas
      // instancias con 10 conexiones cada una lo agotaban; además una función de Vercel que se congela a mitad de consulta
      // deja la conexión «activa» en el servidor durante minutos y las páginas siguientes se quedan esperando cupo.
      max: 3,
      // El pooler en modo transacción no conserva sentencias preparadas.
      prepare: false,
      connect_timeout: 8,
      // Se devuelven rápido las conexiones ociosas y se renuevan las viejas, para no arrastrar una que quedó muerta.
      idle_timeout: 5,
      max_lifetime: 60,
      // Supabase exige TLS; en local (PGlite o Postgres de desarrollo) no.
      ssl: local ? false : "require",
      onnotice: () => {},
    });
    return drizzlePg(client, { schema }) as unknown as DB;
  }
  return drizzlePglite(getPglite(), { schema }) as unknown as DB;
}

// Base de datos exportada: conecta al primer uso (carga perezosa).
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    g.__cg_db ??= init();
    return Reflect.get(g.__cg_db, prop, g.__cg_db);
  },
});

export { schema };

/**
 * Normaliza el resultado de `db.execute(sql`...`)`: postgres-js devuelve un array
 * de filas; el driver de PGlite devuelve `{ rows }`.
 */
export function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}
