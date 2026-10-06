import test from "node:test";
import assert from "node:assert/strict";
import { cronAutorizado } from "@/lib/cron-auth";

const llamada = (authorization?: string) => new Request("http://localhost/api/cron/x", { headers: authorization ? { authorization } : {} });

function conSecreto(valor: string | undefined, fn: () => void) {
  const antes = process.env.CRON_SECRET;
  const log = console.error;
  console.error = () => {};
  try {
    if (valor === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = valor;
    fn();
  } finally {
    console.error = log;
    if (antes === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = antes;
  }
}

test("sin CRON_SECRET se rechaza TODO, incluido el texto «Bearer undefined» (H-01)", () => {
  conSecreto(undefined, () => {
    assert.equal(cronAutorizado(llamada("Bearer undefined")), false);
    assert.equal(cronAutorizado(llamada("Bearer ")), false);
    assert.equal(cronAutorizado(llamada()), false);
  });
  conSecreto("", () => assert.equal(cronAutorizado(llamada("Bearer ")), false));
  conSecreto("   ", () => assert.equal(cronAutorizado(llamada("Bearer    ")), false));
});

test("con CRON_SECRET solo entra quien envía exactamente «Bearer <secreto>»", () => {
  conSecreto("un-secreto-largo-de-prueba", () => {
    assert.equal(cronAutorizado(llamada("Bearer un-secreto-largo-de-prueba")), true);
    assert.equal(cronAutorizado(llamada("Bearer otro-secreto-largo-de-prueba")), false);
    assert.equal(cronAutorizado(llamada("Bearer un-secreto-largo-de-prueb")), false);
    assert.equal(cronAutorizado(llamada("un-secreto-largo-de-prueba")), false);
    assert.equal(cronAutorizado(llamada("bearer un-secreto-largo-de-prueba")), false);
    assert.equal(cronAutorizado(llamada()), false);
  });
});
