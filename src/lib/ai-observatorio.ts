import "server-only";
import { getIndicadores } from "@/lib/indicadores-fedegan";
import { getObservatorio } from "@/lib/observatorio-fedegan";
import { buscarFragmentos, fragmentosDelObservatorio } from "@/lib/observatorio-fragmentos";

/**
 * Lo que el asistente puede citar del Observatorio para una pregunta: precios, inventario por departamento, producción,
 * consumo, mercado internacional, costos y documentos. Lee lo mismo que la página (caché de datos), así que responde con las
 * mismas cifras que ve el lector. Si el origen no responde, simplemente no aporta fuentes y el asistente sigue con las notas.
 */
export type FuenteObservatorio = { title: string; url: string; kind: "observatorio"; summary: string };

export async function buscarEnObservatorio(pregunta: string, k = 4): Promise<FuenteObservatorio[]> {
  const [precios, obs] = await Promise.all([getIndicadores().catch(() => []), getObservatorio()]);
  return buscarFragmentos(fragmentosDelObservatorio(precios, obs), pregunta, k).map((f) => ({
    title: f.titulo,
    url: f.url,
    kind: "observatorio" as const,
    summary: f.texto,
  }));
}
