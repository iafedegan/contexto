import test from "node:test";
import assert from "node:assert/strict";
import { construirPrompt, construirPromptMezcla, ESTILO_POR_DEFECTO, estiloValido } from "./prompt-escena";

const base = { titulo: "Arranca el ciclo de vacunación", resumen: "Más de 606.000 predios en todo el país", escena: "Un vacunador revisa el ganado en un corral al amanecer" };

test("el prompt reúne tema, escena, encuadre, cámara, luz, composición, calidad y restricciones", () => {
  const p = construirPrompt(base);
  for (const parte of ["«Arranca el ciclo de vacunación»", "ESCENA:", "ENCUADRE:", "CÁMARA Y LENTE:", "ILUMINACIÓN:", "COMPOSICIÓN:", "CALIDAD:", "RESTRICCIONES:", "16:9", "Sin texto"]) {
    assert.ok(p.includes(parte), `falta «${parte}»`);
  }
});

test("el tratamiento, la cámara y la luz elegidos se reflejan en el prompt", () => {
  const p = construirPrompt({ ...base, estilo: { tratamiento: "sepia", camara: "analogica", plano: "primer", luz: "contraluz", ambiente: "dramatico" } });
  assert.match(p, /sepia/i);
  assert.match(p, /Kodak Portra/);
  assert.match(p, /primer plano/i);
  assert.match(p, /contraluz/i);
  assert.match(p, /tonos monocromáticos/, "en sepia o blanco y negro la luz se interpreta en monocromo");
});

test("las indicaciones del equipo entran en el prompt, recortadas", () => {
  const p = construirPrompt({ ...base, estilo: { notas: "incluir una cerca de madera   y neblina " + "x".repeat(900) } });
  assert.match(p, /INDICACIONES DEL EQUIPO: incluir una cerca de madera y neblina/);
  assert.ok(p.length < 3000);
});

test("un estilo que llega del navegador se sanea: lo desconocido vuelve al valor por defecto", () => {
  const e = estiloValido({ tratamiento: "inventado", camara: 5, plano: "medio", luz: null, notas: "ok" });
  assert.equal(e.tratamiento, ESTILO_POR_DEFECTO.tratamiento);
  assert.equal(e.camara, ESTILO_POR_DEFECTO.camara);
  assert.equal(e.plano, "medio");
  assert.equal(e.luz, ESTILO_POR_DEFECTO.luz);
  assert.equal(e.notas, "ok");
  assert.deepEqual(estiloValido(undefined), ESTILO_POR_DEFECTO);
});

test("el prompt de mezcla usa las fotos como materia prima: las funde, no hace collage y no prohíbe sus personas", () => {
  const p = construirPromptMezcla({ titulo: "Arranca el ciclo de vacunación", cantidad: 3, instruccion: "El vacunador en primer plano y el hato al fondo", plan: "Foto 1: vacunador; foto 2: corral." });
  assert.match(p, /las 3 fotos adjuntas/);
  assert.match(p, /CADA una de las 3 fotos/);
  assert.match(p, /collage/i);
  assert.match(p, /INSTRUCCIÓN DE LA REDACCIÓN/);
  assert.match(p, /PROPUESTA DE COMPOSICIÓN/);
  assert.doesNotMatch(p, /Sin personas reales identificables/, "las fotos pueden traer personas reales");
  assert.doesNotMatch(p, /no agregues/i);
  assert.match(construirPromptMezcla({ titulo: "Una nota", cantidad: 1 }), /la foto adjunta/);
});
