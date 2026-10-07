import test from "node:test";
import assert from "node:assert/strict";
import { duracion, franja, horaEtiqueta, indiceDia, parte, variacionPct } from "@/lib/lectores-formato";
import { hallazgosAudiencia } from "@/lib/lectores-resumen";
import type { Panorama } from "@/lib/lectores-consulta";

test("las duraciones se leen como una persona las diría", () => {
  assert.equal(duracion(0), "0 s");
  assert.equal(duracion(45), "45 s");
  assert.equal(duracion(72), "1 min 12 s");
  assert.equal(duracion(120), "2 min");
  assert.equal(duracion(3720), "1 h 2 min");
  assert.equal(duracion(-5), "0 s");
});

test("las horas y franjas usan a. m. y p. m., con medianoche y mediodía correctos", () => {
  assert.equal(horaEtiqueta(0), "12 a. m.");
  assert.equal(horaEtiqueta(12), "12 p. m.");
  assert.equal(horaEtiqueta(13), "1 p. m.");
  assert.equal(franja(8), "8 a. m. a 9 a. m.");
  assert.equal(franja(23), "11 p. m. a 12 a. m.");
});

test("la semana empieza el lunes y las variaciones no dividen por cero", () => {
  assert.equal(indiceDia(1), 0, "lunes");
  assert.equal(indiceDia(0), 6, "domingo");
  assert.equal(variacionPct(150, 100), 50);
  assert.equal(variacionPct(5, 0), null);
  assert.equal(parte(1, 4), 25);
  assert.equal(parte(1, 0), 0);
});

const base = (o: Partial<Panorama["indicadores"]> = {}): Pick<Panorama, "indicadores" | "calor" | "dispositivos" | "fuentes" | "regiones" | "embudo"> => ({
  indicadores: { lecturas: 100, visitantes: 60, segundosMedios: 80, segundosMediana: 62, scrollMedio: 58, completas: 40, recurrentes: 35, rebotes: 10, ...o },
  calor: [{ dow: 2, hora: 8, n: 20 }, { dow: 5, hora: 21, n: 5 }],
  dispositivos: [{ clave: "mobile", lecturas: 70, visitantes: 40, scroll: 55, segundos: 70 }],
  fuentes: [{ clave: "Google", lecturas: 45, visitantes: 30, scroll: 60, segundos: 80 }],
  regiones: [{ clave: "ANT", lecturas: 30, visitantes: 20, scroll: 60, segundos: 70 }, { clave: "XX", lecturas: 90, visitantes: 50, scroll: 50, segundos: 60 }],
  embudo: { alcance: { lecturas: 100, a25: 80, a50: 60, a75: 45, completas: 40 }, tiempo: [], frecuencia: [] },
});

test("las frases del panel salen de las cifras: mejor franja, lectura completa, celular, fuente, recurrentes y departamento", () => {
  const h = hallazgosAudiencia(base());
  const t = h.map((x) => x.texto).join("\n");
  assert.match(t, /los martes, de 8 a\. m\. a 9 a\. m\. \(20 % de las lecturas\)/);
  assert.match(t, /40 % de las lecturas llegan hasta el final .* 1 min 2 s y baja el 58 %/);
  assert.match(t, /70 % lee desde el celular/);
  assert.match(t, /«Google» \(45 %/);
  assert.match(t, /35 % de las lecturas son de personas que ya habían leído antes: hay un público que vuelve/);
  assert.match(t, /Antioquia es el departamento con más lectura/, "ignora regiones que no son de Colombia");
  assert.equal(h.find((x) => /hasta el final/.test(x.texto))?.tono, "bien");
});

test("una tasa de rebote alta se marca como alerta y con muy pocas lecturas no se afirma nada", () => {
  const h = hallazgosAudiencia(base({ rebotes: 40 }));
  assert.equal(h.find((x) => /menos de 10 segundos/.test(x.texto))?.tono, "alerta");
  assert.deepEqual(hallazgosAudiencia(base({ lecturas: 3 })), []);
});
