"use client";

import { useState } from "react";
import { LogoMark } from "@/components/logo-mark";

type Source = { n: number; title: string; url: string; kind: "articulo" | "archivo"; summary: string };
type Msg = {
  role: "user" | "assistant";
  text: string;
  mode?: "declined" | "degraded" | "generativo";
  sources?: Source[];
};

const EJEMPLOS = [
  "¿Cómo se comportó el precio del novillo gordo?",
  "¿Qué avances hay en sistemas silvopastoriles?",
  "¿Qué cambia en el ciclo de vacunación?",
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
    <div className="flex flex-col gap-6">
      {messages.length === 0 && (
        <div className="lx-card lx-glass p-7 text-center">
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
            Pregunta sobre precios, regiones, normativa o cualquier tema cubierto por CONtexto
            Ganadero. Cada respuesta cita sus fuentes; si no hay fuentes, el asistente no responde.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {EJEMPLOS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => void send(e)}
                className="lx-chip text-[0.78rem] normal-case tracking-normal transition hover:border-[var(--border-strong)] hover:text-[var(--accent)]"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex flex-col gap-3"}
          >
            {m.role === "user" ? (
              <p className="max-w-[85%] rounded-[var(--radius)] rounded-br-sm border border-[var(--border-strong)] bg-[var(--surface-2)] px-5 py-3 text-sm leading-relaxed">
                {m.text}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <LogoMark size={28} />
                  <span className="lx-kicker text-[var(--fg-muted)]">
                    Asistente{m.mode === "degraded" ? " · modo búsqueda" : ""}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[15px] leading-[1.75]">{m.text}</p>

                {m.sources && m.sources.length > 0 && (
                  <div className="lx-card lx-glass p-5 text-sm">
                    <p className="lx-kicker text-[var(--accent)]">
                      Fuentes{m.mode === "degraded" ? " (búsqueda semántica)" : ""}
                    </p>
                    <ol className="mt-3 flex flex-col gap-2">
                      {m.sources.map((s) => (
                        <li key={s.n} className="flex gap-3">
                          <span className="lx-mono text-xs text-[var(--accent)]">
                            [{s.n}]
                          </span>
                          <a
                            href={s.url}
                            className="lx-link flex-1"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.title}
                            {s.kind === "archivo" && (
                              <span className="ml-2 text-xs text-[var(--fg-muted)]">(archivo)</span>
                            )}
                          </a>
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
          <p className="flex items-center gap-3 text-sm text-[var(--fg-muted)]">
            <span className="lx-pulse size-2 rounded-full bg-[var(--accent)]" />
            Buscando en el archivo…
          </p>
        )}
        {error && (
          <p className="text-sm text-[var(--danger)]">Ocurrió un error. Intenta de nuevo.</p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = input.trim();
          if (!q || busy) return;
          setInput("");
          void send(q);
        }}
        className="lx-card lx-glass sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-2 p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={busy}
          aria-label="Pregunta para el asistente"
          className="lx-input flex-1 border-0 bg-transparent focus:shadow-none"
        />
        <button type="submit" className="lx-btn" disabled={busy || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
