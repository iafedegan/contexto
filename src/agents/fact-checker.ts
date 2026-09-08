import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { FACT_CHECKER_SYSTEM } from "./prompts";

const MODEL = process.env.ASSISTANT_MODEL ?? "claude-sonnet-5";

const checksSchema = z.object({
  checks: z.array(
    z.object({
      claim: z.string(),
      value: z.string(),
      verified: z.boolean(),
      sourceQuote: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
});

export type FactCheck = z.infer<typeof checksSchema>["checks"][number];

/**
 * Contrasta cada cifra / fecha / nombre / cita del borrador contra el texto de
 * la fuente original. Lo no verificable queda marcado (verified:false) para que
 * el editor lo vea en la cola de aprobación.
 */
export async function factCheckDraft(draftText: string, sourceText: string): Promise<FactCheck[]> {
  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: checksSchema,
      system: FACT_CHECKER_SYSTEM,
      prompt: `BORRADOR:\n${draftText}\n\n---\n\nFUENTE ORIGINAL:\n${sourceText}`,
    });
    return object.checks;
  } catch (e) {
    console.error("fact-checker falló", e);
    // Si el verificador falla, se marca todo como no verificado (conservador).
    return [
      {
        claim: "Verificación automática",
        value: "no disponible",
        verified: false,
        sourceQuote: null,
        note: "El agente verificador no pudo ejecutarse; requiere revisión manual completa.",
      },
    ];
  }
}
