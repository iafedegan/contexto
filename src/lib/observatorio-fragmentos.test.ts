import test from "node:test";
import assert from "node:assert/strict";
import { buscarFragmentos, fragmentosDelObservatorio, palabrasClave } from "@/lib/observatorio-fragmentos";
import type { Indicador } from "@/lib/indicadores-fedegan";
import type { Observatorio } from "@/lib/observatorio-fedegan";

const precios: Indicador[] = [
  { clave: "gordo", titulo: "Ganado gordo (nacional)", descripcion: "Precio por kilo en pie", unidad: "$/kg", periodos: ["ago/2026", "sep/2026"], series: [{ nombre: "Nacional", valores: [9690, 9721] }], fuente: "FEDEGÁN" },
  { clave: "flaco-machos", titulo: "Ganado flaco machos", descripcion: "Precio por región", unidad: "$/kg", periodos: ["sep/2026"], series: [{ nombre: "Llanos Orientales", valores: [11826] }, { nombre: "Caribe", valores: [10490] }], fuente: "FEDEGÁN" },
];
const obs: Observatorio = {
  generales: [
    { clave: "sacrificio", grupo: "produccion", titulo: "Sacrificio de bovinos", descripcion: "Formal e informal", unidad: "miles de cabezas", formato: "entero", forma: "linea", periodos: ["2024", "2025"], series: [{ nombre: "Formal", valores: [3234, 3430] }], fuente: "FEDEGÁN", mensual: false },
  ],
  departamental: [{ clave: "bovinos", titulo: "Inventario bovino", unidad: "cabezas", periodos: ["2024", "2025"], departamentos: [{ nombre: "Antioquia", valores: [2200000, 2300000] }, { nombre: "Casanare", valores: [2100000, 2150000] }], nacional: [30100000, 29702709] }],
  hato: [{ clave: "animales", titulo: "Animales por orientación del hato", periodo: "2025", partes: [{ nombre: "Cría", valor: 60 }, { nombre: "Ceba", valor: 40 }] }],
  documentos: [{ codigo: "001", titulo: "Coyuntura ganadera", documentos: [{ archivo: "Informe", fecha: "2025", url: "https://x" }] }],
};
const frag = fragmentosDelObservatorio(precios, obs);

test("cada indicador del Observatorio sale como fragmento con su cifra más reciente y el enlace a su sección", () => {
  assert.equal(frag.length, 6);
  const gordo = frag.find((f) => f.titulo.includes("gordo"))!;
  assert.match(gordo.texto, /septiembre de 2026.*Nacional: \$9\.721/);
  assert.equal(gordo.url, "/observatorio#precios");
  assert.equal(frag.find((f) => f.titulo.includes("Sacrificio"))!.url, "/observatorio#produccion");
  const inv = frag.find((f) => f.titulo.includes("por departamento"))!;
  assert.match(inv.texto, /Total nacional: 29\.702\.709.*Antioquia 2\.300\.000; Casanare 2\.150\.000/);
  assert.match(frag.find((f) => f.titulo.includes("Documentos"))!.texto, /Coyuntura ganadera/);
  assert.match(frag.find((f) => f.titulo.includes("orientación"))!.texto, /Cría 60 \(60,0 %\)/);
});

test("las palabras clave quitan las vacías y los plurales", () => {
  assert.deepEqual(palabrasClave("¿Cuántos bovinos hay en Antioquia?"), ["bovino", "antioqu"]);
});

test("la pregunta encuentra el fragmento que la responde", () => {
  assert.match(buscarFragmentos(frag, "¿Cuántos bovinos hay en Antioquia?")[0].titulo, /Inventario bovino por departamento/);
  assert.match(buscarFragmentos(frag, "precio del ganado gordo en septiembre")[0].titulo, /gordo/);
  assert.match(buscarFragmentos(frag, "¿Dónde está más caro el flaco, Llanos Orientales?")[0].titulo, /flaco/);
  assert.match(buscarFragmentos(frag, "informes de coyuntura ganadera")[0].titulo, /Documentos/);
  assert.match(buscarFragmentos(frag, "sacrificio de bovinos 2025")[0].titulo, /Sacrificio/);
});

test("lo que no tiene que ver con el Observatorio no trae nada, y devuelve como mucho k", () => {
  assert.deepEqual(buscarFragmentos(frag, "receta de arepas con queso"), []);
  assert.deepEqual(buscarFragmentos(frag, "¿qué?"), []);
  assert.ok(buscarFragmentos(frag, "ganado precio bovinos", 2).length <= 2);
});
