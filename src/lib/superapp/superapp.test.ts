import test, { before } from "node:test";
import assert from "node:assert/strict";
import { prepararBd } from "@/test-utils/bd-memoria";
import type { ConfigSuperApp } from "@/lib/superapp/config";
import type { IdentidadSuperApp } from "@/lib/superapp/contrato";

const CFG: ConfigSuperApp = { apiBase: "https://api.ejemplo.test", credencial: "credencial-de-prueba", schemaVersion: "1.2", audience: "context-ganadero" };
const CUPON = `slc_${"a".repeat(43)}`;
const REF = `srs_${"b".repeat(43)}`;
process.env.AUTH_SECRET ||= "secreto-de-prueba-para-las-sesiones-0123456789";
const ahora = new Date();
const en = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
const base = () => ({
  schemaVersion: "1.2", audience: "context-ganadero", subject: "sub-123", documentType: "CC", documentNumber: "00000000", email: "persona@example.test", active: true,
  assuranceLevel: 1, capabilities: [], issuedAt: en(-1), expiresAt: en(30), sessionReference: REF,
  sessionValidationUrl: "https://api.ejemplo.test/v2/miniapps/secure-launch/session/validate", correlationId: "6f9619ff-8b86-4011-b42d-00c04fc964ff",
});

let contrato: typeof import("@/lib/superapp/contrato");
let cliente: typeof import("@/lib/superapp/cliente");
let sesion: typeof import("@/lib/superapp/sesion");
before(async () => {
  await prepararBd();
  contrato = await import("@/lib/superapp/contrato");
  cliente = await import("@/lib/superapp/cliente");
  sesion = await import("@/lib/superapp/sesion");
});

const respuestaDe = (status: number, cuerpo?: unknown) => (async () => new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

test("la respuesta del intercambio se acepta solo si cumple lo acordado", () => {
  assert.ok(contrato.validarRespuesta(base(), CFG, ahora));
  const rechazos: Array<[string, Record<string, unknown>]> = [
    ["versión distinta", { schemaVersion: "1.1" }], ["otro receptor", { audience: "otra-app" }], ["cuenta inactiva", { active: false }], ["ya venció", { expiresAt: en(-5) }],
    ["sin referencia", { sessionReference: undefined }], ["referencia con mala forma", { sessionReference: "srs_corta" }], ["tipo de documento desconocido", { documentType: "XX" }],
    ["URL de otro origen", { sessionValidationUrl: "https://malo.test/v2/miniapps/secure-launch/session/validate" }],
    ["URL de otra ruta", { sessionValidationUrl: "https://api.ejemplo.test/otra" }], ["URL con parámetros", { sessionValidationUrl: "https://api.ejemplo.test/v2/miniapps/secure-launch/session/validate?x=1" }],
  ];
  for (const [motivo, cambio] of rechazos) assert.equal(contrato.validarRespuesta({ ...base(), ...cambio }, CFG, ahora), null, motivo);
  // Las cifras del documento y el correo se exigen pero no forman parte de lo que se conserva.
  const i = contrato.validarRespuesta(base(), CFG, ahora)!;
  assert.deepEqual(Object.keys(i).sort(), ["assuranceLevel", "audience", "capabilities", "correlationId", "expiresAt", "issuedAt", "sessionReference", "subject"]);
});

test("el intercambio traduce cada resultado a la acción de la guía y no concede acceso ante la duda", async () => {
  assert.equal((await cliente.intercambiarCupon(CUPON, CFG, respuestaDe(200, base()))).ok, true);
  const motivos: Array<[number, string]> = [[410, "cupon"], [401, "credencial"], [422, "peticion"], [403, "rechazado"], [503, "servicio"], [500, "servicio"]];
  for (const [http, motivo] of motivos) {
    const r = await cliente.intercambiarCupon(CUPON, CFG, respuestaDe(http));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, motivo, String(http));
  }
  const incompleta = await cliente.intercambiarCupon(CUPON, CFG, respuestaDe(200, { ...base(), sessionReference: undefined }));
  assert.ok(!incompleta.ok && incompleta.motivo === "respuesta");
  const caida = await cliente.intercambiarCupon(CUPON, CFG, (async () => { throw new Error("red"); }) as unknown as typeof fetch);
  assert.ok(!caida.ok && caida.motivo === "servicio");
  // Un cupón con mala forma ni siquiera sale hacia FEDEGÁN.
  let llamadas = 0;
  const contador = (async () => { llamadas++; return new Response("{}"); }) as unknown as typeof fetch;
  assert.equal((await cliente.intercambiarCupon("slc_corto", CFG, contador)).ok, false);
  assert.equal(llamadas, 0);
});

