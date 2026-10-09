import test from "node:test";
import assert from "node:assert/strict";
import { armarUbicacion, posicionesDePortada } from "@/lib/ubicacion-nota";

// 15 notas por orden de portada; las dos primeras las fijó un editor.
const orden = Array.from({ length: 13 }, (_, i) => ({ slug: `n${i + 1}`, fijada: i < 2 }));

test("la portada reparte las notas en los mismos huecos que pinta la portada", () => {
  const m = posicionesDePortada(orden);
  assert.equal(m.size, 13);
  assert.deepEqual(m.get("n1"), { zona: "principal", posicion: 1, fijadaPorEditor: true });
  assert.deepEqual(m.get("n2"), { zona: "secundaria", posicion: 2, fijadaPorEditor: true });
  for (const s of ["n3", "n4", "n5", "n6"]) assert.equal(m.get(s)?.zona, "en_breve", s);
  for (const s of ["n7", "n8", "n13"]) assert.equal(m.get(s)?.zona, "rio", s);
  assert.equal(m.get("n3")?.fijadaPorEditor, false, "las que entran por fecha no están fijadas");
  assert.equal(m.get("n14"), undefined, "fuera de la portada no hay entrada");
  assert.deepEqual([...m.keys()].slice(0, 3), ["n1", "n2", "n3"], "el mapa conserva el orden de la portada");
});

test("una portada corta (pocas notas) no inventa huecos", () => {
  const m = posicionesDePortada([{ slug: "a", fijada: false }]);
  assert.deepEqual([...m.values()].map((v) => v.zona), ["principal"]);
  assert.equal(posicionesDePortada([]).size, 0);
});

test("la ubicación dice dónde está la nota: portada, sección, última hora, en vivo y más leídas", () => {
  const u = armarUbicacion({
    categoria: { slug: "ganaderia", nombre: "Noticias" },
    padre: null,
    portada: posicionesDePortada(orden).get("n4"),
    marcadaUltimaHora: true,
    enBarra: true,
    enVivo: false,
    masLeidas: 2,
  });
  assert.deepEqual(u, {
    portada: { esta: true, zona: "en_breve", posicion: 4, fijadaPorEditor: false },
    seccion: { slug: "ganaderia", nombre: "Noticias", padre: null },
    ultimaHora: { marcada: true, enBarra: true },
    enVivo: false,
    masLeidas: { esta: true, posicion: 2 },
  });
});

test("una nota fuera de portada, sin sección y sin distintivos sale con todo en «no», nunca sin el campo", () => {
  const u = armarUbicacion({ categoria: null, padre: null, portada: undefined, marcadaUltimaHora: false, enBarra: false, enVivo: false, masLeidas: undefined });
  assert.deepEqual(u.portada, { esta: false, zona: null, posicion: null, fijadaPorEditor: false });
  assert.equal(u.seccion, null);
  assert.deepEqual(u.masLeidas, { esta: false, posicion: null });
});

test("una subsección trae la sección de la que cuelga", () => {
  const u = armarUbicacion({
    categoria: { slug: "porcicola", nombre: "Porcícola" },
    padre: { slug: "sistemas-pecuarios", nombre: "Sistemas pecuarios" },
    portada: undefined,
    marcadaUltimaHora: false,
    enBarra: false,
    enVivo: true,
    masLeidas: undefined,
  });
  assert.deepEqual(u.seccion, { slug: "porcicola", nombre: "Porcícola", padre: { slug: "sistemas-pecuarios", nombre: "Sistemas pecuarios" } });
  assert.equal(u.enVivo, true);
});
