import test from "node:test";
import assert from "node:assert/strict";
import { generateSecret } from "otplib";
import { abrirSecretoTotp, altaTotpValida, firmarAltaTotp, sellarSecretoTotp, VIGENCIA_ALTA_MS } from "@/lib/totp-secreto";

process.env.AUTH_SECRET = "secreto-de-prueba-para-totp";
delete process.env.SECRETS_ENCRYPTION_KEY;
delete process.env.TOTP_ENROLL_SECRET;

test("el secreto guardado va cifrado y se recupera igual", () => {
  const secreto = generateSecret();
  const guardado = sellarSecretoTotp(secreto);
  assert.ok(guardado.startsWith("v2."));
  assert.ok(!guardado.includes(secreto));
  assert.deepEqual(abrirSecretoTotp(guardado), { secreto, heredado: false });
});

test("un secreto guardado antes en texto plano se acepta y se marca como heredado", () => {
  const secreto = generateSecret();
  assert.deepEqual(abrirSecretoTotp(secreto), { secreto, heredado: true });
});

test("un secreto base32 nunca se confunde con uno cifrado", () => {
  for (let i = 0; i < 200; i++) assert.ok(!generateSecret().startsWith("v2."));
});

test("un secreto cifrado corrupto no se descifra", () => {
  const guardado = sellarSecretoTotp(generateSecret());
  assert.equal(abrirSecretoTotp(guardado.slice(0, -4) + "AAAA").secreto, null);
});

test("la firma del alta vale para esa persona y ese secreto", () => {
  const ahora = 1_800_000_000_000;
  const firma = firmarAltaTotp("u1", "ABCDEF234567", ahora);
  assert.equal(altaTotpValida("u1", "ABCDEF234567", firma, ahora + 1000), true);
});

test("la firma rechaza otro secreto, otra persona o una firma manipulada", () => {
  const ahora = 1_800_000_000_000;
  const firma = firmarAltaTotp("u1", "ABCDEF234567", ahora);
  assert.equal(altaTotpValida("u1", "ZZZZZZ234567", firma, ahora), false);
  assert.equal(altaTotpValida("u2", "ABCDEF234567", firma, ahora), false);
  assert.equal(altaTotpValida("u1", "ABCDEF234567", firma.slice(0, -2) + "xx", ahora), false);
  assert.equal(altaTotpValida("u1", "ABCDEF234567", "", ahora), false);
  assert.equal(altaTotpValida("u1", "ABCDEF234567", "abc.def", ahora), false);
});

test("la firma caduca y no vale si viene del futuro", () => {
  const ahora = 1_800_000_000_000;
  const firma = firmarAltaTotp("u1", "ABCDEF234567", ahora);
  assert.equal(altaTotpValida("u1", "ABCDEF234567", firma, ahora + VIGENCIA_ALTA_MS + 1), false);
  assert.equal(altaTotpValida("u1", "ABCDEF234567", firma, ahora - 120_000), false);
});
