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
