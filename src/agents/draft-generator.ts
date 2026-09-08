import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentDrafts, type agentSource } from "@/db/schema";
import { DRAFT_GENERATOR_SYSTEM } from "./prompts";
import { factCheckDraft } from "./fact-checker";

const MODEL = process.env.ASSISTANT_MODEL ?? "claude-sonnet-5";
const DAILY_LIMIT = Number(process.env.AGENT_DAILY_DRAFT_LIMIT ?? "20");

type Source = (typeof agentSource.enumValues)[number];

const draftSchema = z.object({
  title: z.string().min(8),
  excerpt: z.string().min(20),
  body: z.string().min(50),
  claims: z.array(z.object({ claim: z.string(), value: z.string() })),
});

export type StructuredSource = {
  kind: Source;
  ref: string; // URL o identificador legible de la fuente
  payload: Record<string, unknown>; // datos estructurados de entrada
  rawText: string; // texto de la fuente para el verificador
};

/**
 * Genera un BORRADOR desde una fuente estructurada y lo deja en la cola de
 * aprobación (`agent_drafts.status = 'pendiente'`). Nunca publica.
 * Aplica el tope diario configurable.
 */
export async function generateDraft(source: StructuredSource): Promise<{ id: string } | { skipped: string }> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(agentDrafts)
    .where(and(gte(agentDrafts.createdAt, startOfDay)));
  if (n >= DAILY_LIMIT) return { skipped: `tope diario de ${DAILY_LIMIT} borradores alcanzado` };

  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: draftSchema,
    system: DRAFT_GENERATOR_SYSTEM,
    prompt: `FUENTE (${source.kind}) — ${source.ref}\n\nDATOS ESTRUCTURADOS:\n${JSON.stringify(
      source.payload,
      null,
      2,
    )}\n\nTEXTO ORIGINAL:\n${source.rawText}`,
  });

  // Agente verificador: contrasta cada cifra contra la fuente.
  const checks = await factCheckDraft(
    `${object.title}\n\n${object.excerpt}\n\n${object.body}`,
    source.rawText,
  );
  const hasUnverified = checks.some((c) => !c.verified);

  const [row] = await db
    .insert(agentDrafts)
    .values({
      source: source.kind,
      sourceRef: source.ref,
      sourcePayload: source.payload,
      modelVersion: MODEL,
      title: object.title,
      excerpt: object.excerpt,
      body: object.body,
      factChecks: checks,
      hasUnverifiedClaims: hasUnverified,
      status: "pendiente",
    })
    .returning({ id: agentDrafts.id });

  return { id: row.id };
}
