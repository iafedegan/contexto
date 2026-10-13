import test from "node:test";
import assert from "node:assert/strict";
import { ESTILO_VACIO, aVista, bloqueEstilo, contarPalabras, estiloClave, type Diagnostico, type EstiloEscritura } from "@/lib/ai/estilo-tipos";

const diagnostico: Diagnostico = {
  resumen: "Escribes con frases cortas y cercanas.",
  tono: ["cercano", "directo"],
  voz: "Primera persona del plural.",
  estructura: "Entradilla breve y datos al inicio.",
  ritmo: "Frases de 12 a 18 palabras.",
  vocabulario: "Coloquial y del campo.",
  aperturas: "Con un dato.",
  cierres: "Con una cita.",
  fortalezas: ["Claridad"],
  evitar: ["Adjetivos de relleno"],
  reglas: ["Abre con el dato más importante.", "Usa frases cortas."],
  muestras: 5,
  palabras: 4000,
  generadoEn: "2026-10-13T00:00:00.000Z",
};
const estilo = (p: Partial<EstiloEscritura>): EstiloEscritura => ({ fuentes: [], diagnostico, activo: true, ...p });

test("el estilo se guarda por persona", () => {
  assert.equal(estiloClave("abc"), "estilo_escritura:abc");
});

test("sin diagnóstico o apagado no se añade nada al modelo", () => {
  assert.equal(bloqueEstilo(null), "");
  assert.equal(bloqueEstilo(ESTILO_VACIO), "");
  assert.equal(bloqueEstilo(estilo({ activo: false })), "");
});

test("con diagnóstico activo se añade solo estilo de forma y se respeta la veracidad", () => {
  const b = bloqueEstilo(estilo({}));
  assert.match(b, /las reglas de veracidad.*mandan siempre/s);
  assert.match(b, /Tono: cercano; directo\./);
  assert.match(b, /- Abre con el dato más importante\./);
});

test("al navegador no viaja el texto completo de las muestras", () => {
  const v = aVista(estilo({ fuentes: [{ id: "1", tipo: "texto", titulo: "t", texto: "secreto", palabras: 1, en: "2026-10-13" }] }));
  assert.equal("texto" in v.fuentes[0], false);
  assert.equal(v.fuentes[0].titulo, "t");
});

test("cuenta palabras", () => {
  assert.equal(contarPalabras("uno dos  tres\ncuatro"), 4);
  assert.equal(contarPalabras(""), 0);
});
