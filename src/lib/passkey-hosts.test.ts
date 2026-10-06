import test from "node:test";
import assert from "node:assert/strict";
import { avisoSinHosts, hostPermitido, hostnameDe, hostsPermitidos } from "@/lib/passkey-hosts";

test("hostnameDe normaliza URLs, hosts con puerto y mayúsculas", () => {
  assert.equal(hostnameDe("https://Contexto-Olive.vercel.app/ruta?x=1"), "contexto-olive.vercel.app");
  assert.equal(hostnameDe("contexto.example.com:8443"), "contexto.example.com");
  assert.equal(hostnameDe(""), null);
  assert.equal(hostnameDe(undefined), null);
  assert.equal(hostnameDe("https://"), null);
});

test("los dominios permitidos salen del propio despliegue y no se repiten", () => {
  const env = {
    NEXT_PUBLIC_SITE_URL: "https://www.contextoganadero.com/",
    VERCEL_PROJECT_PRODUCTION_URL: "contexto-olive.vercel.app",
    VERCEL_URL: "contexto-abc123.vercel.app",
    PASSKEY_ALLOWED_HOSTS: " viejo.vercel.app , www.contextoganadero.com ",
  };
  assert.deepEqual(hostsPermitidos(env).sort(), ["contexto-abc123.vercel.app", "contexto-olive.vercel.app", "viejo.vercel.app", "www.contextoganadero.com"]);
});

test("un dominio fuera de la lista se rechaza; uno de la lista se acepta con cualquier puerto", () => {
  const env = { VERCEL: "1", NEXT_PUBLIC_SITE_URL: "https://www.contextoganadero.com", VERCEL_PROJECT_PRODUCTION_URL: "contexto-olive.vercel.app" };
  assert.equal(hostPermitido("contexto-olive.vercel.app", env), true);
  assert.equal(hostPermitido("www.contextoganadero.com:443", env), true);
  assert.equal(hostPermitido("evil.example.com", env), false);
  assert.equal(hostPermitido("contexto-olive.vercel.app.evil.com", env), false);
  assert.equal(hostPermitido("", env), false);
  assert.equal(hostPermitido(null, env), false);
});

test("localhost solo vale fuera de Vercel", () => {
  const local = { NEXT_PUBLIC_SITE_URL: "https://www.contextoganadero.com" };
  assert.equal(hostPermitido("localhost:3000", local), true);
  assert.equal(hostPermitido("127.0.0.1:3123", local), true);
  assert.equal(hostPermitido("localhost:3000", { ...local, VERCEL: "1" }), false);
});

test("sin ningún dominio declarado no se puede filtrar: se acepta y se avisa", () => {
  assert.equal(avisoSinHosts({}), true);
  assert.equal(hostPermitido("cualquiera.example.com", {}), true);
  assert.equal(avisoSinHosts({ NEXT_PUBLIC_SITE_URL: "https://a.com" }), false);
});