test("la petición lleva la credencial, el audience exacto y la versión 1.0, y no sigue redirecciones", async () => {
  let visto: { url: string; init: RequestInit } | null = null;
  const espia = (async (url: string, init: RequestInit) => { visto = { url, init }; return new Response(JSON.stringify(base()), { status: 200 }); }) as unknown as typeof fetch;
  await cliente.intercambiarCupon(CUPON, CFG, espia);
  const v = visto as unknown as { url: string; init: RequestInit };
  assert.equal(v.url, "https://api.ejemplo.test/v2/miniapps/secure-launch/exchange");
  assert.equal((v.init.headers as Record<string, string>).authorization, "Bearer credencial-de-prueba");
  assert.deepEqual(JSON.parse(String(v.init.body)), { schemaVersion: "1.0", audience: "context-ganadero", code: CUPON });
  assert.equal(v.init.redirect, "error");
});

test("la sesión local usa un identificador nuevo, guarda la referencia cifrada y nunca dura más que la de origen", async () => {
  const identidad = contrato.validarRespuesta(base(), { ...CFG }, ahora) as IdentidadSuperApp;
  const futura = { ...identidad, expiresAt: new Date(Date.now() + 20 * 60_000), issuedAt: new Date() };
  const a = await sesion.crearSesionLocal(futura);
  const b = await sesion.crearSesionLocal(futura);
  assert.notEqual(a.token, b.token);
  const leida = await sesion.leerSesionLocal(a.token);
  assert.ok(leida && leida.subject === "sub-123" && leida.sessionReference === REF);
  // La referencia no está en claro en la base.
  const { db } = await import("@/db");
  const { superappSesiones } = await import("@/db/schema");
  const filas = await db.select().from(superappSesiones);
  assert.ok(filas.every((f) => !f.sessionReference.includes(REF) && !f.tokenHash.includes(a.token)));
  // Revocada o vencida: ya no se lee.
  await sesion.revocarSesion(a.token);
  assert.equal(await sesion.leerSesionLocal(a.token), null);
  const vencida = await sesion.crearSesionLocal({ ...futura, expiresAt: new Date(Date.now() - 1000) });
  assert.equal(await sesion.leerSesionLocal(vencida.token), null);
  assert.equal(await sesion.leerSesionLocal("no-existe"), null);
});

test("la verificación consulta a FEDEGÁN: 403 revoca; una falla de red no concede ni extiende el acceso", async () => {
  const identidad = { ...(contrato.validarRespuesta(base(), CFG, ahora) as IdentidadSuperApp), expiresAt: new Date(Date.now() + 20 * 60_000), issuedAt: new Date() };
  const vigente = { audience: "context-ganadero", subject: "sub-123", active: true, expiresAt: identidad.expiresAt.toISOString(), correlationId: "6f9619ff-8b86-4011-b42d-00c04fc964ff" };

  const { token } = await sesion.crearSesionLocal(identidad);
  const ok = await sesion.verificarVigencia(token, CFG, respuestaDe(200, vigente));
  assert.equal(ok.estado, "vigente");

  // Otra persona en la respuesta: no corresponde → se invalida.
  const otra = await sesion.crearSesionLocal(identidad);
  assert.equal((await sesion.verificarVigencia(otra.token, CFG, respuestaDe(200, { ...vigente, subject: "otro" }))).estado, "invalida");
  assert.equal(await sesion.leerSesionLocal(otra.token), null);

  // Falla de red o 503: no se verifica, pero tampoco se borra ni se prolonga la sesión.
  const caida = await sesion.verificarVigencia(token, CFG, respuestaDe(503));
  assert.equal(caida.estado, "sin_verificar");
  assert.ok(await sesion.leerSesionLocal(token));

  // 403: revocada en origen → se invalida la sesión local.
  assert.equal((await sesion.verificarVigencia(token, CFG, respuestaDe(403))).estado, "invalida");
  assert.equal(await sesion.leerSesionLocal(token), null);
});

test("sin configuración completa la integración queda apagada", async () => {
  const { configSuperApp } = await import("@/lib/superapp/config");
  const claves = ["SUPERAPP_API_BASE_URL", "SUPERAPP_RECEIVER_CREDENTIAL", "SUPERAPP_SCHEMA_VERSION", "SUPERAPP_AUDIENCE"];
  const antes = Object.fromEntries(claves.map((k) => [k, process.env[k]]));
  try {
    for (const k of claves) delete process.env[k];
    assert.equal(configSuperApp(), null);
    process.env.SUPERAPP_API_BASE_URL = "https://api.ejemplo.test"; process.env.SUPERAPP_RECEIVER_CREDENTIAL = "x"; process.env.SUPERAPP_SCHEMA_VERSION = "1.2";
    assert.equal(configSuperApp()?.audience, "context-ganadero");
    process.env.SUPERAPP_API_BASE_URL = "http://api.ejemplo.test"; // sin HTTPS
    assert.equal(configSuperApp(), null);
  } finally {
    for (const k of claves) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
});
