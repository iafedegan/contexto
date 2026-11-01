import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let consulta: typeof import("@/lib/ai/consulta-sql");

before(async () => {
  await prepararBd();
  consulta = await import("@/lib/ai/consulta-sql");
});

test("el SQL de la IA lee las notas y las cifras con el rol restringido", async () => {
  assert.deepEqual(await consulta.ejecutarSelect("SELECT title FROM notas"), []);
  assert.deepEqual(await consulta.ejecutarSelect("SELECT serie FROM cifras"), []);
  assert.deepEqual(await consulta.ejecutarSelect("SELECT current_user::text AS quien"), [{ quien: "lector_asistente" }]);
});

// Estas sentencias no pasarían `validarSelect`: se ejecutan directamente para probar que la base las detiene por sí sola.
test("aunque una sentencia pasara la revisión, la base no deja leer nada más", async () => {
  for (const malo of [
    'SELECT email FROM "public"."users"',
    "SELECT password_hash, totp_secret FROM public.users",
    "SELECT value FROM public.site_settings",
    "SELECT body FROM public.articles",
    "SELECT * FROM public.assistant_queries",
  ]) await assert.rejects(consulta.ejecutarSelect(malo), () => true, malo);
});
