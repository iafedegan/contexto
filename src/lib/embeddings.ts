import "server-only";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";

// Modelo de embeddings: configurable por entorno, por defecto text-embedding-3-small.
const MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

// Limpia el texto y lo recorta al máximo que se envía al modelo.
const limpiar = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 8000);

// Pausa entre reintentos.
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pide los embeddings de uno o varios textos en UNA petición (la API acepta una lista y devuelve un vector por
 * texto, en el mismo orden). Tiene tiempo máximo y, si se pide más de un intento, reintenta con espera creciente ante
 * un 429 o un 5xx. Sin clave configurada, o si la API falla, devuelve `null` en cada posición: la búsqueda cae a solo
 * texto y nada se rompe.
 */
async function pedirEmbeddings(textos: string[], { intentos, timeoutMs }: { intentos: number; timeoutMs: number }): Promise<(number[] | null)[]> {
  const vacio = textos.map(() => null);
  const key = process.env.OPENAI_API_KEY;
  if (!key || !textos.length) return vacio;

  for (let intento = 0; intento < intentos; intento++) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, input: textos.map(limpiar) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        await esperar(500 * 2 ** intento);
        continue;
      }
      if (!res.ok) {
        console.error("embeddings: fallo OpenAI", res.status);
        return vacio;
      }
      const json = (await res.json()) as { data?: Array<{ embedding: number[]; index?: number }> };
      const salida: (number[] | null)[] = textos.map(() => null);
      for (const [i, d] of (json.data ?? []).entries()) {
        const pos = typeof d.index === "number" ? d.index : i;
        if (pos >= 0 && pos < salida.length && d.embedding?.length === EMBEDDING_DIMENSIONS) salida[pos] = d.embedding;
        else console.error("embeddings: dimensión inesperada", d.embedding?.length);
      }
      return salida;
    } catch (e) {
      console.error("embeddings: sin respuesta de OpenAI", (e as Error)?.name ?? e);
      await esperar(500 * 2 ** intento);
    }
  }
  return vacio;
}

/**
 * Genera un embedding con OpenAI (1536 dims). Se aísla aquí para poder cambiar
 * de proveedor sin tocar el resto del código. Si no hay API key configurada
 * devuelve `null` y la búsqueda cae a solo texto (nunca rompe el portal).
 */
export async function embed(text: string): Promise<number[] | null> {
  // Camino interactivo (una búsqueda espera esta respuesta): un solo intento y poco tiempo.
  return (await pedirEmbeddings([text], { intentos: 1, timeoutMs: 8_000 }))[0];
}

/** Máximo de textos por petición: deja margen bajo el límite de tokens por petición de la API. */
export const EMBEDDINGS_POR_PETICION = 32;

/**
 * Embeddings de muchos textos, en lotes de `EMBEDDINGS_POR_PETICION` por petición (y no uno por uno): la sincronización
 * del archivo histórico necesita decenas de miles. Devuelve un vector (o `null`) por texto, en el mismo orden.
 */
export async function embedMany(textos: string[]): Promise<(number[] | null)[]> {
  const salida: (number[] | null)[] = [];
  for (let i = 0; i < textos.length; i += EMBEDDINGS_POR_PETICION) {
    // Trabajo en segundo plano: se puede esperar y reintentar.
    salida.push(...(await pedirEmbeddings(textos.slice(i, i + EMBEDDINGS_POR_PETICION), { intentos: 3, timeoutMs: 30_000 })));
  }
  return salida;
}

/** Indica si hay un proveedor de embeddings configurado. */
export const embeddingsDisponibles = () => Boolean(process.env.OPENAI_API_KEY);

/** Formatea un vector JS al literal que pgvector espera: `[0.1,0.2,...]`. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
