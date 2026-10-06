import test, { before } from "node:test";
import assert from "node:assert/strict";
import { generateSecret, generateSync } from "otplib";
import { prepararBd } from "@/test-utils/bd-memoria";

type Totp = typeof import("@/lib/totp");
let totp: Totp;

before(async () => {
  await prepararBd();
  totp = await import("@/lib/totp");
});

// Código que mostraría una aplicación cuyo reloj va `pasos` pasos de 30 s adelante (negativo: atrás).
const codigoEn = (secret: string, pasos: number) => generateSync({ secret, epoch: Math.floor(Date.now() / 1000) + pasos * 30 });

test("un código vigente entra una vez y la repetición se rechaza como reutilizada", async () => {
  const secret = generateSecret();
  const code = codigoEn(secret, 0);
  assert.deepEqual(await totp.verificarCodigoTotp("usuario-1", secret, code), { ok: true });
  assert.deepEqual(await totp.verificarCodigoTotp("usuario-1", secret, code), { ok: false, motivo: "reutilizado" });
});

test("el código gastado por una persona no bloquea a otra con el mismo secreto de prueba", async () => {
  const secret = generateSecret();
  const code = codigoEn(secret, 0);
  assert.equal((await totp.verificarCodigoTotp("usuario-a", secret, code)).ok, true);
  assert.equal((await totp.verificarCodigoTotp("usuario-b", secret, code)).ok, true);
});

test("un reloj desfasado un paso (±30 s) sigue entrando; tres pasos no", async () => {
  const secret = generateSecret();
  assert.equal((await totp.verificarCodigoTotp("desfase-1", secret, codigoEn(secret, -1))).ok, true);
  assert.equal((await totp.verificarCodigoTotp("desfase-2", secret, codigoEn(secret, 1))).ok, true);
  assert.deepEqual(await totp.verificarCodigoTotp("desfase-3", secret, codigoEn(secret, -3)), { ok: false, motivo: "incorrecto" });
  assert.deepEqual(await totp.verificarCodigoTotp("desfase-4", secret, codigoEn(secret, 3)), { ok: false, motivo: "incorrecto" });
});

test("se acepta con espacios y se rechaza lo que no son seis dígitos", async () => {
  const secret = generateSecret();
  const code = codigoEn(secret, 0);
  assert.equal((await totp.verificarCodigoTotp("espacios", secret, `${code.slice(0, 3)} ${code.slice(3)}`)).ok, true);
  for (const mal of ["", "12345", "1234567", "abcdef", "12 34 5"]) {
    assert.deepEqual(await totp.verificarCodigoTotp("mal", secret, mal), { ok: false, motivo: "incorrecto" });
  }
});

test("un secreto corrupto nunca valida y no lanza", async () => {
  assert.deepEqual(await totp.verificarCodigoTotp("roto", "esto-no-es-base32-!!!", "123456"), { ok: false, motivo: "incorrecto" });
});

test("codigoTotpValido (alta del 2FA) acepta el mismo código varias veces porque no lo gasta", () => {
  const secret = generateSecret();
  const code = codigoEn(secret, 0);
  assert.equal(totp.codigoTotpValido(secret, code), true);
  assert.equal(totp.codigoTotpValido(secret, code), true);
  assert.equal(totp.codigoTotpValido(secret, "000000" === code ? "000001" : "000000"), false);
});
