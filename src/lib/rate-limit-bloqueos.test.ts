import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

let hit: typeof import("@/lib/rate-limit").hit;
let b: typeof import("@/lib/rate-limit-bloqueos");

before(async () => {
  await prepararBd();
  ({ hit } = await import("@/lib/rate-limit"));
  b = await import("@/lib/rate-limit-bloqueos");
});

test("una cuenta con más de 5 intentos fallidos figura bloqueada y se puede desbloquear; con 5 o menos, no", async () => {
  const cuenta = { id: "u-1", email: "Bloqueada@X.co" };
  for (let i = 0; i < 5; i++) await hit("login:email:bloqueada@x.co", 5, 900);
  assert.equal((await b.bloqueosActivos([cuenta])).has("u-1"), false, "con 5 intentos todavía puede entrar");
  await hit("login:email:bloqueada@x.co", 5, 900);
  const bloqueos = await b.bloqueosActivos([cuenta, { id: "u-2", email: "libre@x.co" }]);
  assert.equal(bloqueos.has("u-1"), true);
  assert.equal(bloqueos.has("u-2"), false);
  assert.ok((bloqueos.get("u-1") as Date).getTime() > Date.now());
  await b.desbloquearCuenta(cuenta);
  assert.equal((await b.bloqueosActivos([cuenta])).size, 0);
});
