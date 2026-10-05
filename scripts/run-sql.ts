/**
 * Ejecuta un archivo .sql suelto contra DATABASE_URL.
 * Uso: npx tsx scripts/run-sql.ts drizzle/manual/00_pre_extensions.sql
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import postgres from "postgres";

// Archivo SQL a ejecutar.
const file = process.argv[2];
if (!file) {
  console.error("Falta la ruta del archivo .sql");
  process.exit(1);
}

// Conexión a la base de datos.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

// Cliente de una sola conexión.
const sql = postgres(url, { max: 1 });

try {
  const content = readFileSync(file, "utf8");
  await sql.unsafe(content);
  console.log(`OK: ${file}`);
} catch (e) {
  console.error(`Error en ${file}:`, e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
