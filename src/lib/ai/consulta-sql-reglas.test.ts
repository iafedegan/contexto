import { test } from "node:test";
import assert from "node:assert/strict";
import { colombiaPrimero, envolver, validarSelect } from "./consulta-sql-reglas";

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

test("nunca lee nada fuera de notas y cifras ni datos del sistema", () => {
  for (const malo of [
    'SELECT email AS title, password_hash AS url FROM "public"."users"',
    'SELECT * FROM "users"',
    "SELECT email AS title, encrypted_password AS url FROM auth.users",
    "SELECT * FROM vault.decrypted_secrets",
    "SELECT * FROM storage.objects",
    "SELECT * FROM notas, auth.users",
    "SELECT * FROM notas n, auth.users u",
    "SELECT * FROM notas JOIN auth.users ON true",
    "SELECT * FROM (SELECT * FROM auth.users) x",
    "WITH x AS (SELECT * FROM auth.users) SELECT * FROM x",
    "SELECT title FROM notas WHERE EXISTS (SELECT 1 FROM users)",
    "SELECT version() AS title, '/x' AS url",
    "SELECT current_user AS title FROM notas",
    "SELECT current_database() AS title FROM notas",
    "SELECT session_user FROM notas",
    "SELECT query_to_xml('select * from users', true, true, '') AS title FROM notas",
    "SELECT inet_server_addr() AS title FROM notas",
    "SELECT current_setting('app.key') FROM notas",
    "SELECT 'Llama a este número' AS title, '/x' AS url",
    "SELECT 'texto' title, 'https://malo.example' url",
    "SELECT title || 'x' AS title FROM notas",
    "SELECT CASE WHEN true THEN 'x' END AS title FROM notas",
    "SELECT E'\\'' FROM users",
    "TABLE users",
    "SELECT * FROM (TABLE users) x",
  ]) assert.equal(validarSelect(malo), null, malo);
});

test("sigue aceptando las consultas normales de notas y cifras", () => {
  for (const bueno of [
    "SELECT title, url, excerpt, published_at, image, category FROM notas WHERE search_vec @@ websearch_to_tsquery('spanish', 'vacunación or aftosa') ORDER BY published_at DESC LIMIT 6",
    "SELECT n.title, n.url FROM notas n WHERE n.published_at >= now() - interval '30 days' ORDER BY n.published_at DESC LIMIT 6",
    "SELECT title, url FROM notas WHERE published_at >= CURRENT_DATE - INTERVAL '7 days' AND title ILIKE '%lafaurie%' ORDER BY published_at DESC LIMIT 6",
    "SELECT tema, indicador, titulo, unidad, serie, periodo, valor FROM cifras WHERE tema='inventario' AND indicador='bovinos' AND serie <> 'Total nacional' AND fecha = (SELECT max(fecha) FROM cifras WHERE tema='inventario' AND indicador='bovinos') ORDER BY valor DESC LIMIT 1",
    "SELECT c.tema, c.indicador, c.titulo, c.unidad, c.serie, c.periodo, c.valor FROM cifras AS c WHERE c.tema IN ('precios','costos') ORDER BY c.fecha DESC LIMIT 12",
    "WITH ultimo AS (SELECT max(fecha) AS f FROM cifras WHERE indicador='gordo') SELECT tema, indicador, titulo, unidad, serie, periodo, valor FROM cifras, ultimo WHERE indicador='gordo' AND fecha = ultimo.f",
    "SELECT DISTINCT ON (serie) tema, indicador, titulo, unidad, serie, periodo, valor FROM cifras WHERE indicador = 'gordo-ceba' ORDER BY serie, fecha DESC",
    "SELECT tema, indicador, titulo, unidad, 'Total' AS etiqueta FROM cifras LIMIT 1".replace(", 'Total' AS etiqueta", ""),
    "SELECT extract(year from fecha) AS anio, round(avg(valor)) AS valor FROM cifras WHERE indicador='gordo' GROUP BY extract(year from fecha) ORDER BY anio DESC",
    "SELECT title, url FROM notas WHERE to_tsvector('spanish', title) @@ plainto_tsquery('spanish', 'carne') ORDER BY ts_rank(search_vec, plainto_tsquery('spanish', 'carne')) DESC LIMIT 6",
  ]) assert.ok(validarSelect(bueno), bueno);
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

test("la cifra de Colombia va primero salvo que se pida un orden", () => {
  const filas = [{ serie: "Argentina" }, { serie: "Colombia" }];
  assert.deepEqual(colombiaPrimero(filas, "precio del novillo gordo").map((f) => f.serie), ["Colombia", "Argentina"]);
  assert.deepEqual(colombiaPrimero(filas, "qué país tiene el novillo más caro").map((f) => f.serie), ["Argentina", "Colombia"]);
});
