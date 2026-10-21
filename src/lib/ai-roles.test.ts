import test from "node:test";
import assert from "node:assert/strict";
import { aplicarRoles, validarRoles } from "./ai-roles";

const cat = { google: ["gemini-3.8-flash", "gemini-3.8-pro", "gemini-nano-banana-2.1", "veo-3"], anthropic: ["claude-sonnet-5"] };

test("acepta varios modelos para los editores y uno por función", () => {
  const r = validarRoles(
    { editor: { habilitados: ["google:gemini-3.8-flash", "anthropic:claude-sonnet-5"], predeterminado: "anthropic:claude-sonnet-5" }, asistente: "google:gemini-3.8-pro", imagen: "google:gemini-nano-banana-2.1", videoEntender: "google:gemini-3.8-flash", videoGenerar: "google:veo-3" },
    cat,
    ["google", "anthropic"],
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.principal, { provider: "anthropic", model: "claude-sonnet-5" });
    assert.equal(r.roles.videoGenerar, "google:veo-3");
  }
});

test("rechaza lo que no sirve: sin clave, fuera del catálogo, tipo equivocado, sin editores", () => {
  const sinClave = validarRoles({ editor: { habilitados: ["anthropic:claude-sonnet-5"] } }, cat, ["google"]);
  assert.ok(!sinClave.ok && /clave de Anthropic/.test(sinClave.error));
  const fuera = validarRoles({ editor: { habilitados: ["google:no-existe"] } }, cat, ["google"]);
  assert.ok(!fuera.ok && /no ofrece/.test(fuera.error));
  const imagenMala = validarRoles({ editor: { habilitados: ["google:gemini-3.8-flash"] }, imagen: "google:gemini-3.8-flash" }, cat, ["google"]);
  assert.ok(!imagenMala.ok && /imagen/.test(imagenMala.error));
  const videoMalo = validarRoles({ editor: { habilitados: ["google:gemini-3.8-flash"] }, videoGenerar: "anthropic:claude-sonnet-5" }, cat, ["google", "anthropic"]);
  assert.ok(!videoMalo.ok && /Veo/.test(videoMalo.error));
  assert.ok(!validarRoles({ editor: { habilitados: [] } }, cat, ["google"]).ok);
  const editorImagen = validarRoles({ editor: { habilitados: ["google:gemini-nano-banana-2.1"] } }, cat, ["google"]);
  assert.ok(!editorImagen.ok);
});

test("el predeterminado inválido cae al primero y aplicarRoles conserva claves y catálogos", () => {
  const r = validarRoles({ editor: { habilitados: ["google:gemini-3.8-flash", "google:gemini-3.8-pro"], predeterminado: "google:otro" } }, cat, ["google"]);
  assert.ok(r.ok);
  if (!r.ok) return;
  const s = aplicarRoles({ provider: "anthropic", model: "x", keys: { google: "cifrada" }, models: cat, chartModel: "gemini-3.8-pro" }, r);
  assert.equal(s.model, "gemini-3.8-flash");
  assert.deepEqual(s.keys, { google: "cifrada" });
  assert.equal(s.chartModel, "gemini-3.8-pro");
  assert.deepEqual(s.models, cat);
});
