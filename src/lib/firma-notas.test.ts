import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let bd: typeof import("@/db");
let esquema: typeof import("@/db/schema");
let firmas: typeof import("@/lib/user-authors");

before(async () => {
  await prepararBd();
  bd = await import("@/db");
  esquema = await import("@/db/schema");
  firmas = await import("@/lib/user-authors");
});

// Cuentas y fichas de prueba: un administrador, un redactor y una firma ajena (sin cuenta en el panel).
async function escenario() {
  const [admin] = await bd.db.insert(esquema.users).values({ name: "Admin Firma", email: `admin-${Date.now()}@ejemplo.com`, role: "administrador" }).returning({ id: esquema.users.id });
  const [redactor] = await bd.db.insert(esquema.users).values({ name: "Redactor Firma", email: `red-${Date.now()}@ejemplo.com`, role: "redactor" }).returning({ id: esquema.users.id });
  const fichaAdmin = await firmas.autorDeUsuario(admin.id);
  const fichaRedactor = await firmas.autorDeUsuario(redactor.id);
  assert.ok(fichaAdmin && fichaRedactor, "cada cuenta tiene su ficha de autor");
  const ajena = await firmas.crearFirma("Persona Sin Cuenta");
  assert.equal(ajena.ok, true);
  return { admin: { id: admin.id, role: "administrador" }, redactor: { id: redactor.id, role: "redactor" }, fichaAdmin: fichaAdmin!, fichaRedactor: fichaRedactor!, ajena: ajena.ok ? ajena.id : "" };
}

test("un administrador puede firmar por otra persona; el resto conserva su firma aunque pida otra", async () => {
  const e = await escenario();
  // Administrador: la firma que pida (si existe).
  assert.equal(await firmas.firmaDeNota(e.admin, e.ajena, null), e.ajena);
  assert.equal(await firmas.firmaDeNota(e.admin, e.fichaRedactor, null), e.fichaRedactor);
  // Si no pide nada, la suya; si pide una que no existe, la suya (nunca una ficha inventada).
  assert.equal(await firmas.firmaDeNota(e.admin, "", null), e.fichaAdmin);
  assert.equal(await firmas.firmaDeNota(e.admin, "00000000-0000-4000-8000-000000000000", null), e.fichaAdmin);
  assert.equal(await firmas.firmaDeNota(e.admin, "no-es-un-uuid; drop table authors", null), e.fichaAdmin);
  // Redactor: lo que mande el formulario no vale en una nota nueva…
  assert.equal(await firmas.firmaDeNota(e.redactor, e.ajena, null), e.fichaRedactor);
  assert.equal(await firmas.firmaDeNota(e.redactor, e.fichaAdmin, undefined), e.fichaRedactor);
});

test("en una nota que ya existe, quien no es administrador no le cambia la firma; el administrador sí", async () => {
  const e = await escenario();
  const [nota] = await bd.db
    .insert(esquema.articles)
    .values({ slug: `firma-${Date.now()}`, title: "Nota firmada por otra persona", excerpt: "Resumen.", body: "<p>Texto.</p>", authorId: e.ajena, status: "borrador" })
    .returning({ id: esquema.articles.id });
  assert.equal(await firmas.firmaDeNota(e.redactor, e.fichaRedactor, nota.id), e.ajena, "el redactor no puede quitarle la firma a otra persona");
  assert.equal(await firmas.firmaDeNota(e.admin, "", nota.id), e.ajena, "sin pedir nada se conserva la de la nota");
  assert.equal(await firmas.firmaDeNota(e.admin, e.fichaAdmin, nota.id), e.fichaAdmin, "el administrador sí cambia la firma");
  await bd.db.update(esquema.articles).set({ authorId: null }).where(eq(esquema.articles.id, nota.id));
  assert.equal(await firmas.firmaDeNota(e.redactor, "", nota.id), e.fichaRedactor, "una nota sin firma toma la de quien la guarda");
});

test("crear una firma: si el nombre ya existe (sin tildes ni mayúsculas) devuelve esa; el resto se crea con dirección única", async () => {
  const a = await firmas.crearFirma("María Pérez");
  assert.equal(a.ok && a.creada, true);
  const b = await firmas.crearFirma("  maria   PEREZ ");
  assert.equal(b.ok && b.creada, false, "ya existía");
  assert.equal(a.ok && b.ok && a.id === b.id, true);
  const c = await firmas.crearFirma("Maria Perez Gómez");
  assert.equal(c.ok && c.creada, true, "otro nombre, otra firma");
  assert.equal((await firmas.crearFirma("A")).ok, false, "muy corto");
  assert.equal((await firmas.crearFirma("x".repeat(81))).ok, false, "muy largo");
  const fichas = await bd.db.select({ slug: esquema.authors.slug }).from(esquema.authors);
  assert.equal(new Set(fichas.map((f) => f.slug)).size, fichas.length, "las direcciones no se repiten");
});

test("la acción de crear firmas y los guardados usan la regla de firma", async () => {
  const { readFileSync } = await import("node:fs");
  const acciones = readFileSync("src/app/panel/(app)/articulos/actions.ts", "utf8");
  assert.match(acciones, /const authorId = await firmaDeNota\(user, formData\.get\("authorId"\), id \|\| null\)/, "guardar pasa por la regla");
  assert.match(acciones, /borrador\.authorId = await firmaDeNota\(user, borrador\.authorId, borrador\.id\)/, "el autoguardado también");
  const i = acciones.indexOf("export async function crearAutor(");
  assert.ok(i >= 0);
  assert.match(acciones.slice(i), /user\.role !== "administrador"/, "solo un administrador crea firmas");
});
