"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, VolumeX } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { useVoz } from "@/components/voz-asistente";

// Fuente que respalda una respuesta.
type Source = { n: number; title: string; url: string; kind: "articulo" | "archivo" | "observatorio"; summary: string };
// Mensaje de la conversación: de la persona o del asistente, con su modo y fuentes.
type Msg = {
  role: "user" | "assistant";
  text: string;
  mode?: "declined" | "degraded" | "generativo";
  sources?: Source[];
};

// Preguntas de ejemplo para empezar.
const EJEMPLOS = [
  "¿Cómo se comportó el precio del novillo gordo?",
  "¿Qué avances hay en sistemas silvopastoriles?",
  "¿Qué cambia en el ciclo de vacunación?",
];

// La función se calienta una sola vez por carga de página (ver `GET` en la ruta del asistente).
let calentado = false;

// Mensajes de espera según cuánto lleva la consulta: la persona ve que avanza y no una pantalla quieta.
const ESPERAS = [
  { desde: 0, texto: "Buscando en el archivo…" },
  { desde: 3500, texto: "Armando la respuesta con las fuentes…" },
  { desde: 10000, texto: "Sigue trabajando; esto está tardando más de lo normal…" },
] as const;

/** `compact`: versión para el cuadro flotante (altura propia con desplazamiento y el campo fijo abajo). */
export function AssistantChat({ compact = false }: { compact?: boolean }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const finRef = useRef<HTMLDivElement>(null);
  const voz = useVoz();
  // Si la pregunta se dictó, la respuesta se lee en voz alta (se puede apagar con el altavoz).
  const [leerRespuestas, setLeerRespuestas] = useState(true);
  const preguntaPorVoz = useRef(false);
  // Al abrir el chat se calienta la función del servidor: mientras la persona escribe, ya está lista para la primera pregunta.
  useEffect(() => {
    if (calentado) return;
    calentado = true;
    void fetch("/api/assistant", { cache: "no-store" }).catch(() => {});
  }, []);
  // Cambia el mensaje de espera según pasa el tiempo.
  useEffect(() => {
    if (!busy) return;
    const relojes = ESPERAS.slice(1).map((e, i) => setTimeout(() => setEspera(i + 1), e.desde));
    return () => relojes.forEach(clearTimeout);
  }, [busy]);
  useEffect(() => {
    if (compact) finRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [compact, messages, busy]);

  // Una consulta con tope de 40 s; la respuesta se lee solo si el servidor contestó bien.
  async function consultar(question: string) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 40_000);
    try {
      return await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: control.signal,
      });
    } finally {
      clearTimeout(reloj);
    }
  }

  // Envía la pregunta al asistente y agrega su respuesta a la conversación. Si la red o el servidor fallan, lo intenta una vez más.
  async function send(question: string) {
    setBusy(true);
    setEspera(0);
    setError(null);
    setMessages((m) => [...m, { role: "user", text: question }]);
    try {
      let res: Response | null = null;
      for (let intento = 0; intento < 2 && !res?.ok; intento++) {
        try {
          res = await consultar(question);
        } catch {
          res = null;
        }
        // Un 4xx (pregunta vacía o larga, demasiadas consultas) no mejora repitiéndolo.
        if (res && res.status >= 400 && res.status < 500) break;
      }
      if (!res?.ok) throw new Error(String(res?.status ?? "red"));
      const data = (await res.json()) as { mode: Msg["mode"]; answer: string; sources: Source[] };
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.answer, mode: data.mode, sources: data.sources },
      ]);
      if (preguntaPorVoz.current && leerRespuestas) voz.leer(data.answer);
      preguntaPorVoz.current = false;
    } catch (e) {
      setError(e instanceof Error && e.message === "429" ? "Hiciste muchas preguntas seguidas. Espera un rato e intenta de nuevo." : "No pude responder esta vez. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col gap-3" : "flex flex-col gap-6"}>
      <div className={compact ? "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pr-1" : "contents"}>
      {messages.length === 0 && (
        <div className={compact ? "lx-card lx-glass p-4 text-center" : "lx-card lx-glass p-7 text-center"}>
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
                            {s.kind === "observatorio" && (
                              <span className="ml-2 text-xs text-[var(--fg-muted)]">(datos del Observatorio)</span>
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
          <p role="status" className="flex items-center gap-3 text-sm text-[var(--fg-muted)]">
            <span className="lx-pulse size-2 rounded-full bg-[var(--accent)]" />
            {ESPERAS[espera].texto}
          </p>
        )}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div ref={finRef} />
      </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = input.trim();
          if (!q || busy) return;
          setInput("");
          void send(q);
        }}
        className={compact ? "lx-card lx-glass flex shrink-0 items-center gap-2 p-2" : "lx-card lx-glass sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-2 p-2"}
      >
        {voz.soportaDictado && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (voz.escuchando) return voz.parar();
              voz.escuchar(setInput, (texto) => { preguntaPorVoz.current = true; setInput(""); void send(texto); });
            }}
            aria-pressed={voz.escuchando}
            aria-label={voz.escuchando ? "Dejar de escuchar" : "Preguntar con la voz"}
            title={voz.escuchando ? "Escuchando… pulsa para terminar" : "Habla y el asistente te responde"}
            className={`grid size-11 shrink-0 place-items-center rounded-full border transition ${voz.escuchando ? "animate-pulse border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border-strong)] hover:border-[var(--accent)]"}`}
          >
            {voz.escuchando ? <Square size={16} aria-hidden /> : <Mic size={18} aria-hidden />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={busy}
          aria-label="Pregunta para el asistente"
          className="lx-input flex-1 border-0 bg-transparent focus:shadow-none"
        />
        {voz.soportaLectura && (voz.leyendo || voz.soportaDictado) && (
          <button
            type="button"
            onClick={() => { if (voz.leyendo) voz.callar(); else setLeerRespuestas((v) => !v); }}
            aria-label={voz.leyendo ? "Callar al asistente" : leerRespuestas ? "No leer las respuestas en voz alta" : "Leer las respuestas en voz alta"}
            title={voz.leyendo ? "Callar" : leerRespuestas ? "Respuestas en voz alta: activadas" : "Respuestas en voz alta: apagadas"}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] hover:border-[var(--accent)]"
          >
            {voz.leyendo || leerRespuestas ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
          </button>
        )}
        <button type="submit" className="lx-btn" disabled={busy || !input.trim()}>
          Enviar
        </button>
      </form>
      {voz.aviso && <p role="status" className="text-xs text-[var(--danger)]">{voz.aviso}</p>}
    </div>
  );
}
