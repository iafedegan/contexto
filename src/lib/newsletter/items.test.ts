import test from "node:test";
import assert from "node:assert/strict";
import { MAX_NOTAS, MAX_SECCIONES, agruparEnSecciones, itemsDeSlugs, sanitizarItems, slugsDeItems, tieneSecciones } from "@/lib/newsletter/items";

test("lo que llega se limpia: tipos conocidos, títulos recortados, notas sin repetir", () => {
  const r = sanitizarItems([
    { t: "s", titulo: "  Última   hora " },
    { t: "n", slug: "nota-uno" },
    { t: "n", slug: "nota-uno" },
    { t: "n", slug: "../malo" },
    { t: "x", slug: "otra" },
    { t: "s", titulo: "   " },
    "texto",
    null,
    { t: "n", slug: 7 },
  ]);
  assert.deepEqual(r, [{ t: "s", titulo: "Última hora" }, { t: "n", slug: "nota-uno" }, { t: "s", titulo: "Sección" }]);
  assert.deepEqual(sanitizarItems("no es una lista"), []);
  assert.equal(sanitizarItems([{ t: "s", titulo: "x".repeat(300) }])[0].t === "s" && (sanitizarItems([{ t: "s", titulo: "x".repeat(300) }])[0] as { titulo: string }).titulo.length, 80);
});

test("hay máximos de notas y de secciones", () => {
  const muchas = Array.from({ length: 40 }, (_, i) => ({ t: "n", slug: `nota-${i}` }));
  assert.equal(slugsDeItems(sanitizarItems(muchas)).length, MAX_NOTAS);
  const secs = Array.from({ length: 30 }, (_, i) => ({ t: "s", titulo: `S${i}` }));
  assert.equal(sanitizarItems(secs).length, MAX_SECCIONES);
});

test("las notas se agrupan bajo su encabezado; las de antes del primero y las secciones vacías se tratan bien", () => {
  const items = sanitizarItems([
    { t: "n", slug: "suelta" },
    { t: "s", titulo: "Última hora" },
    { t: "n", slug: "nota-a" },
    { t: "n", slug: "nota-b" },
    { t: "s", titulo: "Vacía" },
    { t: "s", titulo: "Economía" },
    { t: "n", slug: "nota-c" },
    { t: "n", slug: "despublicada" },
  ]);
  const por = new Map(["suelta", "nota-a", "nota-b", "nota-c"].map((s) => [s, { slug: s }]));
  const g = agruparEnSecciones(items, por);
  assert.deepEqual(g.map((x) => [x.titulo, x.articulos.map((a) => a.slug)]), [[null, ["suelta"]], ["Última hora", ["nota-a", "nota-b"]], ["Economía", ["nota-c"]]]);
  assert.equal(tieneSecciones(items), true);
  assert.equal(tieneSecciones(itemsDeSlugs(["nota-a", "nota-b"])), false);
  assert.deepEqual(slugsDeItems(items), ["suelta", "nota-a", "nota-b", "nota-c", "despublicada"]);
});

test("las operaciones del armado: añadir, mover, colocar, quitar y traer secciones", async () => {
  const m = await import("@/lib/newsletter/items");
  const base = m.sanitizarItems([{ t: "n", slug: "nota-1" }, { t: "s", titulo: "Economía" }, { t: "n", slug: "nota-2" }]);
  assert.equal(m.anadirNota(base, "nota-2"), base, "una nota repetida no se añade");
  assert.deepEqual(m.slugsDeItems(m.anadirNota(base, "nota-3")), ["nota-1", "nota-2", "nota-3"]);
  assert.deepEqual(m.moverItem(base, 1, 1).map((x) => (x.t === "s" ? x.titulo : x.slug)), ["nota-1", "nota-2", "Economía"], "el encabezado se mueve como una nota");
  assert.equal(m.moverItem(base, 0, -1), base);
  assert.deepEqual(m.colocarNota(base, "nota-2", 0).map((x) => (x.t === "s" ? x.titulo : x.slug)), ["nota-2", "nota-1", "Economía"]);
  assert.deepEqual(m.colocarNota(base, "nota-9", 2).map((x) => (x.t === "s" ? x.titulo : x.slug)), ["nota-1", "Economía", "nota-9", "nota-2"]);
  assert.deepEqual(m.quitarItem(base, 1).map((x) => (x.t === "s" ? x.titulo : x.slug)), ["nota-1", "nota-2"]);
  assert.equal((m.renombrarSeccion(base, 1, "Mercado")[1] as { titulo: string }).titulo, "Mercado");
  assert.deepEqual(m.slugsDeItems(m.anadirSeccion(base, "Última hora", ["nota-1", "nota-7", "nota-8"])), ["nota-1", "nota-2", "nota-7", "nota-8"]);

  const todas = [
    { slug: "col-1", seccion: "Colombia", publishedAt: "2026-10-12T10:00:00Z", esUltimaHora: false },
    { slug: "col-2", seccion: "Colombia", publishedAt: "2026-10-13T10:00:00Z", esUltimaHora: false },
    { slug: "eco-1", seccion: "Economía", publishedAt: "2026-10-11T10:00:00Z", esUltimaHora: true },
    { slug: "col-3", seccion: "Colombia", publishedAt: "2026-10-10T10:00:00Z", esUltimaHora: false },
    { slug: "col-4", seccion: "Colombia", publishedAt: "2026-10-09T10:00:00Z", esUltimaHora: false },
  ];
  assert.deepEqual(m.notasDeSeccion(todas, "Colombia", m.itemsDeSlugs(["col-2"])), ["col-1", "col-3", "col-4"], "las más recientes, sin repetir las que ya están");
  assert.deepEqual(m.notasDeUltimaHora(todas, []), ["eco-1", "col-2", "col-1"], "primero las marcadas, luego las más recientes");
  // Máximos.
  const lleno = m.itemsDeSlugs(Array.from({ length: 12 }, (_, i) => `nota-${i}`));
  assert.equal(m.anadirNota(lleno, "otra-nota"), lleno);
  assert.equal(m.colocarNota(lleno, "otra-nota", 0), lleno);
  assert.equal(m.slugsDeItems(m.anadirSeccion(lleno, "X", ["nueva-1"])).length, 12);
});
