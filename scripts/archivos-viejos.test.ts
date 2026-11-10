import test from "node:test";
import assert from "node:assert/strict";
import { clasificar, extension, nombreObjeto, normalizar, referencias, reescribir } from "./migracion/archivos-viejos";

test("normaliza las direcciones del sitio anterior, también las mal armadas por la migración", () => {
  assert.equal(normalizar("http://storage.contextoganadero.com/s3fs-public/imce/2014-12/yogurt_1.jpg"), "https://storage.contextoganadero.com/s3fs-public/imce/2014-12/yogurt_1.jpg");
  assert.equal(normalizar("http://www.contextoganadero.comhttps://storage.contextoganadero.com/s3fs-public/imce/2014-09/toro_economia.jpg"), "https://storage.contextoganadero.com/s3fs-public/imce/2014-09/toro_economia.jpg");
  assert.equal(normalizar("http://contextoganadero.comhttps://storage.contextoganadero.com/a/b.jpg"), "https://storage.contextoganadero.com/a/b.jpg");
  assert.equal(normalizar("https://static.contextoganadero.com/imagenes clasificados/30_10_2017.jpg"), "https://static.contextoganadero.com/imagenes%20clasificados/30_10_2017.jpg");
  assert.equal(normalizar("https://static.contextoganadero.com/imagenes%20clasificados/x.jpg"), "https://static.contextoganadero.com/imagenes%20clasificados/x.jpg");
  assert.equal(normalizar("http://static.contextoganadero.com.s3.amazonaws.com/Publicaciones/carta.pdf?v=2"), "https://static.contextoganadero.com.s3.amazonaws.com/Publicaciones/carta.pdf");
  assert.equal(normalizar("https://static.contextoganadero.com/Publicaciones/Anexo2-Instructivo_inscripción.pdf"), "https://static.contextoganadero.com/Publicaciones/Anexo2-Instructivo_inscripci%C3%B3n.pdf");
});

test("lo que no es del sitio anterior no se toca", () => {
  assert.equal(normalizar("https://www.contextoganadero.com/economia/otra-nota"), null);
  assert.equal(normalizar("https://apnnoticias.com/foto.jpg"), null);
  assert.equal(normalizar("https://cguzwzffmzxubfruulem.supabase.co/storage/v1/object/public/media/mig-a.webp"), null);
  assert.equal(normalizar("/logo/contexto-ganadero-og.png"), null);
});

test("clasifica por extensión: copiar, páginas HTML o desconocido", () => {
  assert.equal(clasificar("https://static.contextoganadero.com/Publicaciones/a.PDF"), "copiar");
  assert.equal(clasificar("https://static.contextoganadero.com/videos/recetas/14_MILANESA.webm"), "copiar");
  assert.equal(clasificar("https://static.contextoganadero.com/crucigrama/Crucigrama24/index.html"), "html");
  assert.equal(clasificar("https://static.contextoganadero.com/Pavic/"), "desconocida");
  assert.equal(extension("https://static.contextoganadero.com/Publicaciones/Cartilla_Monta_Estacional.PDF"), "pdf");
});

test("el nombre del objeto es estable, sin carpetas y con la extensión", () => {
  const a = "https://static.contextoganadero.com/Publicaciones/a.pdf";
  assert.equal(nombreObjeto(a), nombreObjeto(a));
  assert.match(nombreObjeto(a), /^leg-[0-9a-f]{24}\.pdf$/);
  assert.notEqual(nombreObjeto(a), nombreObjeto("https://static.contextoganadero.com/Publicaciones/b.pdf"));
});

test("reescribe solo lo que tiene copia y deja el resto del texto igual", () => {
  const html =
    '<p>Mire <a href="https://static.contextoganadero.com/Publicaciones/carta.pdf" rel="noopener">la carta</a> y ' +
    '<img src="http://www.contextoganadero.comhttps://storage.contextoganadero.com/a/b.jpg" alt="x"> ' +
    '<iframe src="https://static.contextoganadero.com/crucigrama/C1/index.html"></iframe> <a href="https://otra.com/x.pdf">ajena</a></p>';
  assert.equal(referencias(html).length, 3);
  const r = reescribir(html, (o) => (o.endsWith(".pdf") || o.endsWith(".jpg") ? `https://nuevo/${nombreObjeto(o)}` : null));
  assert.equal(r.cambios, 2);
  assert.ok(!r.html.includes("static.contextoganadero.com/Publicaciones"));
  assert.ok(!r.html.includes("comhttps"));
  assert.ok(r.html.includes("crucigrama/C1/index.html"), "la página HTML sin copia queda como estaba");
  assert.ok(r.html.includes("https://otra.com/x.pdf"), "lo ajeno no se toca");
});
