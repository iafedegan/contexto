import { formatear, pct, ultimoConDato, variacion, type Formato } from "@/lib/graficas";
import type { Indicador } from "@/lib/indicadores-fedegan";
import type { Observatorio } from "@/lib/observatorio-fedegan";

/**
 * El asistente responde con lo que hay en el Observatorio (precios, inventario por departamento, producción, consumo,
 * mercado internacional, costos y documentos de FEDEGÁN), no solo con las notas. Aquí cada indicador se convierte en un
 * FRAGMENTO de texto con sus cifras más recientes —la fuente que el asistente cita con su enlace a la sección—, y se
 * busca por coincidencia de palabras. Es todo puro: el asistente le pasa lo que ya leyó el Observatorio.
 */
export type Fragmento = { titulo: string; url: string; texto: string };

const SECCION: Record<string, string> = { produccion: "produccion", consumo: "consumo", internacional: "internacional", costos: "costos" };
const num = (v: number, formato: Formato = "entero") => formatear(v, formato);

// «sep/2026» → «septiembre de 2026» legible para el modelo y para quien lee la cita.
const MES: Record<string, string> = { ene: "enero", feb: "febrero", mar: "marzo", abr: "abril", may: "mayo", jun: "junio", jul: "julio", ago: "agosto", sep: "septiembre", oct: "octubre", nov: "noviembre", dic: "diciembre" };
const periodo = (p: string) => {
  const [m, a] = p.split("/");
  return a && MES[m.toLowerCase()] ? `${MES[m.toLowerCase()]} de ${a}` : p;
};

// Las series con dato en el último periodo, con su cifra y la variación frente al dato anterior.
function ultimasCifras(periodos: string[], series: { nombre: string; valores: (number | null)[] }[], formato: Formato, prefijo = "", max = 10): string {
  const i = ultimoConDato(series);
  if (i < 0) return "";
  const filas = series
    .filter((s) => s.valores[i] !== null && s.valores[i] !== undefined)
    .slice(0, max)
    .map((s) => {
      const d = variacion(s.valores, i);
      return `${s.nombre}: ${prefijo && formato !== "pesos" ? prefijo : ""}${num(s.valores[i] as number, formato)}${d === null ? "" : ` (${pct(d)} frente al dato anterior)`}`;
    });
  return `Último dato (${periodo(periodos[i])}): ${filas.join("; ")}.`;
}

/** Todo el Observatorio como fragmentos citables, cada uno con el enlace a su sección. */
export function fragmentosDelObservatorio(precios: Indicador[], obs: Observatorio): Fragmento[] {
  const f: Fragmento[] = [];

  for (const p of precios) {
    f.push({
      titulo: `Observatorio · ${p.titulo}`,
      url: "/observatorio#precios",
      texto: `${p.titulo}. ${p.descripcion}. Unidad: ${p.unidad}. ${ultimasCifras(p.periodos, p.series, "pesos")} Fuente: ${p.fuente}.`,
    });
  }

  for (const g of obs.generales) {
    f.push({
      titulo: `Observatorio · ${g.titulo}`,
      url: `/observatorio#${SECCION[g.grupo] ?? "observatorio"}`,
      texto: `${g.titulo}. ${g.descripcion}. Unidad: ${g.unidad}. ${ultimasCifras(g.periodos, g.series, g.formato, g.prefijo ?? "")} Fuente: ${g.fuente}.`,
    });
  }

  for (const d of obs.departamental) {
    const i = d.nacional.length - 1;
    const total = d.nacional[i];
    const deps = d.departamentos
      .filter((s) => s.valores[i] !== null && s.valores[i] !== undefined)
      .sort((a, b) => (b.valores[i] as number) - (a.valores[i] as number))
      .map((s) => `${s.nombre} ${num(s.valores[i] as number)}`);
    f.push({
      titulo: `Observatorio · ${d.titulo} por departamento`,
      url: "/observatorio#inventario",
      texto: `${d.titulo} por departamento, ${d.periodos[i] ?? ""} (${d.unidad}). Total nacional: ${total === null || total === undefined ? "sin dato" : num(total)}. De mayor a menor: ${deps.join("; ")}.`,
    });
  }

  for (const h of obs.hato) {
    const suma = h.partes.reduce((n, p) => n + p.valor, 0) || 1;
    f.push({
      titulo: `Observatorio · ${h.titulo}`,
      url: "/observatorio#inventario",
      texto: `${h.titulo}, ${h.periodo}: ${h.partes.map((p) => `${p.nombre} ${num(p.valor)} (${((p.valor / suma) * 100).toFixed(1).replace(".", ",")} %)`).join("; ")}.`,
    });
  }

  for (const b of obs.documentos) {
    f.push({
      titulo: `Observatorio · Documentos: ${b.titulo}`,
      url: "/observatorio#documentos",
      texto: `Biblioteca de documentos de FEDEGÁN «${b.titulo}» (${b.documentos.length} archivos descargables en la sección Documentos del Observatorio): ${b.documentos.map((d) => `${d.archivo} ${d.fecha}`.trim()).slice(0, 25).join("; ")}.`,
    });
  }
  return f;
}

// Palabras que no ayudan a encontrar nada.
const VACIAS = new Set(("de del la las el los un una unos unas y o u en a al por para con sin sobre entre que cual cuales cuanto cuantos cuanta cuantas como cuando donde quien quienes es son fue ser esta este estos estas hay ha han se lo le les su sus mi me mas menos muy ya si no segun dame dime sabes puedes").split(" "));

// Minúsculas, sin tildes y sin signos.
const limpiar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ$ ]+/g, " ");
// Raíz sencilla: sin plural ni terminación, para que «bovinos» encuentre «bovino» y «precios» encuentre «precio».
const raiz = (t: string) => t.replace(/(es|s)$/, "").slice(0, 7);

/** Las palabras que cuentan de una pregunta, ya con su raíz. */
export function palabrasClave(pregunta: string): string[] {
  return [...new Set(limpiar(pregunta).split(/\s+/).filter((t) => t.length >= 3 && !VACIAS.has(t)).map(raiz))];
}

/**
 * Los fragmentos que mejor responden a la pregunta: cada palabra suma 3 si está en el título y 1 si está en el texto (y la
 * pregunta por «observatorio» trae lo más general). Devuelve como mucho `k` y solo los que tienen alguna coincidencia real.
 */
export function buscarFragmentos(fragmentos: Fragmento[], pregunta: string, k = 4): Fragmento[] {
  const claves = palabrasClave(pregunta).filter((c) => c !== "observ");
  if (!claves.length) return [];
  const puntuados = fragmentos.map((fr, orden) => {
    const titulo = limpiar(fr.titulo);
    const texto = limpiar(fr.texto);
    let puntos = 0;
    let coincidencias = 0;
    for (const c of claves) {
      const enTitulo = titulo.includes(c);
      const enTexto = texto.includes(c);
      if (enTitulo) puntos += 3;
      if (enTexto) puntos += 1;
      if (enTitulo || enTexto) coincidencias += 1;
    }
    return { fr, puntos, coincidencias, orden };
  });
  // Con varias palabras, se pide que coincida más de una (o que coincida en el título): una sola palabra suelta en el texto no basta.
  const minimo = claves.length > 1 ? 2 : 1;
  return puntuados
    .filter((x) => x.coincidencias >= minimo || x.puntos >= 3)
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden)
    .slice(0, k)
    .map((x) => x.fr);
}
