import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { aWebp, ANCHO_MAX_PORTADA, PESO_MAX_PORTADA } from "./imagen-webp";
import { tipoPorFirma } from "./media-firma";

// Una imagen sintética con degradados y formas (parecida a una foto suave), de 2752 × 1536 como la que devuelve el modelo de imagen.
async function fotoGrande() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2752" height="1536"><defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a8fd8"/><stop offset="0.6" stop-color="#cfe3f5"/><stop offset="0.61" stop-color="#5d9b3c"/><stop offset="1" stop-color="#2f6b1d"/></linearGradient></defs><rect width="2752" height="1536" fill="url(#c)"/><ellipse cx="1300" cy="1000" rx="420" ry="260" fill="#9c5a2b"/><ellipse cx="1900" cy="1100" rx="300" ry="190" fill="#b8733c"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

test("una portada grande se convierte en WebP, se redimensiona y pesa lo que carga rápido", async () => {
  const png = await fotoGrande();
  const r = await aWebp(new Uint8Array(png));
  assert.equal(tipoPorFirma(r.bytes)?.mime, "image/webp", "el resultado es WebP de verdad");
  assert.equal(r.ancho, ANCHO_MAX_PORTADA, "no pasa del ancho máximo");
  assert.equal(r.alto, 1152, "queda en 16:9 exacto (2048 × 1152) aunque el original fuera 43:24");
  assert.ok(r.ancho >= 1200, "sigue cumpliendo los 1200 px de Discover");
  assert.ok(r.bytes.length <= PESO_MAX_PORTADA, `pesa ${r.bytes.length} bytes: debe entrar en ${PESO_MAX_PORTADA}`);
  assert.ok(r.bytes.length < png.length, "pesa menos que el original");
});

test("una imagen pequeña no se amplía", async () => {
  const chica = await sharp({ create: { width: 800, height: 450, channels: 3, background: "#456" } }).png().toBuffer();
  const r = await aWebp(new Uint8Array(chica));
  assert.equal(r.ancho, 800);
  assert.ok(r.bytes.length <= PESO_MAX_PORTADA);
});
