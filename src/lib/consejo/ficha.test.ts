import test from "node:test";
import assert from "node:assert/strict";
import { evaluarFicha, fichaParaPrompt, sanearFicha } from "@/lib/consejo/plan";

test("una ficha vacía no está lista y dice qué falta", () => {
  const e = evaluarFicha({});
  assert.equal(e.lista, false);
  assert.equal(e.avance, 0);
  assert.deepEqual(e.faltanObligatorias, ["¿De qué trata, en una frase?", "¿Por qué ahora?", "¿A quién le importa y qué cambia para él?", "Fuentes previstas", "Preguntas que la nota debe responder"]);
});

test("con lo obligatorio la ficha queda lista; el resto solo suma al avance", () => {
  const f = sanearFicha({ foco: "El ICA abre el segundo ciclo de vacunación porque subió el riesgo de aftosa", porQueAhora: "El ciclo empieza el lunes 19 de octubre", audiencia: "Ganaderos de la costa: deben vacunar antes del 30", fuentes: [{ nombre: "ICA", tipo: "documento", url: "https://www.ica.gov.co/x" }], preguntas: ["¿Cuándo empieza el ciclo?", "¿Quién debe vacunar y dónde?"] });
  const e = evaluarFicha(f);
  assert.equal(e.lista, true);
  assert.ok(e.avance > 30 && e.avance < 100);
  assert.ok(e.faltanOpcionales.includes("Palabra clave de enfoque"));
});

test("sanearFicha descarta basura, enlaces raros y valores fuera de rango", () => {
  const f = sanearFicha({ foco: "<b>Foco</b>  largo", fuentes: [{ nombre: "X", url: "javascript:alert(1)" }, { nombre: "" }], genero: "chisme", palabras: 99999, preguntas: ["a bien larga pregunta", 5, null], vigencia: "hoy" });
  assert.equal(f.foco, "b Foco /b largo");
  assert.deepEqual(f.fuentes, [{ nombre: "X", tipo: "voz" }]);
  assert.equal(f.genero, undefined);
  assert.equal(f.palabras, undefined);
  assert.deepEqual(f.preguntas, ["a bien larga pregunta"]);
  assert.equal(f.vigencia, "hoy");
});

test("fichaParaPrompt convierte la ficha en un encargo estructurado", () => {
  const t = fichaParaPrompt(sanearFicha({ foco: "El foco de la nota", abiertas: ["¿Cuánto costará?"], fuentes: [{ nombre: "ICA", tipo: "documento", url: "https://www.ica.gov.co/x" }] }));
  assert.match(t, /FICHA DE PAUTA/);
  assert.match(t, /FOCO: El foco de la nota/);
  assert.match(t, /LO QUE AÚN NO SE SABE/);
  assert.match(t, /ICA \(documento\/dato oficial\) https:\/\/www\.ica\.gov\.co\/x/);
});

import { briefParaPrompt, respondidas, sanearBrief, sanearConfig, CONFIG_BASE } from "@/lib/consejo/plan";

test("las respuestas del consejo a una sección se validan y se vuelven texto para la IA", () => {
  const b = sanearBrief({ temas: "sequía y pasturas", palabras: 450, generos: ["noticia", "analisis", "chisme", "noticia"], tono: "Técnico y de datos", audiencia: "nadie", alcance: "Colombia", evitar: "<b>cifras sin fuente</b>" });
  assert.equal(b.palabras, 450);
  assert.deepEqual(b.generos, ["noticia", "analisis"]);
  assert.equal(b.audiencia, undefined);
  assert.equal(respondidas(b), 6);
  const t = briefParaPrompt("Ganadería", b);
  assert.match(t, /SECCIÓN «Ganadería»/);
  assert.match(t, /unas 450 palabras/);
  assert.match(t, /Géneros: Noticia, Análisis/);
  assert.equal(briefParaPrompt("X", {}), "");
});

test("la configuración conserva las respuestas por sección y descarta las secciones inválidas", () => {
  const c = sanearConfig({ ...CONFIG_BASE, briefs: { ganaderia: { temas: "aftosa", palabras: 600 }, "mala sección": { temas: "x" }, vacia: {} } });
  assert.deepEqual(c.briefs, { ganaderia: { temas: "aftosa", palabras: 600 } });
});
