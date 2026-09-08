import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { db } from "@/db";
import { assistantQueries } from "@/db/schema";
import { hybridSearch } from "@/lib/search";
import { checkBudget, estimateCostUsd } from "@/lib/budget";
import { ASSISTANT_SYSTEM } from "@/agents/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.ASSISTANT_MODEL ?? "claude-sonnet-5";

type Body = { messages: UIMessage[]; sessionId: string };
type CitedSource = { title: string; url: string; kind: "articulo" | "archivo" };

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  const { messages, sessionId }: Body = await req.json();
  const question = lastUserText(messages);
  if (!question) return NextResponse.json({ error: "pregunta vacía" }, { status: 400 });

  const hits = await hybridSearch(question, 8).catch(() => []);
  const sources = hits.map((h, i) => ({
    n: i + 1,
    title: h.title,
    url: h.url,
    kind: h.kind,
    summary: h.summary,
  }));

  const budget = await checkBudget(sessionId);

  // Decidir el modo antes de abrir el stream.
  let mode: "declined" | "degraded" | "generativo";
  if (sources.length === 0) mode = "declined";
  else if (!budget.allowGeneration) mode = "degraded";
  else mode = "generativo";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({
        type: "message-metadata",
        messageMetadata: { mode, reason: budget.reason, sources },
      });

      if (mode === "declined") {
        emitText(
          writer,
          "No encontré fuentes en CONtexto Ganadero para responder eso con seguridad. " +
            "Prueba a reformular la pregunta o a usar otros términos.",
        );
        await logQuery(sessionId, question, "generativo", [], false, 0, 0);
        return;
      }

      if (mode === "degraded") {
        emitText(
          writer,
          "El asistente alcanzó su límite de uso por ahora, así que no genero una respuesta. " +
            "Estos son los contenidos más relevantes para tu pregunta (abajo).",
        );
        await logQuery(
          sessionId,
          question,
          "semantico_degradado",
          toCited(sources),
          true,
          0,
          0,
        );
        return;
      }

      const context = sources
        .map((s) => `[${s.n}] ${s.title}\nURL: ${s.url}\n${s.summary}`)
        .join("\n\n");

      const result = streamText({
        model: anthropic(MODEL),
        system: `${ASSISTANT_SYSTEM}\n\nFRAGMENTOS DE CONTEXTO:\n${context}`,
        messages: await convertToModelMessages(messages),
        temperature: 0.2,
        onFinish: async ({ usage, text }) => {
          const used = sources.filter((s) => text.includes(`[${s.n}]`));
          await logQuery(
            sessionId,
            question,
            "generativo",
            toCited(used.length ? used : sources),
            true,
            usage.inputTokens ?? 0,
            usage.outputTokens ?? 0,
          );
        },
      });

      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function emitText(writer: Parameters<Parameters<typeof createUIMessageStream>[0]["execute"]>[0]["writer"], text: string) {
  const id = crypto.randomUUID();
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

function toCited(s: Array<{ title: string; url: string; kind: "articulo" | "archivo" }>): CitedSource[] {
  return s.map((x) => ({ title: x.title, url: x.url, kind: x.kind }));
}

async function logQuery(
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
      sessionId,
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
