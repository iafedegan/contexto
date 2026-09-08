"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button, Input } from "@/components/ui";

type Source = { n: number; title: string; url: string; kind: "articulo" | "archivo"; summary: string };
type Meta = { mode?: string; reason?: string; sources?: Source[] };

export function AssistantChat() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant", body: { sessionId } }),
  });

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--fg-muted)]">
            Pregunta sobre precios, regiones, normativa o cualquier tema cubierto por CONtexto
            Ganadero. Cada respuesta cita sus fuentes; si no hay fuentes, el asistente no responde.
          </p>
        )}

        {messages.map((m) => {
          const meta = (m.metadata ?? {}) as Meta;
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          return (
            <div key={m.id} className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                {m.role === "user" ? "Tú" : "Asistente"}
              </span>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{text}</p>

              {m.role === "assistant" && meta.sources && meta.sources.length > 0 && (
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-sm">
                  <p className="mb-1 font-semibold">
                    Fuentes{meta.mode === "degraded" ? " (búsqueda semántica)" : ""}
                  </p>
                  <ol className="list-decimal pl-5">
                    {meta.sources.map((s) => (
                      <li key={s.n}>
                        <a href={s.url} className="text-[var(--link)] underline" target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                        {s.kind === "archivo" && (
                          <span className="ml-1 text-xs text-[var(--fg-muted)]">(archivo)</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
        {busy && <p className="text-sm text-[var(--fg-muted)]">Buscando en el archivo…</p>}
        {error && <p className="text-sm text-[var(--danger)]">Ocurrió un error. Intenta de nuevo.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="sticky bottom-4 flex gap-2 bg-[var(--bg)] pt-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
