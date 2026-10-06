import test from "node:test";
import assert from "node:assert/strict";
import { ENV_PROPIO, claveDe, firmar, igualesSeguro, secretoRaiz } from "@/lib/claves";

// Restaura las variables que cada prueba toca.
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

test("cada propósito tiene su propia clave, estable y de 32 bytes", () => {
  conEntorno({ AUTH_SECRET: "secreto-de-prueba-1", PASSKEY_BRIDGE_SECRET: undefined, SECRETS_ENCRYPTION_KEY: undefined }, () => {
    const a = claveDe("cifrado-secretos");
    const b = claveDe("passkey-puente");
    assert.equal(a.length, 32);
    assert.notDeepEqual(a, b, "dos propósitos no pueden compartir clave");
    assert.deepEqual(a, claveDe("cifrado-secretos"), "la derivación es determinista entre llamadas e instancias");
    assert.notDeepEqual(a, Buffer.from("secreto-de-prueba-1"), "la clave derivada no es el secreto raíz");
  });
});

test("cambiar AUTH_SECRET cambia todas las claves derivadas", () => {
  let antes: Buffer = Buffer.alloc(0);
  conEntorno({ AUTH_SECRET: "uno", SECRETS_ENCRYPTION_KEY: undefined }, () => (antes = claveDe("cifrado-secretos")));
  conEntorno({ AUTH_SECRET: "dos", SECRETS_ENCRYPTION_KEY: undefined }, () => assert.notDeepEqual(claveDe("cifrado-secretos"), antes));
});

test("la variable propia de un propósito se rota sin tocar a los demás", () => {
  conEntorno({ AUTH_SECRET: "raiz", NEWSLETTER_LINK_SECRET: undefined, PASSKEY_BRIDGE_SECRET: undefined }, () => {
    const baja0 = claveDe("baja-boletin");
    const passkey0 = claveDe("passkey-puente");
    process.env.NEWSLETTER_LINK_SECRET = "otra-raiz-solo-para-enlaces";
    assert.notDeepEqual(claveDe("baja-boletin"), baja0, "el propósito con variable propia cambia");
    assert.deepEqual(claveDe("passkey-puente"), passkey0, "los demás no se enteran");
    delete process.env.NEWSLETTER_LINK_SECRET;
  });
  assert.equal(ENV_PROPIO["webhook-telegram"], "TELEGRAM_WEBHOOK_SECRET");
});

test("sin AUTH_SECRET: producción lanza, desarrollo usa el valor de respaldo", () => {
  conEntorno({ AUTH_SECRET: undefined, NODE_ENV: "production" }, () => assert.throws(() => secretoRaiz(), /AUTH_SECRET/));
  conEntorno({ AUTH_SECRET: undefined, NODE_ENV: "test" }, () => assert.throws(() => secretoRaiz(), /AUTH_SECRET/));
  conEntorno({ AUTH_SECRET: undefined, NODE_ENV: "development" }, () => assert.ok(secretoRaiz().length > 10));
  conEntorno({ AUTH_SECRET: "   ", NODE_ENV: "production" }, () => assert.throws(() => secretoRaiz(), /AUTH_SECRET/));
});

test("igualesSeguro compara igual que ===, sea cual sea la longitud", () => {
  assert.equal(igualesSeguro("abc", "abc"), true);
  assert.equal(igualesSeguro("abc", "abd"), false);
  assert.equal(igualesSeguro("abc", "abcd"), false);
  assert.equal(igualesSeguro("", ""), true);
  assert.equal(igualesSeguro("", "a"), false);
});

test("firmar es determinista por propósito y distinto entre propósitos", () => {
  conEntorno({ AUTH_SECRET: "raiz" }, () => {
    assert.equal(firmar("baja-boletin", "x"), firmar("baja-boletin", "x"));
    assert.notEqual(firmar("baja-boletin", "x"), firmar("token-previa", "x"));
    assert.notEqual(firmar("baja-boletin", "x"), firmar("baja-boletin", "y"));
  });
});
