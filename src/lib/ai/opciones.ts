import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { EDITOR_ASSIST_SYSTEM } from "@/agents/prompts";
import { getAiModel } from "@/lib/ai-provider";
import { materialParaPrompt, type Material } from "@/lib/material-types";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";

const optionsSchema = z.object({
  titles: z.array(z.string().min(15).max(90)).min(4).max(5),
  contexts: z
    .array(z.object({ label: z.string().min(3).max(60), text: z.string().min(40).max(700) }))
    .min(3)
    .max(4),
});

// Opciones de títulos y contextos que propone el modelo, tipadas a partir del esquema.
export type TitleContextOptions = z.infer<typeof optionsSchema>;

// Resultado de proponer títulos y enfoques: las opciones o un error.
export type SuggestResult = ({ ok: true } & TitleContextOptions) | { ok: false; error: string };

/**
 * Del tema que da el periodista propone varios títulos y varios contextos
 * (enfoques de redacción) para que elija. No redacta la nota ni inventa
 * hechos: los contextos dicen QUÉ enfoque tomar y qué datos hay que
 * confirmar; lo que el periodista no aportó queda entre {{llaves}}.
 */
export async function suggestTitlesAndContextsCore(userId: string, input: {
  topic: string;
  section?: string;
  material?: Material[];
}): Promise<SuggestResult> {
  const topic = input.topic.trim();
  const mat = materialParaPrompt(input.material, 30_000);
  if (topic.length < 10 && !mat) return { ok: false, error: "Cuéntame el tema con un poco más de detalle (mínimo 10 caracteres)." };

  const model = await getAiModel();
  if (!model) {
    return { ok: false, error: "Para proponer opciones hace falta la clave del modelo (Configuración → Asistente)." };
  }
  try {
    const cuotaIA = await verificarCuotaIA(userId);
    if (!cuotaIA.ok) return { ok: false, error: cuotaIA.message };
    const { object, usage: uso2 } = await generateObject({
      model,
      schema: optionsSchema,
      system: EDITOR_ASSIST_SYSTEM,
      prompt: [
        input.section ? `SECCIÓN: ${input.section}` : "",
        topic ? `TEMA DEL PERIODISTA:\n${topic}` : "",
        mat ? `MATERIAL DE PARTIDA (entrevista o fuentes que cargó el periodista):\n${mat}` : "",
        "TAREA: propón entre 4 y 5 TÍTULOS distintos entre sí (de 15 a 65 caracteres; uno informativo con el hecho, uno con el dato, uno centrado en la consecuencia para el productor, uno en forma de pregunta o explicación). " +
          "Propón además entre 3 y 4 CONTEXTOS: cada uno es un enfoque de redacción distinto (p. ej. noticia de última hora, análisis para el productor, explicativo con antecedentes). " +
          "Cada contexto tiene una etiqueta corta y un texto de 2 a 4 frases que dice qué ángulo tomar, qué datos y fuentes hay que confirmar y a quién le importa. " +
          "NO inventes cifras, fechas, fuentes ni declaraciones y no uses llaves ni marcadores: si falta un dato, el contexto dice qué enfoque tomar sin él.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    await registrarUsoIA(userId, uso2);
    return { ok: true, ...object };
  } catch (err) {
    console.error("suggestTitlesAndContexts:", err);
    const detalle = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: detalle ? `El proveedor rechazó la petición: ${detalle.slice(0, 220)}` : "El modelo no respondió." };
  }
}

// --- Gráfica con datos reales (Gemini + búsqueda en Google) ----------------
