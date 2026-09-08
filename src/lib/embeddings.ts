import "server-only";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";

const MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

/**
 * Genera un embedding con OpenAI (1536 dims). Se aísla aquí para poder cambiar
 * de proveedor sin tocar el resto del código. Si no hay API key configurada
 * devuelve `null` y la búsqueda cae a solo texto (nunca rompe el portal).
 */
export async function embed(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const input = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, input }),
  });

  if (!res.ok) {
    console.error("embeddings: fallo OpenAI", res.status, await res.text());
    return null;
  }

  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  const vec = json.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIMENSIONS) {
    console.error("embeddings: dimensión inesperada", vec?.length);
    return null;
  }
  return vec;
}

/** Formatea un vector JS al literal que pgvector espera: `[0.1,0.2,...]`. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
