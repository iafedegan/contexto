import { test } from "node:test";
import assert from "node:assert/strict";
import { ESQUEMAS, PALETA, PLANTILLAS, celdasTabla, duplicarElemento, elementoNuevo, esBloque, rutaPagina, sanearPagina, urlSegura, type TipoBloque } from "@/lib/paginas-bloques";

test("rutaPagina: uno o dos tramos, sin acentos ni símbolos", () => {
  assert.equal(rutaPagina("Prueba/Página Nueva!"), "prueba/pagina-nueva");
  assert.equal(rutaPagina("/a//b/c"), "a/b");
  assert.equal(rutaPagina("Solo"), "solo");
});

test("urlSegura: rutas del sitio, http(s), mailto y tel; nada de javascript:", () => {
  assert.equal(urlSegura("/contacto"), "/contacto");
  assert.equal(urlSegura("javascript:alert(1)"), "");
  assert.equal(urlSegura("//evil.com"), "");
  assert.equal(urlSegura("mailto:a@b.co"), "mailto:a@b.co");
  assert.equal(urlSegura("https://x.co/a"), "https://x.co/a");
});

test("cada elemento de la paleta nace válido y sobrevive al saneado (los bloques, tal cual)", () => {
  for (const g of PALETA)
    for (const { tipo } of g.items) {
      const e = elementoNuevo(tipo);
      const c = sanearPagina({ filas: [{ id: "f1", columnas: [12], celdas: [[e]] }] });
      const s = c.filas[0].celdas[0][0];
      assert.ok(s, tipo);
      assert.equal(s.tipo, tipo);
      if (esBloque(e)) assert.deepEqual(s, e, tipo);
    }
});

test("el saneado de un bloque descarta campos desconocidos, opciones inválidas y enlaces peligrosos", () => {
  const c = sanearPagina({
    filas: [{ id: "f1", columnas: [12], celdas: [[{ id: "e1", tipo: "tarjetas", p: { columnas: "9", estilo: "x", raro: "1" }, items: [{ titulo: "Hola", url: "javascript:x", otro: "z" }] }]] }],
  });
  const e = c.filas[0].celdas[0][0];
  assert.ok(esBloque(e));
  assert.equal(e.p.columnas, "3");
  assert.equal(e.p.estilo, "sombra");
  assert.equal("raro" in e.p, false);
  assert.equal(e.items[0].titulo, "Hola");
  assert.equal(e.items[0].url, "");
  assert.equal("otro" in e.items[0], false);
});

test("las filas inválidas se descartan y las opciones de fila se sanean", () => {
  const c = sanearPagina({ filas: [{ columnas: [6, 5], celdas: [] }, { id: "ok", columnas: [6, 6], celdas: [[], []], fondo: "imagen", fondoImagen: "javascript:x", espaciado: "raro" }] });
  assert.equal(c.filas.length, 1);
  assert.equal(c.filas[0].fondoImagen, undefined);
  assert.equal(c.filas[0].espaciado, "normal");
});

test("plantillas y duplicados dan ids nuevos", () => {
  for (const t of PLANTILLAS) {
    const f = t.crear();
    assert.equal(f.columnas.reduce((a, b) => a + b, 0), 12, t.id);
    assert.equal(sanearPagina({ filas: [f] }).filas.length, 1, t.id);
  }
  const e = elementoNuevo("carrusel");
  const d = duplicarElemento(e);
  assert.notEqual(d.id, e.id);
  assert.ok(esBloque(d) && esBloque(e) && d.items[0]._id !== e.items[0]._id);
});

test("todos los bloques del esquema están en la paleta", () => {
  const enPaleta = new Set(PALETA.flatMap((g) => g.items.map((i) => i.tipo)));
  for (const t of Object.keys(ESQUEMAS) as TipoBloque[]) assert.ok(enPaleta.has(t), t);
});

test("celdasTabla parte por líneas y por «|»", () => {
  assert.deepEqual(celdasTabla("a | b\n\n c|d "), [["a", "b"], ["c", "d"]]);
});

test("sanearPagina: notas quitadas de la sección (únicas, sin basura y solo si hay alguna)", () => {
  assert.deepEqual(sanearPagina({ filas: [], ocultas: ["nota-a", "nota-a", 3, "con espacio", "", "nota-b"] }).ocultas, ["nota-a", "nota-b"]);
  assert.equal("ocultas" in sanearPagina({ filas: [], ocultas: [] }), false);
  assert.equal("ocultas" in sanearPagina({ filas: [] }), false);
});
