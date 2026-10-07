import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { decryptSecret, encryptSecret, maskSecret, usaFormatoHeredado } from "@/lib/secrets";

process.env.AUTH_SECRET = "secreto-de-prueba-para-cifrado";
delete process.env.SECRETS_ENCRYPTION_KEY;

// Cifra con el formato de ANTES de las claves por propósito (scrypt de AUTH_SECRET, sin prefijo).
function cifrarHeredado(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(process.env.AUTH_SECRET!, "contexto-ganadero/secrets", 32), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

test("lo que se cifra se descifra y lleva la marca del formato nuevo", () => {
  const c = encryptSecret("sk-ant-api03-ejemplo");
  assert.ok(c.startsWith("v2."));
  assert.ok(!c.includes("sk-ant"));
  assert.equal(decryptSecret(c), "sk-ant-api03-ejemplo");
  assert.equal(usaFormatoHeredado(c), false);
});

test("dos cifrados del mismo texto no coinciden (IV aleatorio)", () => {
  assert.notEqual(encryptSecret("igual"), encryptSecret("igual"));
});

test("los secretos guardados con el formato anterior se siguen descifrando", () => {
  const viejo = cifrarHeredado("clave-guardada-antes");
  assert.equal(usaFormatoHeredado(viejo), true);
  assert.equal(decryptSecret(viejo), "clave-guardada-antes");
});

test("con otra clave, o con el dato alterado, no se descifra", () => {
  const c = encryptSecret("privado");
  process.env.SECRETS_ENCRYPTION_KEY = "otra-clave-solo-para-cifrado";
  assert.equal(decryptSecret(c), null);
  delete process.env.SECRETS_ENCRYPTION_KEY;
  // Se cambia un carácter del medio, que siempre altera los bytes (los últimos pueden ser relleno y quedar iguales por azar).
  const m = Math.floor(c.length / 2);
  assert.equal(decryptSecret(`${c.slice(0, m)}${c[m] === "A" ? "B" : "A"}${c.slice(m + 1)}`), null);
  assert.equal(decryptSecret("basura"), null);
});

test("maskSecret deja ver solo los extremos", () => {
  assert.equal(maskSecret("sk-ant-api03-abcdefgh1234"), "sk-ant-…1234");
  assert.equal(maskSecret("corto"), "•••••");
});
