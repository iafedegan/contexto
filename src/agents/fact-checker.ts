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

/**
 * Verificador POR REGLAS (sin IA). Recorre los datos estructurados de la fuente
 * y comprueba, valor por valor, si aparecen literalmente en el borrador. Marca
 * como NO verificado lo que el borrador afirma pero la fuente no contiene
 * (p. ej. una variación porcentual que hay que calcular).
 */
export function ruleFactCheck(
  draftText: string,
  payload: Record<string, unknown>,
): FactCheck[] {
  const haystack = normalize(draftText);
  const checks: FactCheck[] = [];

  for (const { path, value } of flatten(payload)) {
    if (typeof value !== "number" && typeof value !== "string") continue;
    if (typeof value === "string" && value.length < 3) continue;

    const candidates = valueVariants(value);
    const hitInDraft = candidates.some((c) => haystack.includes(normalize(c)));
    // ¿El borrador siquiera menciona este dato? Si no lo usa, no es un problema.
    if (!hitInDraft && !mentionsField(haystack, path)) continue;

    checks.push({
      claim: path,
      value: String(value),
      verified: hitInDraft,
      sourceQuote: hitInDraft ? `dato estructurado: ${path} = ${String(value)}` : null,
      note: hitInDraft
        ? null
        : "El borrador afirma este dato pero no coincide literalmente con la fuente; revisar.",
    });
  }

  // Marcas explícitas {{ }} que el generador dejó para el editor.
  for (const m of draftText.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    checks.push({
      claim: "Dato señalado por el agente",
      value: m[1],
      verified: false,
      sourceQuote: null,
      note: "El generador marcó este punto como no confirmable con la fuente.",
    });
  }

  return checks;
}

function flatten(obj: unknown, prefix = ""): Array<{ path: string; value: unknown }> {
  if (Array.isArray(obj)) {
    return obj.flatMap((v, i) => flatten(v, `${prefix}[${i}]`));
  }
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return [{ path: prefix, value: obj }];
}

function valueVariants(value: string | number): string[] {
  if (typeof value === "string") return [value];
  return [
    String(value),
    value.toLocaleString("es-CO"),
    value.toLocaleString("en-US"),
    value.toLocaleString("es-CO").replace(/\./g, ""),
  ];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function mentionsField(haystack: string, path: string): boolean {
  const leaf = path.split(/[.\[]/).pop()?.replace(/\W/g, "") ?? "";
  return leaf.length > 3 && haystack.includes(normalize(leaf));
}
