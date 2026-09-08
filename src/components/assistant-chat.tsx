"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

type Source = { n: number; title: string; url: string; kind: "articulo" | "archivo"; summary: string };
type Msg = {
  role: "user" | "assistant";
  text: string;
  mode?: "declined" | "degraded" | "generativo";
  sources?: Source[];
};

export function AssistantChat() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function send(question: string) {
    setBusy(true);
    setError(false);
    setMessages((m) => [...m, { role: "user", text: question }]);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        mode: Msg["mode"];
        answer: string;
        sources: Source[];
      };
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.answer, mode: data.mode, sources: data.sources },
      ]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--fg-muted)]">
            Pregunta sobre precios, regiones, normativa o cualquier tema cubierto por CONtexto
            Ganadero. Cada respuesta cita sus fuentes; si no hay fuentes, el asistente no responde.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              {m.role === "user" ? "Tú" : "Asistente"}
            </span>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.text}</p>

            {m.role === "assistant" && m.sources && m.sources.length > 0 && (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-sm">
                <p className="mb-1 font-semibold">
                  Fuentes{m.mode === "degraded" ? " (búsqueda semántica)" : ""}
                </p>
                <ol className="list-decimal pl-5">
                  {m.sources.map((s) => (
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
        ))}
        {busy && <p className="text-sm text-[var(--fg-muted)]">Buscando en el archivo…</p>}
        {error && <p className="text-sm text-[var(--danger)]">Ocurrió un error. Intenta de nuevo.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = input.trim();
          if (!q || busy) return;
          setInput("");
          void send(q);
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
