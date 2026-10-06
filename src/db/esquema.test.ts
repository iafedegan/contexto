import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { is, sql } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");

before(async () => {
  // Base vacía + SOLO las migraciones numeradas: lo que no esté en ellas, no existe.
  await prepararBd();
  bd = await import("@/db");
});

// Todas las tablas declaradas en schema.ts.
const tablas = async () => Object.values(await import("@/db/schema")).filter((v) => is(v, PgTable)) as unknown as PgTable[];

test("cada tabla, columna e índice de schema.ts existe en una base creada solo con las migraciones (H-25)", async () => {
  const columnasBd = bd.rowsOf<{ t: string; c: string }>(await bd.db.execute(sql`select table_name as t, column_name as c from information_schema.columns where table_schema = 'public'`));
  const indicesBd = new Set(bd.rowsOf<{ n: string }>(await bd.db.execute(sql`select indexname as n from pg_indexes where schemaname = 'public'`)).map((r) => r.n));
  const problemas: string[] = [];
  for (const tabla of await tablas()) {
    const cfg = getTableConfig(tabla);
    const enBd = new Set(columnasBd.filter((r) => r.t === cfg.name).map((r) => r.c));
    if (!enBd.size) problemas.push(`falta la tabla ${cfg.name}`);
    for (const col of cfg.columns) if (enBd.size && !enBd.has(col.name)) problemas.push(`falta la columna ${cfg.name}.${col.name}`);
    for (const c of enBd) if (!cfg.columns.some((col) => col.name === c)) problemas.push(`sobra la columna ${cfg.name}.${c} (está en la base y no en schema.ts)`);
    for (const idx of cfg.indexes) if (idx.config.name && !indicesBd.has(idx.config.name)) problemas.push(`falta el índice ${idx.config.name}`);
  }
  assert.deepEqual(problemas, [], `schema.ts y las migraciones se separaron: genera la migración con \`npm run db:generate\` y hazla idempotente.\n${problemas.join("\n")}`);
});

test("drizzle/manual solo guarda extensiones e índices: las tablas y columnas van en migraciones numeradas", () => {
  for (const archivo of readdirSync("drizzle/manual")) {
    const sqlTexto = readFileSync(`drizzle/manual/${archivo}`, "utf8").replace(/--[^\n]*/g, "");
    assert.ok(!/create\s+table|alter\s+table|add\s+column|drop\s+column/i.test(sqlTexto), `${archivo} define tablas o columnas: llévalo a una migración numerada`);
  }
});

test("las migraciones numeradas del journal coinciden con los archivos .sql", () => {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  const archivos = readdirSync("drizzle").filter((f) => /^\d{4}_.*\.sql$/.test(f)).map((f) => f.replace(/\.sql$/, "")).sort();
  assert.deepEqual(journal.entries.map((e) => e.tag).sort(), archivos);
});

test("las migraciones que llegan a producción a mano son idempotentes desde la 0010", () => {
  // Producción no usa el journal de drizzle: estas migraciones se pegan en el SQL Editor y pueden correr dos veces.
  for (const archivo of readdirSync("drizzle").filter((f) => /^00(1\d|[2-9]\d)_.*\.sql$/.test(f))) {
    const texto = readFileSync(`drizzle/${archivo}`, "utf8").replace(/--[^\n]*/g, "");
    const sentencias = texto.split("--> statement-breakpoint").map((x) => x.trim()).filter(Boolean);
    for (const s of sentencias) {
      if (/^create\s+table/i.test(s)) assert.match(s, /if not exists/i, `${archivo}: CREATE TABLE sin IF NOT EXISTS`);
      if (/^create\s+(unique\s+)?index/i.test(s)) assert.match(s, /if not exists/i, `${archivo}: CREATE INDEX sin IF NOT EXISTS`);
      if (/add\s+column/i.test(s)) assert.match(s, /if not exists/i, `${archivo}: ADD COLUMN sin IF NOT EXISTS`);
      if (/drop\s+column/i.test(s)) assert.match(s, /if exists/i, `${archivo}: DROP COLUMN sin IF EXISTS`);
    }
  }
});
