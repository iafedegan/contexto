"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

type Source = { n: number; title: string; url: string; kind: "articulo" | "archivo"; summary: string };
type Msg = {
  role: "user" | "assistant";
  text: string;
  mode?: "declined" | "degraded" | "generativo";
  sources?: Source[];
};

const SUGGESTIONS = [
  "¿Cómo van los precios del novillo gordo en Medellín?",
  "¿Qué es un sistema silvopastoril?",
  "Calendario de vacunación contra fiebre aftosa",
];

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
      const data = (await res.json()) as { mode: Msg["mode"]; answer: string; sources: Source[] };
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
    <div className="flex flex-col gap-5">
      {messages.length === 0 && (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] p-5">
          <p className="text-sm text-[var(--ink-soft)]">
            Pregunta sobre precios, regiones, normativa o cualquier tema cubierto por CONtexto
            Ganadero. Cada respuesta cita sus fuentes; si no hay fuentes, el asistente no responde.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => !busy && send(s)}
                className="rounded-full border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--ink-soft)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex flex-col items-end gap-1" : "flex flex-col gap-2"}
          >
            {m.role === "user" ? (
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--brand)] px-4 py-2.5 text-sm text-[var(--brand-fg)]">
                {m.text}
              </p>
            ) : (
              <>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand)]">
                  Asistente
                </span>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">
                  {m.text}
                </p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-3.5 text-sm">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-faint)]">
                      Fuentes{m.mode === "degraded" ? " · búsqueda semántica" : ""}
                    </p>
                    <ol className="flex flex-col gap-1.5">
                      {m.sources.map((s) => (
                        <li key={s.n} className="flex gap-2">
                          <span className="text-[var(--ink-faint)]">{s.n}.</span>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--brand-strong)] underline decoration-1 underline-offset-2 hover:text-[var(--brand)]"
                          >
                            {s.title}
                          </a>
                          {s.kind === "archivo" && (
                            <span className="text-[11px] font-semibold uppercase text-[var(--ink-faint)]">
                              archivo
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-[var(--ink-faint)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand)]" />
            Buscando en el archivo…
          </p>
        )}
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
        className="sticky bottom-4 flex gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-md)]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={busy}
          className="flex-1 bg-transparent px-3.5 text-sm outline-none placeholder:text-[var(--ink-faint)]"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
