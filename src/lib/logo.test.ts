import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { logoDataUri, logoSvg } from "@/lib/logo";

const logo = (archivo: string) => join(process.cwd(), "public/logo", archivo);

test("el archivo del logo sale de la fuente única: si se edita src/lib/logo.ts hay que regenerarlo", () => {
  const archivo = readFileSync(logo("contexto-ganadero-logo.svg"), "utf8").trim();
  assert.equal(archivo, logoSvg(), "ejecuta: npx tsx scripts/generar-logo.ts");
});

test("el logo es un SVG propio y autónomo: sin imágenes, sin tipografías y con sus degradados definidos", () => {
  const svg = logoSvg();
  assert.match(svg, /^<svg [^>]*viewBox="0 0 100 100"/);
  assert.doesNotMatch(svg, /<image|<text|font-family|href="http/);
  for (const id of ["cg-t", "cg-o", "cg-b"]) assert.ok(svg.includes(`id="${id}"`), `falta el degradado ${id}`);
  assert.match(svg, /aria-label="CONtexto Ganadero"/);
});

test("las dos formas de recortarlo: baldosa redondeada o cuadrado a sangre", () => {
  assert.match(logoSvg(), /rx="24"/);
  const completo = logoSvg({ fondo: "completo" });
  assert.doesNotMatch(completo, /rx="/, "el cuadrado a sangre no lleva esquinas: el sistema le pone su máscara");
  assert.ok(logoSvg().length > completo.length - 1, "la baldosa redondeada añade el filo de luz");
});

test("la escala encoge solo las letras, desde el centro, para la zona segura de los íconos maskable", () => {
  assert.doesNotMatch(logoSvg(), /scale\(/);
  assert.match(logoSvg({ escala: 0.78 }), /translate\(50 50\) scale\(0\.78\) translate\(-50 -50\)/);
});

test("el data URI se puede abrir como imagen SVG", () => {
  const uri = logoDataUri({ fondo: "completo", escala: 0.9 });
  assert.ok(uri.startsWith("data:image/svg+xml;base64,"));
  const svg = Buffer.from(uri.split(",")[1], "base64").toString("utf8");
  assert.equal(svg, logoSvg({ fondo: "completo", escala: 0.9 }));
});

// Lee ancho y alto de la cabecera de un PNG (bytes 16 a 24).
function medidasPng(archivo: string) {
  const b = readFileSync(logo(archivo));
  assert.equal(b.subarray(1, 4).toString("latin1"), "PNG");
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

test("los PNG que piden las redes y los buscadores existen con la medida correcta", () => {
  assert.deepEqual(medidasPng("contexto-ganadero-logo-512.png"), { ancho: 512, alto: 512 });
  assert.deepEqual(medidasPng("contexto-ganadero-og.png"), { ancho: 1200, alto: 630 });
});
