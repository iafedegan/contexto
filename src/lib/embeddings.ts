import "server-only";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";

// Proveedor de embeddings. Por defecto Gemini (`gemini-embedding-001`, pedido a 1536 dimensiones para no tocar la base); `EMBEDDING_PROVIDER=openai`
// conserva el camino anterior (`text-embedding-3-small`). Los vectores de un modelo NO son comparables con los de otro: todas las notas y todas las
// consultas deben salir del mismo proveedor.
const proveedor = () => (process.env.EMBEDDING_PROVIDER === "openai" ? "openai" : "gemini");
const modelo = () => process.env.EMBEDDING_MODEL ?? (proveedor() === "openai" ? "text-embedding-3-small" : "gemini-embedding-001");

// Limpia el texto y lo recorta al máximo que se envía al modelo.
const limpiar = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 8000);

// Pausa entre reintentos.
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gemini devuelve el vector sin normalizar cuando se pide menos de 3072 dimensiones: se normaliza (norma 1) para que la distancia coseno sea fiable. */
const normalizar = (v: number[]) => {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
};

type Peticion = { url: string; headers: Record<string, string>; body: string; leer: (json: unknown) => (number[] | undefined)[] };

// Dónde buscar la clave cuando no está en el entorno (la que un administrador guardó en el panel). La conecta `src/lib/oyentes.ts`: este módulo
// no puede conocer al de IA, así que recibe la función ya hecha.
type ResolutorClave = (proveedor: "openai" | "gemini") => Promise<string | null>;
let resolutorDeRespaldo: ResolutorClave | null = null;
/** Conecta la búsqueda de la clave guardada en el panel (la llama el cableado de arranque). */
export function registrarClaveDeRespaldo(fn: ResolutorClave) {
  resolutorDeRespaldo = fn;
}

/** Clave del proveedor de embeddings: la del entorno o, si no hay, la que un administrador guardó en Configuración › Inteligencia artificial. */
async function claveEmbeddings(): Promise<string | null> {
  const delEntorno = proveedor() === "openai" ? process.env.OPENAI_API_KEY : process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (delEntorno) return delEntorno;
  try {
    return (await resolutorDeRespaldo?.(proveedor())) ?? null;
  } catch {
    return null;
  }
}

async function armarPeticion(textos: string[], tarea: "consulta" | "documento"): Promise<Peticion | null> {
  const key = await claveEmbeddings();
  if (!key) return null;
  if (proveedor() === "openai") {
    return {
      url: "https://api.openai.com/v1/embeddings",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: modelo(), input: textos.map(limpiar) }),
      leer: (j) => {
        const data = (j as { data?: Array<{ embedding: number[]; index?: number }> }).data ?? [];
        const out: (number[] | undefined)[] = textos.map(() => undefined);
        for (const [i, d] of data.entries()) out[typeof d.index === "number" ? d.index : i] = d.embedding;
        return out;
      },
    };
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${modelo()}:batchEmbedContents`,
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      requests: textos.map((t) => ({
        model: `models/${modelo()}`,
        content: { parts: [{ text: limpiar(t) }] },
        taskType: tarea === "consulta" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    }),
    leer: (j) => ((j as { embeddings?: Array<{ values?: number[] }> }).embeddings ?? []).map((e) => (e.values ? normalizar(e.values) : undefined)),
  };
}

/**
 * Pide los embeddings de uno o varios textos en UNA petición (devuelve un vector por texto, en el mismo orden). Tiene tiempo máximo y, si se pide
 * más de un intento, reintenta con espera creciente ante un 429 o un 5xx. Sin clave configurada, o si la API falla, devuelve `null` en cada
 * posición: la búsqueda cae a solo texto y nada se rompe.
 */
async function pedirEmbeddings(textos: string[], { intentos, timeoutMs, tarea }: { intentos: number; timeoutMs: number; tarea: "consulta" | "documento" }): Promise<(number[] | null)[]> {
  const vacio = textos.map(() => null);
  const peticion = textos.length ? await armarPeticion(textos, tarea) : null;
  if (!peticion) return vacio;

  for (let intento = 0; intento < intentos; intento++) {
    try {
      const res = await fetch(peticion.url, { method: "POST", headers: peticion.headers, body: peticion.body, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 429 || res.status >= 500) {
        await esperar(500 * 2 ** intento);
        continue;
      }
      if (!res.ok) {
        console.error("embeddings: fallo del proveedor", proveedor(), res.status);
        return vacio;
      }
      const vectores = peticion.leer(await res.json());
      return textos.map((_, i) => {
        const v = vectores[i];
        if (v?.length === EMBEDDING_DIMENSIONS) return v;
        if (v) console.error("embeddings: dimensión inesperada", v.length);
        return null;
      });
    } catch (e) {
      console.error("embeddings: sin respuesta del proveedor", proveedor(), (e as Error)?.name ?? e);
      await esperar(500 * 2 ** intento);
    }
  }
  return vacio;
}

/**
 * Genera un embedding (1536 dims; Gemini por defecto, OpenAI si EMBEDDING_PROVIDER=openai). Se aísla aquí para poder cambiar
 * de proveedor sin tocar el resto del código. Si no hay API key configurada
 * devuelve `null` y la búsqueda cae a solo texto (nunca rompe el portal).
 */
export async function embed(text: string): Promise<number[] | null> {
  // Camino interactivo (una búsqueda espera esta respuesta): un solo intento y poco tiempo.
  return (await pedirEmbeddings([text], { intentos: 1, timeoutMs: 8_000, tarea: "consulta" }))[0];
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
    salida.push(...(await pedirEmbeddings(textos.slice(i, i + EMBEDDINGS_POR_PETICION), { intentos: 3, timeoutMs: 30_000, tarea: "documento" })));
  }
  return salida;
}

/** Indica si hay un proveedor de embeddings configurado. */
export const embeddingsDisponibles = async () => Boolean(await claveEmbeddings());

/** Formatea un vector JS al literal que pgvector espera: `[0.1,0.2,...]`. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
