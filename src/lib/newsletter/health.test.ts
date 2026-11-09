import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";

type Salud = typeof import("@/lib/newsletter/health");
let salud: Salud;

const fetchReal = globalThis.fetch;
const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

let llamadasToken = 0;
let manejador: (n: number) => Response = () => respuesta(200, { access_token: "ya29.prueba" });

const ENV = { GMAIL_CLIENT_ID: "123-abc.apps.googleusercontent.com", GMAIL_CLIENT_SECRET: "GOCSPX-secreto-de-prueba-123456", GMAIL_REFRESH_TOKEN: "1//token-de-prueba-0123456789abcdef" };
const conCredenciales = () => Object.assign(process.env, ENV);
const sinCredenciales = () => { for (const k of Object.keys(ENV)) delete process.env[k]; };

before(async () => {
  await prepararBd();
  delete process.env.RESEND_API_KEY;
  salud = await import("@/lib/newsletter/health");
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === "https://oauth2.googleapis.com/token") return manejador(llamadasToken++);
    return fetchReal(url as never, init);
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = fetchReal;
});

test("sin credenciales de Gmail no hace nada ni toca la red", async () => {
  sinCredenciales();
  llamadasToken = 0;
  assert.equal(await salud.keepGoogleAlive(), null);
  assert.equal(llamadasToken, 0);
  assert.equal(await salud.getGoogleHealth(), null);
});

test("con credenciales válidas usa el token (cuenta como uso) y lo deja registrado como correcto", async () => {
  conCredenciales();
  llamadasToken = 0;
  manejador = () => respuesta(200, { access_token: "ya29.prueba" });
  const h = await salud.keepGoogleAlive();
  assert.equal(h?.ok, true);
  assert.equal(llamadasToken, 1);
  const guardado = await salud.getGoogleHealth();
  assert.equal(guardado?.ok, true);
  assert.ok(!Number.isNaN(Date.parse(guardado!.checkedAt)));
});

test("un corte de red de un instante se absorbe con un reintento: no queda alerta", async () => {
  conCredenciales();
  llamadasToken = 0;
  manejador = (n) => {
    if (n === 0) throw new Error("red caída");
    return respuesta(200, { access_token: "ya29.prueba" });
  };
  const h = await salud.keepGoogleAlive();
  assert.equal(h?.ok, true);
  assert.equal(llamadasToken, 2);
});

test("con el token revocado queda la alerta, con un mensaje que dice qué hacer", async () => {
  conCredenciales();
  llamadasToken = 0;
  manejador = () => respuesta(400, { error: "invalid_grant" });
  const h = await salud.keepGoogleAlive();
  assert.equal(h?.ok, false);
  assert.equal(llamadasToken, 2, "un reintento y se rinde");
  assert.match(h?.error ?? "", /refresh token/);
  const guardado = await salud.getGoogleHealth();
  assert.equal(guardado?.ok, false);
  assert.match(guardado?.error ?? "", /OAuth Playground/);
});

test("volver a conectar apaga la alerta y quitar las credenciales borra el estado", async () => {
  await salud.recordGoogleHealth({ ok: true, checkedAt: new Date().toISOString() });
  const s = await salud.getGoogleHealth();
  assert.equal(s?.ok, true);
  assert.equal(s?.error, undefined, "el error anterior desaparece");
  await salud.clearGoogleHealth();
  assert.equal(await salud.getGoogleHealth(), null);
});
