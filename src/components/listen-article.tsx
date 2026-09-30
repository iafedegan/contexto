"use client";

import { useEffect, useRef, useState } from "react";
import { Gauge, Pause, Play, Square, Volume2 } from "lucide-react";

const VELOCIDADES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const VELOCIDAD_KEY = "cg:tts-velocidad";

function cargarVelocidad(): number {
  try {
    const v = Number(localStorage.getItem(VELOCIDAD_KEY));
    return VELOCIDADES.includes(v as (typeof VELOCIDADES)[number]) ? v : 1;
  } catch {
    return 1;
  }
}

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
  const [rate, setRate] = useState(1);
  // Chrome carga la lista de voces de forma asíncrona: si se lee en el clic
  // (antes de que dispare "voiceschanged") suele venir vacía y el navegador
  // usa su voz de sistema por defecto — la más robótica de todas. Por eso se
  // precarga apenas monta el botón, no al reproducir.
  const voces = useRef<SpeechSynthesisVoice[]>([]);
  // Las frases de la nota completa, para poder reanudar desde donde iba al
  // cambiar la velocidad — no desde el principio.
  const frases = useRef<string[]>([]);
  const indiceActual = useRef(0);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (!ok) return;
    setRate(cargarVelocidad());
    const cargar = () => {
      voces.current = window.speechSynthesis.getVoices();
    };
    cargar();
    window.speechSynthesis.addEventListener("voiceschanged", cargar);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", cargar);
      window.speechSynthesis.cancel();
    };
  }, []);

  function textoPlano() {
    const div = document.createElement("div");
    div.innerHTML = body;
    const cuerpo = (div.textContent ?? "").replace(/\s+/g, " ").trim();
    return [title, excerpt, cuerpo].filter(Boolean).join(". ");
  }

  /** De las voces del idioma, prioriza las de mejor calidad: las que NO son
   * el motor local del sistema operativo (`localService: false`, típicamente
   * neuronales/en la nube, como "Google español") suenan mucho más naturales
   * que las locales ("Microsoft ... Desktop", "eSpeak", etc). */
  function elegirVoz(): SpeechSynthesisVoice | undefined {
    const candidatas = voces.current.filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (candidatas.length === 0) return undefined;
    const exactas = candidatas.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
    const orden = (lista: SpeechSynthesisVoice[]) =>
      [...lista].sort((a, b) => Number(a.localService) - Number(b.localService));
    return orden(exactas)[0] ?? orden(candidatas)[0];
  }

  // Se parte en frases: un solo `SpeechSynthesisUtterance` gigante se corta a
  // mitad de la nota en varios navegadores (límite interno de ~32 000
  // caracteres, y Chrome de escritorio detiene la síntesis larga a los ~15 s
  // si la pestaña pierde el foco). También es lo que permite retomar desde la
  // frase actual al cambiar la velocidad, en vez de volver al principio.
  function encolarDesde(indice: number, velocidad: number) {
    const voz = elegirVoz();
    const restantes = frases.current.slice(indice);
    const utterances = restantes.map((frase, i) => {
      const u = new SpeechSynthesisUtterance(frase.trim());
      u.lang = lang;
      if (voz) u.voice = voz;
      u.rate = velocidad;
      u.pitch = 1;
      u.onstart = () => {
        indiceActual.current = indice + i;
      };
      return u;
    });
    const ultimo = utterances[utterances.length - 1];
    if (ultimo) ultimo.onend = () => setState("idle");
    utterances.forEach((u) => window.speechSynthesis.speak(u));
  }

  function reproducir() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    frases.current = textoPlano().match(/[^.!?]+[.!?]*/g) ?? [textoPlano()];
    indiceActual.current = 0;
    encolarDesde(0, rate);
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

  function cambiarVelocidad() {
    const actual = VELOCIDADES.indexOf(rate as (typeof VELOCIDADES)[number]);
    const siguiente = VELOCIDADES[(actual + 1) % VELOCIDADES.length];
    setRate(siguiente);
    try {
      localStorage.setItem(VELOCIDAD_KEY, String(siguiente));
    } catch {
      /* sin almacenamiento: la preferencia dura lo que la sesión */
    }
    // Una utterance ya en curso no puede cambiar de velocidad a medio hablar:
    // se retoma desde la frase actual (no desde el principio) con la nueva.
    if (state === "idle") return;
    const estabaEnPausa = state === "paused";
    window.speechSynthesis.cancel();
    encolarDesde(indiceActual.current, siguiente);
    if (estabaEnPausa) window.speechSynthesis.pause();
  }

  if (!supported) return null;

  const velocidadBtn = (
    <button
      type="button"
      onClick={cambiarVelocidad}
      aria-label="Velocidad de lectura"
      title="Cambiar velocidad"
      className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold tabular-nums transition hover:text-[var(--accent)]"
    >
      <Gauge size={14} /> {rate}x
    </button>
  );

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
          {velocidadBtn}
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
          {velocidadBtn}
          <button type="button" onClick={detener} aria-label="Detener" className="rounded-full p-2 transition hover:text-[var(--accent)]">
            <Square size={14} />
          </button>
        </>
      )}
    </div>
  );
}
