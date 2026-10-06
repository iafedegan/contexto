import test from "node:test";
import assert from "node:assert/strict";
import { cabeceraCsp, fuentesExtra, resumirAvisoCsp } from "@/lib/csp";

const dir = (valor: string, nombre: string) => valor.split("; ").find((d) => d.startsWith(`${nombre} `)) ?? "";

test("en producción la CSP es obligatoria; con CSP_MODE=report-only vuelve a solo informe; en desarrollo solo informa", () => {
  assert.equal(cabeceraCsp({ NODE_ENV: "production" }).key, "Content-Security-Policy");
  assert.equal(cabeceraCsp({ NODE_ENV: "production", CSP_MODE: "report-only" }).key, "Content-Security-Policy-Report-Only");
  assert.equal(cabeceraCsp({ NODE_ENV: "development" }).key, "Content-Security-Policy-Report-Only");
});

test("cierra lo que importa: objetos, base, formularios, marcos, y no admite eval", () => {
  const { value } = cabeceraCsp({ NODE_ENV: "production" });
  assert.equal(dir(value, "object-src"), "object-src 'none'");
  assert.equal(dir(value, "base-uri"), "base-uri 'self'");
  assert.equal(dir(value, "form-action"), "form-action 'self'");
  assert.equal(dir(value, "frame-ancestors"), "frame-ancestors 'self'");
  assert.equal(dir(value, "default-src"), "default-src 'self'");
  assert.ok(!value.includes("unsafe-eval"));
  assert.ok(value.includes("report-uri /api/csp-report"));
});

test("los scripts solo se cargan de los orígenes que el sitio usa de verdad", () => {
  const s = dir(cabeceraCsp({ NODE_ENV: "production" }).value, "script-src");
  for (const origen of ["https://www.googletagmanager.com", "https://challenges.cloudflare.com", "https://unpkg.com", "https://cdn.jsdelivr.net"]) assert.ok(s.includes(origen), origen);
  assert.ok(!/ https: /.test(`${s} `) && !s.includes("*"), "no admite https: genérico ni comodines");
});

test("un dominio publicitario se autoriza de forma explícita con una variable de entorno", () => {
  const { value } = cabeceraCsp({ NODE_ENV: "production", CSP_SCRIPT_SRC_EXTRA: "https://securepubads.g.doubleclick.net, https://*.googlesyndication.com", CSP_FRAME_SRC_EXTRA: "https://tpc.googlesyndication.com" });
  assert.ok(dir(value, "script-src").includes("https://securepubads.g.doubleclick.net"));
  assert.ok(dir(value, "script-src").includes("https://*.googlesyndication.com"));
  assert.ok(dir(value, "frame-src").includes("https://tpc.googlesyndication.com"));
});

test("las fuentes del entorno se validan: nada que abra la política ni cierre la directiva", () => {
  const malas = ["http://inseguro.com", "'unsafe-eval'", "*", "https:", "https://a.com; script-src *", "https://a.com'", "data:", "https://", "ftp://x.com", "https://bien.com/ruta"];
  assert.deepEqual(fuentesExtra(malas.join(" ")), []);
  assert.deepEqual(fuentesExtra("https://bien.com https://*.bien.org:8443"), ["https://bien.com", "https://*.bien.org:8443"]);
  const { value } = cabeceraCsp({ NODE_ENV: "production", CSP_SCRIPT_SRC_EXTRA: "https://a.com;object-src * https://ok.com" });
  assert.equal(dir(value, "object-src"), "object-src 'none'", "un valor malicioso no cambia otras directivas");
  assert.ok(!dir(value, "script-src").includes("a.com"));
});

test("resumirAvisoCsp deja solo directiva, recurso y página, cortados", () => {
  const largo = "https://x.com/" + "a".repeat(500);
  const r = JSON.parse(resumirAvisoCsp(JSON.stringify({ "csp-report": { "violated-directive": "script-src-elem", "blocked-uri": largo, "document-uri": "https://sitio.com/nota", "original-policy": "default-src ..." } })));
  assert.equal(r.directiva, "script-src-elem");
  assert.equal(r.pagina, "https://sitio.com/nota");
  assert.equal(r.bloqueado.length, 200);
  assert.ok(!JSON.stringify(r).includes("original-policy"));
  // Formato de la Reporting API (lista con `body`).
  const api = JSON.parse(resumirAvisoCsp(JSON.stringify([{ body: { effectiveDirective: "img-src", blockedURL: "https://malo.com/x.png", documentURL: "https://sitio.com/" } }])));
  assert.deepEqual(api, { directiva: "img-src", bloqueado: "https://malo.com/x.png", pagina: "https://sitio.com/" });
  assert.equal(resumirAvisoCsp("no es json").length > 0, true);
});

test("solo la documentación de la API admite eval y las tipografías de Scalar; la política general no", () => {
  const general = cabeceraCsp({ NODE_ENV: "production" }).value;
  const docs = cabeceraCsp({ NODE_ENV: "production" }, { documentacionApi: true }).value;
  assert.ok(!general.includes("unsafe-eval") && !general.includes("fonts.scalar.com"));
  assert.ok(dir(docs, "script-src").includes("'unsafe-eval'"));
  assert.ok(dir(docs, "font-src").includes("https://fonts.scalar.com"));
  // Todo lo demás es idéntico: la excepción no abre nada más.
  for (const d of ["object-src", "base-uri", "form-action", "frame-ancestors", "default-src", "connect-src", "frame-src"]) assert.equal(dir(docs, d), dir(general, d), d);
});
