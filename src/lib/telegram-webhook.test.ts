import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { secretoWebhook, webhookAutorizado } from "@/lib/telegram";

const legado = (s: string) => createHmac("sha256", s).update("telegram-webhook").digest("hex").slice(0, 48);

function conEntorno(vars: Record<string, string | undefined>, fn: () => void) {
  const antes: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) antes[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("el secreto vigente tiene un formato que Telegram admite y no depende de nada público", () => {
  conEntorno({ AUTH_SECRET: "raiz-de-prueba", TELEGRAM_WEBHOOK_SECRET: undefined }, () => {
    const s = secretoWebhook();
    assert.match(s, /^[0-9a-f]{64}$/);
    assert.notEqual(s, legado("contexto-ganadero-dev-secret"), "no coincide con el secreto calculable desde el repositorio");
  });
});

test("se acepta el secreto vigente y el heredado; cualquier otro se rechaza", () => {
  conEntorno({ AUTH_SECRET: "raiz-de-prueba", TELEGRAM_WEBHOOK_SECRET: undefined }, () => {
    assert.equal(webhookAutorizado(secretoWebhook()), true);
    assert.equal(webhookAutorizado(legado("raiz-de-prueba")), true, "webhooks ya registrados con el esquema anterior");
    assert.equal(webhookAutorizado(legado("contexto-ganadero-dev-secret")), false, "el valor del repositorio no entra");
    assert.equal(webhookAutorizado("x"), false);
    assert.equal(webhookAutorizado(""), false);
    assert.equal(webhookAutorizado(null), false);
  });
});

test("con TELEGRAM_WEBHOOK_SECRET propio, el de AUTH_SECRET deja de valer", () => {
  conEntorno({ AUTH_SECRET: "raiz-de-prueba", TELEGRAM_WEBHOOK_SECRET: "secreto-solo-telegram" }, () => {
    const s = secretoWebhook();
    assert.equal(webhookAutorizado(s), true);
    assert.equal(webhookAutorizado(legado("secreto-solo-telegram")), true);
    assert.equal(webhookAutorizado(legado("raiz-de-prueba")), false);
  });
});

test("producción sin ningún secreto configurado lanza (la ruta responde 503), nunca cae en un valor público", () => {
  conEntorno({ AUTH_SECRET: undefined, TELEGRAM_WEBHOOK_SECRET: undefined, NODE_ENV: "production" }, () => {
    assert.throws(() => secretoWebhook(), /AUTH_SECRET/);
    assert.throws(() => webhookAutorizado(legado("contexto-ganadero-dev-secret")), /AUTH_SECRET/);
  });
});
