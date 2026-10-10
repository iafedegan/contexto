import "server-only";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

/**
 * Selección de driver:
 *  - Con DATABASE_URL / DATABASE_URL_POOLED -> Postgres gestionado (node-postgres). Producción.
 *  - Sin variable de conexión               -> PGlite (Postgres embebido en `.pglite/`).
 *    Cero infraestructura: `npm run dev` funciona sin instalar nada. Solo dev/demo.
 *
 * Conexión perezosa y singleton (sobrevive al HMR de Next).
 */
type DB = NodePgDatabase<typeof schema> & PgliteDatabase<typeof schema>;

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
    /**
     * node-postgres y no postgres-js: postgres-js «encadena» varias consultas por la misma conexión sin esperar la respuesta de la
     * anterior, y el pooler de Supabase en modo transacción (Supavisor) pierde respuestas y deja la conexión esperando para siempre
     * (síntoma: sesiones «activas / ClientRead» durante minutos y páginas en blanco). node-postgres manda una consulta por conexión y
     * espera su respuesta, que es lo que el pooler soporta bien. Ver supabase/supavisor#1061 y la guía de Supabase sobre postgres.js.
     */
    const pool = new Pool({
      connectionString: url,
      // Pocas conexiones por instancia: el cupo del pooler del plan gratuito es pequeño.
      max: 5,
      // Se devuelven rápido las ociosas (una función de Vercel puede congelarse entre peticiones y dejarlas muertas).
      idleTimeoutMillis: 5_000,
      // Nada espera «para siempre»: si no hay conexión o la consulta no responde, falla y la página sigue.
      connectionTimeoutMillis: 8_000,
      query_timeout: 25_000,
      keepAlive: true,
      // Supabase exige TLS; en local (PGlite o Postgres de desarrollo) no. Su certificado del pooler no está en el almacén de Node.
      ssl: local ? false : { rejectUnauthorized: false },
    });
    pool.on("error", () => {});
    // En Vercel, avisa a la plataforma para cerrar las conexiones ociosas antes de congelar la función.
    if (process.env.VERCEL) attachDatabasePool(pool);
    const client = pool;
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
