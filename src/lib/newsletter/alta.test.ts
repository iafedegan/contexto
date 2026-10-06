import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let alta: typeof import("@/lib/newsletter/alta");
let bd: typeof import("@/db");
let t: typeof import("@/db/schema").newsletterSubscribers;

before(async () => {
  await prepararBd();
  alta = await import("@/lib/newsletter/alta");
  bd = await import("@/db");
  t = (await import("@/db/schema")).newsletterSubscribers;
});

const fila = async (email: string) => (await bd.db.select().from(t).where(eq(t.email, email)))[0];

test("una dirección nueva queda pendiente, con token, y se manda el correo", async () => {
  const r = await alta.solicitarAlta("nueva@example.com", { firstName: "Ana", signupCity: "Bogotá" });
  assert.equal(r.estado, "pendiente");
  assert.ok(r.estado === "pendiente" && r.enviar && r.token.length >= 32);
  const f = await fila("nueva@example.com");
  assert.equal(f.confirmed, false);
  assert.equal(f.firstName, "Ana");
  assert.equal(f.confirmToken, r.estado === "pendiente" ? r.token : null);
});

test("una alta pendiente conserva su token y sus datos: un tercero no puede pisarlos ni invalidar el enlace", async () => {
  const primera = await alta.solicitarAlta("pendiente@example.com", { firstName: "Ana", mobile: null });
  const segunda = await alta.solicitarAlta("pendiente@example.com", { firstName: "Mallory", mobile: "3001112233", signupCity: "Cali" });
  assert.ok(primera.estado === "pendiente" && segunda.estado === "pendiente");
  assert.equal(segunda.estado === "pendiente" && segunda.token, primera.estado === "pendiente" && primera.token, "mismo token: el enlace del correo original sigue valiendo");
  const f = await fila("pendiente@example.com");
  assert.equal(f.firstName, "Ana", "lo que ya estaba no se sobrescribe");
  assert.equal(f.mobile, "3001112233", "lo que estaba vacío sí se completa");
  assert.equal(f.signupCity, "Cali");
});

test("quien ya está confirmado y sin baja no cambia nada", async () => {
  await alta.solicitarAlta("activo@example.com");
  await bd.db.update(t).set({ confirmed: true }).where(eq(t.email, "activo@example.com"));
  const r = await alta.solicitarAlta("activo@example.com", { firstName: "Otro" });
  assert.equal(r.estado, "ya_suscrito");
  assert.equal((await fila("activo@example.com")).firstName, null);
});

test("quien se dio de baja vuelve como alta nueva: token nuevo y a confirmar otra vez", async () => {
  const inicial = await alta.solicitarAlta("baja@example.com");
  await bd.db.update(t).set({ confirmed: true, unsubscribedAt: new Date() }).where(eq(t.email, "baja@example.com"));
  const r = await alta.solicitarAlta("baja@example.com");
  assert.ok(r.estado === "pendiente" && inicial.estado === "pendiente");
  assert.notEqual(r.estado === "pendiente" && r.token, inicial.estado === "pendiente" && inicial.token);
  const f = await fila("baja@example.com");
  assert.equal(f.confirmed, false);
  assert.equal(f.unsubscribedAt, null);
  assert.equal(f.confirmToken, r.estado === "pendiente" ? r.token : null);
});

test("a una misma dirección no se le mandan más de 3 correos por hora", async () => {
  const email = "saturada@example.com";
  const envios: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await alta.solicitarAlta(email);
    envios.push(r.estado === "pendiente" && r.enviar);
  }
  assert.deepEqual(envios, [true, true, true, false, false]);
});

test("las solicitudes simultáneas de la misma dirección no fallan ni duplican", async () => {
  const rs = await Promise.all(Array.from({ length: 4 }, () => alta.solicitarAlta("carrera@example.com", { firstName: "Ana" })));
  assert.ok(rs.every((r) => r.estado === "pendiente"));
  const filas = await bd.db.select().from(t).where(eq(t.email, "carrera@example.com"));
  assert.equal(filas.length, 1);
});
