import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
// Petición como la vería el proxy detrás de Vercel: con la IP en x-forwarded-for.
const pedir = (ruta: string, ip: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(`http://localhost:3000${ruta}`, { headers: { "x-forwarded-for": ip, "user-agent": NAVEGADOR, ...headers } }));
// Estados de n peticiones seguidas.
const rafaga = async (n: number, ...args: Parameters<typeof pedir>) => {
  const estados: number[] = [];
  for (let i = 0; i < n; i++) estados.push((await pedir(...args)).status);
  return estados;
};

test("una IP que pide más de 120 páginas por minuto recibe 429; antes no", async () => {
  const estados = await rafaga(125, "/", "203.0.113.1");
  assert.ok(estados.slice(0, 120).every((s) => s === 200));
  assert.ok(estados.slice(120).every((s) => s === 429));
});

test("lo que el navegador pide con cada página (manifiesto, íconos, API) no gasta el cupo de páginas (H-13)", async () => {
  for (const ruta of ["/manifest.webmanifest", "/icon?abc", "/apple-icon", "/api/pwa-icon?size=192", "/api/vista", "/api/programadas", "/api/auth/csrf", "/api/assistant"]) {
    assert.ok((await rafaga(150, ruta, "203.0.113.2")).every((s) => s !== 429), `${ruta} no debe limitarse aquí`);
  }
  // Y tras todo eso, las páginas de esa IP siguen disponibles.
  assert.equal((await pedir("/", "203.0.113.2")).status, 200);
});

test("los prefetch de Next y el panel tampoco cuentan", async () => {
  // Next 16 quita `rsc` antes del proxy: lo que queda de una petición del enrutador es `next-url` y `sec-fetch-dest: empty`.
  assert.ok((await rafaga(200, "/categoria/ganaderia", "203.0.113.3", { "next-url": "/", "sec-fetch-dest": "empty", "sec-fetch-mode": "cors" })).every((s) => s !== 429), "peticiones del enrutador");
  assert.ok((await rafaga(200, "/categoria/ganaderia", "203.0.113.3", { rsc: "1" })).every((s) => s !== 429), "cabecera rsc de versiones anteriores");
  assert.ok((await rafaga(200, "/panel/login", "203.0.113.3")).every((s) => s !== 429), "panel");
});

test("las navegaciones de verdad (documento) y un raspador sin cabeceras de navegador sí cuentan", async () => {
  const documento = await rafaga(125, "/politica-de-privacidad", "203.0.113.7", { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" });
  assert.equal(documento.filter((s) => s === 429).length, 5);
  const curl = await rafaga(125, "/politica-de-privacidad", "203.0.113.8", { "user-agent": "curl/8.7.1" });
  assert.equal(curl.filter((s) => s === 429).length, 5);
});

test("solo los crawlers de entrenamiento de IA reciben 403; curl, Python y un navegador sin interfaz pasan", async () => {
  assert.equal((await pedir("/", "203.0.113.4", { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.1)" })).status, 403);
  for (const ua of ["curl/8.7.1", "python-requests/2.32.3", "Mozilla/5.0 HeadlessChrome/130.0", ""]) {
    assert.equal((await pedir("/", "203.0.113.5", { "user-agent": ua })).status, 200, `«${ua}»`);
  }
});

test("el panel sin sesión lleva al login y las respuestas llevan las cabeceras de seguridad", async () => {
  const r = await pedir("/panel/articulos", "203.0.113.6");
  assert.equal(r.status, 307);
  assert.match(r.headers.get("location") ?? "", /\/panel\/login/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.ok(r.headers.get("strict-transport-security"));
});
