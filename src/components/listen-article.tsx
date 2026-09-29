"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";

/**
 * Lee la nota en voz alta con la Web Speech API del navegador: sin costo, sin
 * servidor, funciona igual en las cinco plantillas porque vive en
 * `ArticleDocument` (compartido por todas). Si el navegador no la soporta
 * (algunos WebViews viejos), el botón simplemente no aparece.
 */
export function ListenArticle({
  title,
  excerpt,
  body,
  lang = "es-CO",
}: {
  title: string;
  excerpt?: string;
  /** HTML ya sanitizado del cuerpo: se limpia a texto plano antes de leerlo. */
  body: string;
  lang?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const utterances = useRef<SpeechSynthesisUtterance[]>([]);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function textoPlano() {
    const div = document.createElement("div");
    div.innerHTML = body;
    const cuerpo = (div.textContent ?? "").replace(/\s+/g, " ").trim();
    return [title, excerpt, cuerpo].filter(Boolean).join(". ");
  }

  function elegirVoz(): SpeechSynthesisVoice | undefined {
    const voces = window.speechSynthesis.getVoices();
    return (
      voces.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
      voces.find((v) => v.lang.toLowerCase().startsWith("es")) ??
      undefined
    );
  }

  // Se parte en frases: un solo `SpeechSynthesisUtterance` gigante se corta a
  // mitad de la nota en varios navegadores (límite interno de ~32 000
  // caracteres, y Chrome de escritorio detiene la síntesis larga a los ~15 s
  // si la pestaña pierde el foco).
  function armarCola() {
    const frases = textoPlano().match(/[^.!?]+[.!?]*/g) ?? [textoPlano()];
    const voz = elegirVoz();
    utterances.current = frases.map((frase) => {
      const u = new SpeechSynthesisUtterance(frase.trim());
      u.lang = lang;
      if (voz) u.voice = voz;
      u.rate = 1;
      return u;
    });
    const ultimo = utterances.current[utterances.current.length - 1];
    if (ultimo) ultimo.onend = () => setState("idle");
  }

  function reproducir() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    armarCola();
    utterances.current.forEach((u) => window.speechSynthesis.speak(u));
    setState("playing");
  }

  function pausar() {
    window.speechSynthesis.pause();
    setState("paused");
  }

  function reanudar() {
    window.speechSynthesis.resume();
    setState("playing");
  }

  function detener() {
    window.speechSynthesis.cancel();
    setState("idle");
  }

  if (!supported) return null;

  return (
    <div className="lx-ui inline-flex items-center gap-1 rounded-full border border-[var(--border)] p-1">
      {state === "idle" && (
        <button
          type="button"
          onClick={reproducir}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition hover:text-[var(--accent)]"
        >
          <Volume2 size={16} /> Escuchar la nota
        </button>
      )}
      {state === "playing" && (
        <>
          <button type="button" onClick={pausar} aria-label="Pausar" className="rounded-full p-2 transition hover:text-[var(--accent)]">
            <Pause size={16} />
          </button>
          <span className="px-1 text-sm font-medium">Leyendo…</span>
          <button type="button" onClick={detener} aria-label="Detener" className="rounded-full p-2 transition hover:text-[var(--accent)]">
            <Square size={14} />
          </button>
        </>
      )}
      {state === "paused" && (
        <>
          <button type="button" onClick={reanudar} aria-label="Reanudar" className="rounded-full p-2 transition hover:text-[var(--accent)]">
            <Play size={16} />
          </button>
          <span className="px-1 text-sm font-medium">En pausa</span>
          <button type="button" onClick={detener} aria-label="Detener" className="rounded-full p-2 transition hover:text-[var(--accent)]">
            <Square size={14} />
          </button>
        </>
      )}
    </div>
  );
}
