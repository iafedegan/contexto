import { test } from "node:test";
import assert from "node:assert/strict";
import { envolver, validarSelect } from "./consulta-sql-reglas";

test("acepta un SELECT sobre notas y cifras", () => {
  assert.ok(validarSelect("SELECT title, url FROM notas WHERE search_vec @@ websearch_to_tsquery('spanish','vacunación') ORDER BY published_at DESC LIMIT 5;"));
  assert.ok(validarSelect("WITH x AS (SELECT * FROM cifras WHERE tema='inventario') SELECT serie, valor FROM x ORDER BY valor DESC LIMIT 1"));
  assert.ok(validarSelect("```sql\nSELECT 1 FROM notas\n```"));
});

test("rechaza escritura, varias sentencias, comentarios, esquemas y funciones peligrosas", () => {
  for (const malo of [
    "DELETE FROM notas",
    "SELECT 1; DROP TABLE articles",
    "SELECT * FROM notas -- x",
    "SELECT * FROM notas /* x */",
    "SELECT * FROM public.users",
    "SELECT pg_sleep(10)",
    "SELECT * FROM pg_catalog.pg_user",
    "SELECT * INTO nueva FROM notas",
    "SELECT set_config('a','b',false)",
    "WITH notas AS (SELECT 1) SELECT * FROM notas",
    "SELECT $$x$$",
    "UPDATE notas SET title='x'",
    "",
  ]) assert.equal(validarSelect(malo), null, malo);
});

test("las palabras de escritura dentro de un texto entre comillas no estorban", () => {
  assert.ok(validarSelect("SELECT title FROM notas WHERE title ILIKE '%delete%' OR title ILIKE '%set%'"));
});

test("envolver antepone las fuentes preparadas y limita las filas", () => {
  const a = envolver("SELECT 1 FROM notas");
  assert.match(a, /^SELECT \* FROM \(WITH notas AS .*cifras AS .* SELECT 1 FROM notas\) AS resultado LIMIT 25$/);
  const b = envolver("WITH x AS (SELECT 1) SELECT * FROM x");
  assert.match(b, /cifras AS \(.*\), x AS \(SELECT 1\) SELECT \* FROM x\) AS resultado/);
});
