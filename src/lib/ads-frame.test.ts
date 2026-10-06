import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SANDBOX_ANUNCIO, documentoPublicitario } from "@/lib/ads-frame";

test("el sandbox permite ejecutar el anuncio y abrirlo en pestaña nueva, y nada más (H-26)", () => {
  const permisos = SANDBOX_ANUNCIO.split(" ");
  assert.deepEqual(permisos.sort(), ["allow-popups", "allow-popups-to-escape-sandbox", "allow-scripts"]);
  for (const prohibido of ["allow-same-origin", "allow-top-navigation", "allow-top-navigation-by-user-activation", "allow-forms", "allow-modals", "allow-downloads", "allow-popups-to-escape-sandbox-x"]) {
    assert.ok(!permisos.includes(prohibido), `no debe incluir ${prohibido}`);
  }
});

test("el documento del anuncio es completo, abre los enlaces en pestaña nueva y no filtra la página de origen", () => {
  const doc = documentoPublicitario('<a href="https://anunciante.example/oferta"><img src="https://anunciante.example/b.png"></a>');
  assert.match(doc, /^<!doctype html>/i);
  assert.match(doc, /<base target="_blank">/);
  assert.match(doc, /name="referrer" content="no-referrer"/);
  assert.ok(doc.includes('<a href="https://anunciante.example/oferta">'));
  assert.ok(doc.indexOf("<body>") < doc.indexOf("anunciante.example/oferta"));
});

test("toda acción de la pauta exige ser administrador: es lo que justifica admitir HTML sin filtrar (H-26)", () => {
  const codigo = readFileSync("src/app/panel/(app)/configuracion/ads-actions.ts", "utf8");
  const acciones = [...codigo.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
  assert.ok(acciones.length >= 4, "se esperaban al menos 4 acciones exportadas");
  for (const [, nombre, cuerpo] of acciones) {
    assert.match(cuerpo, /await requireRole\("administrador"\)/, `${nombre} debe exigir el rol de administrador`);
  }
});
