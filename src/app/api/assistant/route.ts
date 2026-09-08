import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { db } from "@/db";
import { assistantQueries } from "@/db/schema";
import { hybridSearch } from "@/lib/search";
import { checkBudget, estimateCostUsd } from "@/lib/budget";
import { ASSISTANT_SYSTEM } from "@/agents/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ASSISTANT_MODEL ?? "claude-sonnet-5";

type CitedSource = { title: string; url: string; kind: "articulo" | "archivo" };
type Body = { question: string; sessionId: string; history?: { role: string; content: string }[] };

export async function POST(req: Request) {
  const { question, sessionId }: Body = await req.json();
  const q = (question ?? "").trim();
  if (!q) return NextResponse.json({ error: "pregunta vacía" }, { status: 400 });

  const hits = await hybridSearch(q, 8).catch(() => []);
  const sources = hits.map((h, i) => ({
    n: i + 1,
    title: h.title,
    url: h.url,
    kind: h.kind,
    summary: h.summary,
  }));

  // 1. Sin fuentes -> declina (criterio de aceptación: 0 respuestas sin cita).
  if (sources.length === 0) {
    await log(sessionId, q, "generativo", [], false, 0, 0);
    return NextResponse.json({
      mode: "declined",
      answer:
        "No encontré fuentes en CONtexto Ganadero para responder eso con seguridad. " +
        "Prueba a reformular la pregunta o a usar otros términos.",
      sources: [],
    });
  }

  const budget = await checkBudget(sessionId);
  const hasLlmKey = Boolean(process.env.ANTHROPIC_API_KEY);

  // 2. Sin presupuesto o sin proveedor de IA -> búsqueda semántica sin generación.
  if (!budget.allowGeneration || !hasLlmKey) {
    await log(sessionId, q, "semantico_degradado", toCited(sources), true, 0, 0);
    return NextResponse.json({
      mode: "degraded",
      reason: hasLlmKey ? budget.reason : "sin_proveedor_ia",
      answer: hasLlmKey
        ? "El asistente alcanzó su límite de uso por ahora. Estos son los contenidos más relevantes para tu pregunta:"
        : "Modo búsqueda (no hay proveedor de IA configurado). Estos son los contenidos del archivo más relevantes:",
      sources,
    });
  }

  // 3. Generación con citación obligatoria.
  const context = sources
    .map((s) => `[${s.n}] ${s.title}\nURL: ${s.url}\n${s.summary}`)
    .join("\n\n");

  try {
    const { text, usage } = await generateText({
      model: anthropic(MODEL),
      system: `${ASSISTANT_SYSTEM}\n\nFRAGMENTOS DE CONTEXTO:\n${context}`,
      prompt: q,
      temperature: 0.2,
    });
    const used = sources.filter((s) => text.includes(`[${s.n}]`));
    await log(
      sessionId,
      q,
      "generativo",
      toCited(used.length ? used : sources),
      true,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
    );
    return NextResponse.json({ mode: "generativo", answer: text, sources });
  } catch (e) {
    console.error("asistente: fallo de generación", e);
    await log(sessionId, q, "semantico_degradado", toCited(sources), true, 0, 0);
    return NextResponse.json({
      mode: "degraded",
      reason: "error_generacion",
      answer: "No pude generar una respuesta ahora. Estos son los contenidos más relevantes:",
      sources,
    });
  }
}

function toCited(s: Array<{ title: string; url: string; kind: "articulo" | "archivo" }>): CitedSource[] {
  return s.map((x) => ({ title: x.title, url: x.url, kind: x.kind }));
}

async function log(
  sessionId: string,
  question: string,
  mode: "generativo" | "semantico_degradado",
  cited: CitedSource[],
  answered: boolean,
  inputTokens: number,
  outputTokens: number,
) {
  try {
    await db.insert(assistantQueries).values({
      sessionId: sessionId || "anon",
      question: question.slice(0, 2000),
      mode,
      citedSources: cited,
      answered,
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(inputTokens, outputTokens).toFixed(6),
    });
  } catch (e) {
    console.error("no se pudo registrar la consulta al asistente", e);
  }
}
