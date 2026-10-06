import test, { before } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { prepararBd } from "@/test-utils/bd-memoria";

let ret: typeof import("@/lib/newsletter/retencion");
let bd: typeof import("@/db");
let t: typeof import("@/db/schema").newsletterSubscribers;

before(async () => {
  await prepararBd();
  ret = await import("@/lib/newsletter/retencion");
  bd = await import("@/db");
  t = (await import("@/db/schema")).newsletterSubscribers;
});

const dias = (n: number) => new Date(Date.now() - n * 24 * 3600_000);
const fila = async (email: string) => (await bd.db.select().from(t).where(eq(t.email, email)))[0];
const completo = { firstName: "Ana", lastName: "Pérez", mobile: "3001112233", birthDate: "1990-05-01", signupIp: "203.0.113.7", signupCity: "Medellín", signupCountry: "CO", signupPostal: "050001", neighborhood: "El Poblado", signupLat: "6.2100", signupLon: "-75.5700", signupGeoSource: "gps", signupGeoAccuracy: "12", confirmToken: "token-de-prueba-0123456789" };

test("al confirmar, la IP del alta se borra; el resto de los datos se conserva", async () => {
  await bd.db.insert(t).values({ email: "confirmada@example.com", confirmed: true, ...completo });
  const r = await ret.aplicarRetencion();
  assert.ok(r.ipsBorradas >= 1);
  const f = await fila("confirmada@example.com");
  assert.equal(f.signupIp, null);
  assert.equal(f.firstName, "Ana");
  assert.equal(f.signupCity, "Medellín");
});

test("una alta sin confirmar se elimina a los 30 días, no antes", async () => {
  await bd.db.insert(t).values([
    { email: "vieja@example.com", confirmed: false, createdAt: dias(31), ...completo },
    { email: "reciente@example.com", confirmed: false, createdAt: dias(5), ...completo },
  ]);
  await ret.aplicarRetencion();
  assert.equal(await fila("vieja@example.com"), undefined);
  assert.equal((await fila("reciente@example.com")).signupIp, "203.0.113.7", "la reciente sigue como estaba, IP incluida: aún no ha confirmado");
});

test("a los 30 días de una baja se borran los datos personales y queda el correo con su fecha de baja", async () => {
  await bd.db.insert(t).values([
    { email: "baja-vieja@example.com", confirmed: true, unsubscribedAt: dias(40), ...completo },
    { email: "baja-reciente@example.com", confirmed: true, unsubscribedAt: dias(5), ...completo },
  ]);
  const r = await ret.aplicarRetencion();
  assert.ok(r.bajasDepuradas >= 1);
  const vieja = await fila("baja-vieja@example.com");
  assert.equal(vieja.email, "baja-vieja@example.com");
  assert.ok(vieja.unsubscribedAt, "la fecha de baja se conserva: es la lista de exclusión");
  for (const campo of ["firstName", "lastName", "mobile", "birthDate", "signupIp", "signupCity", "signupCountry", "signupPostal", "neighborhood", "signupLat", "signupLon", "signupGeoSource", "signupGeoAccuracy", "confirmToken"] as const) {
    assert.equal(vieja[campo], null, `${campo} debe quedar vacío`);
  }
  assert.equal((await fila("baja-reciente@example.com")).firstName, "Ana", "una baja reciente se deja intacta");
});

test("es idempotente: una segunda pasada no encuentra nada que hacer", async () => {
  const r = await ret.aplicarRetencion();
  assert.deepEqual(r, { ipsBorradas: 0, altasSinConfirmarEliminadas: 0, bajasDepuradas: 0 });
});
