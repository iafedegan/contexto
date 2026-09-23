import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentDrafts, type agentSource } from "@/db/schema";
import { DRAFT_GENERATOR_SYSTEM } from "./prompts";
import { factCheckDraft, ruleFactCheck, type FactCheck } from "./fact-checker";
import { env } from "@/lib/env";

const MODEL = env(process.env.ASSISTANT_MODEL, "claude-sonnet-5");
const DAILY_LIMIT = Number(env(process.env.AGENT_DAILY_DRAFT_LIMIT, "20"));
const HAS_LLM = Boolean(process.env.ANTHROPIC_API_KEY);

type Source = (typeof agentSource.enumValues)[number];

const draftSchema = z.object({
  title: z.string().min(8),
  excerpt: z.string().min(20),
  body: z.string().min(50),
});

export type StructuredSource = {
  kind: Source;
  ref: string; // URL o identificador legible de la fuente
  payload: Record<string, unknown>; // datos estructurados de entrada
  rawText: string; // texto de la fuente para el verificador
};

type Draft = { title: string; excerpt: string; body: string };

export type GenerateResult =
  | { id: string; mode: "ia" | "simulacion"; hasUnverifiedClaims: boolean }
  | { skipped: string };

/**
 * Genera un BORRADOR desde una fuente estructurada y lo deja en la cola de
 * aprobación (`agent_drafts.status = 'pendiente'`). Nunca publica.
 *
 * Con ANTHROPIC_API_KEY usa el LLM (redacción + verificador). Sin clave, usa un
 * generador determinista por plantilla + verificador por reglas: el flujo
 * completo (fuente → borrador → verificación → cola) queda igual de demostrable.
 */
export async function generateDraft(source: StructuredSource): Promise<GenerateResult> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(agentDrafts)
    .where(and(gte(agentDrafts.createdAt, startOfDay)));
  if (n >= DAILY_LIMIT) return { skipped: `tope diario de ${DAILY_LIMIT} borradores alcanzado` };

  const mode: "ia" | "simulacion" = HAS_LLM ? "ia" : "simulacion";
  let draft: Draft;
  let checks: FactCheck[];

  if (HAS_LLM) {
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
    draft = object;
    checks = await factCheckDraft(`${draft.title}\n\n${draft.excerpt}\n\n${draft.body}`, source.rawText);
  } else {
    draft = simulateDraft(source);
    checks = ruleFactCheck(`${draft.title}\n${draft.excerpt}\n${draft.body}`, source.payload);
  }

  const hasUnverified = checks.some((c) => !c.verified);

  const [row] = await db
    .insert(agentDrafts)
    .values({
      source: source.kind,
      sourceRef: source.ref,
      sourcePayload: source.payload,
      modelVersion: HAS_LLM ? MODEL : "simulacion-plantilla-v1",
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.body,
      factChecks: checks,
      hasUnverifiedClaims: hasUnverified,
      status: "pendiente",
    })
    .returning({ id: agentDrafts.id });

  return { id: row.id, mode, hasUnverifiedClaims: hasUnverified };
}

// --- Generador por plantilla (sin IA) --------------------------------------

const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString("es-CO") : String(v));
const money = (v: unknown) =>
  typeof v === "number" ? v.toLocaleString("es-CO") + " pesos" : String(v);
const longDate = (iso: unknown) => {
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC", // la fuente da fechas sin hora; evitar corrimiento por zona
      });
};
const dayNum = (iso: unknown) => new Date(String(iso)).getUTCDate();

function simulateDraft(source: StructuredSource): Draft {
  const p = source.payload;

  if (source.kind === "boletin_precios") {
    const cats = (p.categorias as Array<{ nombre: string; precio_kg_cop: number }>) ?? [];
    const novillo = cats.find((c) => /novillo/i.test(c.nombre)) ?? cats[0];
    const filas = cats
      .map((c) => `<li>${c.nombre}: ${c.precio_kg_cop.toLocaleString("es-CO")} pesos por kilo en pie.</li>`)
      .join("");
    return {
      title: `El novillo gordo en ${p.plaza} se cotizó en ${novillo?.precio_kg_cop.toLocaleString("es-CO")} pesos por kilo`,
      excerpt: `El boletín de precios de la semana ${p.semana} reportó los valores de referencia para las principales categorías en la plaza de ${p.plaza}.`,
      body:
        `<p>Según el boletín de precios de ${p.fuente}, con cierre el ${longDate(p.fecha_cierre)}, ` +
        `el novillo gordo en ${p.plaza} se cotizó en ${novillo?.precio_kg_cop.toLocaleString("es-CO")} pesos por kilo en pie.</p>` +
        `<h2>Valores de referencia</h2><ul>${filas}</ul>` +
        `<p>El volumen movilizado en la semana fue de ${(p.volumen_cabezas as number)?.toLocaleString("es-CO")} cabezas. ` +
        `La variación frente a la semana anterior {{no está disponible en la fuente}} y debe calcularse antes de publicar.</p>`,
    };
  }

  if (source.kind === "comunicado") {
    const bio = (p.biologicos as string[])?.join(" y ");
    return {
      title: String(p.titulo ?? "Comunicado del gremio"),
      excerpt: `El gremio informó las fechas y condiciones del próximo ciclo de vacunación contra ${bio}.`,
      body:
        `<p>El próximo ciclo de vacunación se realizará entre el ${longDate(p.fecha_inicio)} y el ${longDate(p.fecha_fin)}.</p>` +
        `<h2>Alcance</h2><p>Se aplicarán biológicos contra ${bio}. La meta de cobertura es del ${p.meta_cobertura_pct} % ` +
        `sobre un hato objetivo de ${num(p.hato_objetivo_millones)} millones de animales.</p>` +
        `<p>La tarifa por dosis aplicada será de ${money(p.tarifa_dosis_cop)}. La información proviene de ${p.vocero}.</p>`,
    };
  }

  if (source.kind === "convocatoria") {
    return {
      title: String(p.nombre ?? "Nueva convocatoria de financiación"),
      excerpt: `${p.entidad} abrió una línea de crédito para ${p.beneficiarios} con una bolsa de ${num(p.monto_bolsa_millones_cop)} millones de pesos.`,
      body:
        `<p>${p.entidad} abrió la ${p.nombre}. La bolsa de recursos es de ${num(p.monto_bolsa_millones_cop)} millones de pesos.</p>` +
        `<h2>Condiciones</h2><ul>` +
        `<li>Tasa: ${p.tasa_ea_pct} % efectivo anual.</li>` +
        `<li>Plazo: ${p.plazo_meses} meses, con ${p.periodo_gracia_meses} meses de periodo de gracia.</li>` +
        `<li>Dirigida a ${p.beneficiarios}.</li></ul>` +
        `<p>La convocatoria abre el ${longDate(p.apertura)} y cierra el ${longDate(p.cierre)}.</p>`,
    };
  }

  // agenda_ferias
  return {
    title: `${p.evento} se realizará en ${p.ciudad} del ${dayNum(p.fecha_inicio)} al ${longDate(p.fecha_fin)}`,
    excerpt: `El evento reunirá a cerca de ${p.expositores_estimados} expositores e incluirá ${p.subastas} subastas.`,
    body:
      `<p>${p.evento} se celebrará del ${longDate(p.fecha_inicio)} al ${longDate(p.fecha_fin)} en ${p.recinto}, en ${p.ciudad}.</p>` +
      `<p>Se esperan ${p.expositores_estimados} expositores y se realizarán ${p.subastas} subastas. ` +
      `El remate de genética está programado para el ${longDate(p.remate_genetica)}.</p>`,
  };
}
