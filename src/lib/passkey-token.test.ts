import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

process.env.AUTH_SECRET = "secreto-de-prueba-para-passkeys";
delete process.env.PASSKEY_BRIDGE_SECRET;

type Passkey = typeof import("@/lib/passkey");
let pk: Passkey;

before(async () => {
  await prepararBd();
  pk = await import("@/lib/passkey");
});

test("el token puente se firma, se lee y lleva un identificador propio", () => {
  const t = pk.firmarTokenPasskey("usuario-1");
  const leido = pk.leerTokenPasskey(t);
  assert.equal(leido?.uid, "usuario-1");
  assert.ok((leido?.jti.length ?? 0) >= 16);
  assert.notEqual(pk.leerTokenPasskey(pk.firmarTokenPasskey("usuario-1"))?.jti, leido?.jti, "cada token tiene identificador distinto");
});

test("caduca a los 60 s", () => {
  const ahora = Date.now();
  const t = pk.firmarTokenPasskey("usuario-1", ahora);
  assert.ok(pk.leerTokenPasskey(t, ahora + 59_000));
  assert.equal(pk.leerTokenPasskey(t, ahora + 61_000), null);
});

test("un token alterado o de otro formato se rechaza", () => {
  const t = pk.firmarTokenPasskey("usuario-1");
  const [payload, firma] = t.split(".");
  assert.equal(pk.leerTokenPasskey(`${payload}.${firma.slice(0, -2)}AA`), null);
  const otro = Buffer.from(JSON.stringify({ uid: "administrador", exp: Date.now() + 60_000, jti: "x".repeat(22) })).toString("base64url");
  assert.equal(pk.leerTokenPasskey(`${otro}.${firma}`), null, "cambiar el contenido invalida la firma");
  assert.equal(pk.leerTokenPasskey(""), null);
  assert.equal(pk.leerTokenPasskey("a.b.c"), null);
  assert.equal(pk.leerTokenPasskey(payload), null);
});

test("un token firmado con otra clave no vale", () => {
  const t = pk.firmarTokenPasskey("usuario-1");
  process.env.PASSKEY_BRIDGE_SECRET = "otra-clave-del-puente";
  assert.equal(pk.leerTokenPasskey(t), null);
  delete process.env.PASSKEY_BRIDGE_SECRET;
});

test("consumirTokenPasskey entrega la cuenta UNA sola vez, aunque el token no haya caducado", async () => {
  const t = pk.firmarTokenPasskey("usuario-9");
  assert.equal(await pk.consumirTokenPasskey(t), "usuario-9");
  assert.equal(await pk.consumirTokenPasskey(t), null, "la segunda presentación se rechaza");
  assert.equal(await pk.consumirTokenPasskey(t), null);
  // Otro token del mismo usuario es independiente.
  assert.equal(await pk.consumirTokenPasskey(pk.firmarTokenPasskey("usuario-9")), "usuario-9");
});

test("consumirTokenPasskey no gasta nada si el token es inválido", async () => {
  assert.equal(await pk.consumirTokenPasskey("basura"), null);
});
