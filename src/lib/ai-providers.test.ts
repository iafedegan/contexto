import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_IMAGE_MODEL, esModeloDeImagen } from "@/lib/ai-providers";

test("el selector de imágenes solo ofrece modelos que generan imágenes", () => {
  const catalogo = [
    "gemini-3.1-pro-preview",
    "gemini-3.8-flash",
    "gemini-3.1-flash-image-preview",
    "gemini-3-pro-image-preview",
    "gemini-2.5-flash-image",
    "nano-banana-pro-preview",
    "gemini-3.1-flash-tts-preview",
    "lyria-3.5",
    "gemma-4-31b-it",
  ];
  assert.deepEqual(catalogo.filter(esModeloDeImagen), [
    "gemini-3.1-flash-image-preview",
    "gemini-3-pro-image-preview",
    "gemini-2.5-flash-image",
    "nano-banana-pro-preview",
  ]);
});

test("el modelo de imagen predeterminado es un modelo de imagen", () => {
  assert.equal(esModeloDeImagen(DEFAULT_IMAGE_MODEL), true);
});

import { DEFAULT_IMAGE_MODEL as IMG, listaEditor, leerRef, modeloDe, esModeloDeTexto, esModeloDeVideo } from "./ai-providers";
import type { AiSettings as Ajustes } from "./ai-providers";

const base: Ajustes = { provider: "google", model: "gemini-3.8-flash", keys: {}, models: {} };

test("sin ajustes por función, todo usa el modelo principal y el editor solo tiene ese", () => {
  assert.equal(modeloDe(base, "editor"), "google:gemini-3.8-flash");
  assert.equal(modeloDe(base, "asistente"), "google:gemini-3.8-flash");
  assert.equal(modeloDe(base, "imagen"), `google:${IMG}`);
  assert.equal(modeloDe(base, "videoEntender"), "google:gemini-3.8-flash");
  assert.equal(modeloDe(base, "videoGenerar"), null);
  assert.deepEqual(listaEditor(base), { habilitados: ["google:gemini-3.8-flash"], predeterminado: "google:gemini-3.8-flash" });
});

test("el editor elige entre los habilitados; lo que no está en la lista se ignora", () => {
  const s: Ajustes = { ...base, roles: { editor: { habilitados: ["google:gemini-3.8-flash", "anthropic:claude-sonnet-5"], predeterminado: "anthropic:claude-sonnet-5" } } };
  assert.equal(modeloDe(s, "editor"), "anthropic:claude-sonnet-5");
  assert.equal(modeloDe(s, "editor", "google:gemini-3.8-flash"), "google:gemini-3.8-flash");
  assert.equal(modeloDe(s, "editor", "google:otro-modelo"), "anthropic:claude-sonnet-5");
  assert.equal(modeloDe({ ...s, roles: { editor: { habilitados: ["google:a", "google:b"], predeterminado: "google:zzz" } } }, "editor"), "google:a");
});

test("cada función usa su modelo; el principal Claude no sirve para video", () => {
  const s: Ajustes = { provider: "anthropic", model: "claude-sonnet-5", keys: {}, roles: { asistente: "google:gemini-3.8-flash", imagen: "google:nano", videoGenerar: "google:veo-3" } };
  assert.equal(modeloDe(s, "asistente"), "google:gemini-3.8-flash");
  assert.equal(modeloDe(s, "imagen"), "google:nano");
  assert.equal(modeloDe(s, "videoGenerar"), "google:veo-3");
  assert.equal(modeloDe(s, "videoEntender"), null);
});

test("leerRef y los filtros de tipo de modelo", () => {
  assert.deepEqual(leerRef("google:gemini-3.8-flash"), { provider: "google", model: "gemini-3.8-flash" });
  assert.equal(leerRef("gemini-3.8-flash"), null);
  assert.equal(leerRef("otro:modelo"), null);
  assert.equal(esModeloDeVideo("veo-3.1-generate"), true);
  assert.equal(esModeloDeTexto("gemini-3.8-flash"), true);
  for (const n of ["gemini-nano-banana-2.1", "veo-3", "text-embedding-004", "gemini-2.5-flash-preview-tts"]) assert.equal(esModeloDeTexto(n), false, n);
});
