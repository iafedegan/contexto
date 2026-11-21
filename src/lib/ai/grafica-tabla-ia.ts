import "server-only";

/**
 * Gráfica desde una tabla subida (Excel o CSV): la IA mira los encabezados y unas filas de muestra y decide qué columna son las etiquetas, qué
 * columnas graficar, el título, la unidad y el tipo que mejor cuenta los datos. Los NÚMEROS no pasan por el modelo: se leen de la tabla
 * (`grafica-tabla.ts`), así que no hay forma de que invente una cifra. Sin modelo o sin cuota, se elige de forma sencilla.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "@/lib/ai-provider";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";
import { aplicarTipo, chartProblem, renderChartSvg, type TipoGrafica } from "@/lib/chart-svg";
import { eleccionSencilla, graficaDeTabla, leerTabla, type Tabla } from "@/lib/grafica-tabla";
import type { ChartResult } from "@/lib/ai/grafica";

const eleccionSchema = z.object({
  etiquetas: z.number().int().describe("índice de la columna con las etiquetas (categorías o periodos)"),
  series: z.array(z.number().int()).min(1).max(4).describe("índices de las columnas numéricas que se grafican"),
  titulo: z.string().describe("título periodístico, claro y corto, sin inventar datos"),
  unidad: z.string().describe("unidad de los valores (cabezas, $/kg, toneladas, %…), o vacío"),
  tipo: z.enum(["bar", "line", "pie"]),
});

export async function graficaDesdeTablaCore(
  userId: string,
  input: { tabla: Tabla; nombre: string; pedido?: string; tipo?: TipoGrafica; fuente?: string },
): Promise<ChartResult> {
  const tabla = (Array.isArray(input.tabla) ? input.tabla : []).slice(0, 300).map((f) => (Array.isArray(f) ? f.slice(0, 30).map((c) => String(c ?? "").slice(0, 80)) : []));
  const l = leerTabla(tabla);
  if (!l.numericas.length) return { ok: false, error: "No encontré columnas con números en ese archivo. La tabla debe tener una columna de nombres o fechas y al menos una de cifras." };
  const nombre = String(input.nombre ?? "archivo").slice(0, 80);
  const fuente = (input.fuente?.trim() || `Datos: ${nombre}`).slice(0, 160);
  let eleccion = { ...eleccionSencilla(l, nombre), fuente };

  const model = await getAiModel().catch(() => null);
  if (model && (await verificarCuotaIA(userId)).ok) {
    try {
      const muestra = l.filas.slice(0, 8).map((f) => f.join(" | ")).join("\n");
      const columnas = l.encabezados.map((h, i) => `${i}: ${h} (${l.numericas.includes(i) ? "números" : "texto"})`).join("\n");
      const { object, usage } = await generateObject({
        model,
        schema: eleccionSchema,
        prompt: `Eres editor de datos de un medio ganadero colombiano. Con esta tabla hay que hacer UNA gráfica para una nota.${input.pedido?.trim() ? `\nQuien redacta pide: ${input.pedido.trim().slice(0, 300)}` : ""}\n\nCOLUMNAS:\n${columnas}\n\nPRIMERAS FILAS:\n${muestra}\n\nElige la columna de etiquetas, de 1 a 4 columnas numéricas que cuenten lo más importante (no mezcles magnitudes distintas en una misma gráfica), un título claro en español, la unidad y el tipo: barras para comparar, línea para evolución en el tiempo, torta solo para partes de un total en un mismo periodo.`,
      });
      await registrarUsoIA(userId, usage);
      const series = object.series.filter((i) => l.numericas.includes(i) && i !== object.etiquetas);
      if (object.etiquetas >= 0 && object.etiquetas < l.encabezados.length && series.length) {
        eleccion = { etiquetas: object.etiquetas, series, titulo: object.titulo, unidad: object.unidad, tipo: object.tipo, fuente };
      }
    } catch (e) {
      console.warn("graficaDesdeTabla (modelo):", (e as Error)?.message ?? e);
    }
  }

  const base = graficaDeTabla(l, eleccion);
  if ("error" in base) return { ok: false, error: base.error };
  const forma = aplicarTipo(base, input.tipo ?? "auto");
  if (!forma.ok) return { ok: false, error: forma.error };
  const problema = chartProblem(forma.chart);
  if (problema) return { ok: false, error: `Los datos no sirven para graficar: ${problema}` };
  return { ok: true, chart: forma.chart, sourceNote: fuente, sources: [], svg: renderChartSvg(forma.chart) };
}
