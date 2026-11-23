import test from "node:test";
import assert from "node:assert/strict";
import { ANCHO_SIN_CONEXION, urlImagenOptimizada } from "./imagen-optimizada";

// Pruebas de la dirección optimizada que descarga la lectura sin conexión en vez del original de Supabase.

const ORIGINAL = "https://abc.supabase.co/storage/v1/object/public/media/092b12a9.png";

test("una portada de Supabase se pide a /_next/image, no al almacenamiento", () => {
  const u = urlImagenOptimizada(ORIGINAL);
  assert.equal(u, `/_next/image?url=${encodeURIComponent(ORIGINAL)}&w=${ANCHO_SIN_CONEXION}&q=75`);
  assert.ok(!u!.startsWith("https://"));
});

test("el ancho sin conexión es uno de los que genera next/image", () => {
  assert.ok([640, 828, 1200, 1920].includes(ANCHO_SIN_CONEXION));
});

test("las rutas propias también pasan por el optimizador", () => {
  assert.equal(urlImagenOptimizada("/fotos/vaca.jpg"), "/_next/image?url=%2Ffotos%2Fvaca.jpg&w=640&q=75");
});

test("se descartan SVG, http sin cifrar, direcciones de protocolo relativo y vacías", () => {
  assert.equal(urlImagenOptimizada("https://x.supabase.co/logo.svg"), null);
  assert.equal(urlImagenOptimizada("http://x.supabase.co/a.png"), null);
  assert.equal(urlImagenOptimizada("//x.supabase.co/a.png"), null);
  assert.equal(urlImagenOptimizada("  "), null);
});
