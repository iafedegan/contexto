import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/lib/newsletter/token";

process.env.AUTH_SECRET = "secreto-de-prueba-para-enlaces";
delete process.env.NEWSLETTER_LINK_SECRET;

test("el enlace de baja nuevo verifica y no sirve para otro suscriptor", () => {
  const t = unsubscribeToken("sub-1");
  assert.equal(t.length, 32);
  assert.equal(verifyUnsubscribeToken("sub-1", t), true);
  assert.equal(verifyUnsubscribeToken("sub-2", t), false);
});

test("los enlaces ya enviados (HMAC directo de AUTH_SECRET) siguen dando de baja", () => {
  const heredado = createHmac("sha256", process.env.AUTH_SECRET!).update("baja:sub-1").digest("base64url").slice(0, 32);
  assert.notEqual(heredado, unsubscribeToken("sub-1"), "el esquema nuevo es distinto del anterior");
  assert.equal(verifyUnsubscribeToken("sub-1", heredado), true);
});

test("tokens vacíos, truncados o manipulados se rechazan", () => {
  const t = unsubscribeToken("sub-1");
  assert.equal(verifyUnsubscribeToken("sub-1", ""), false);
  assert.equal(verifyUnsubscribeToken("sub-1", t.slice(0, 20)), false);
  assert.equal(verifyUnsubscribeToken("sub-1", t.slice(0, 31) + (t.endsWith("a") ? "b" : "a")), false);
  assert.equal(verifyUnsubscribeToken("sub-1", "x".repeat(500)), false);
});
