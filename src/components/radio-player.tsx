"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

/**
 * Botón de play de la emisora (AI-02 / FM-07).
 *
 * Vive en la cabecera, así que acompaña al lector por todo el portal. El audio
 * se crea al primer clic y no antes: un `<audio>` montado de entrada descarga
 * el stream aunque nadie lo escuche y penaliza el rendimiento móvil.
 *
 * La URL del stream se configura en Configuración › Identidad del sitio; si no
 * hay ninguna, el botón no se pinta.
 */
export function RadioPlayer({
  src,
  locale,
  className = "",
}: {
  src: string;
  locale: Locale;
  className?: string;
}) {
  const [estado, setEstado] = useState<"parado" | "cargando" | "sonando">("parado");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // Reproduce o pausa la emisora.
  async function alternar() {
    if (estado === "sonando") {
      audioRef.current?.pause();
      setEstado("parado");
      return;
    }

    setEstado("cargando");
    if (!audioRef.current) {
      const audio = new Audio(src);
      audio.preload = "none";
      audio.addEventListener("playing", () => setEstado("sonando"));
      audio.addEventListener("pause", () => setEstado("parado"));
      audio.addEventListener("error", () => setEstado("parado"));
      audioRef.current = audio;
    }
    try {
      await audioRef.current.play();
    } catch {
      setEstado("parado");
    }
  }

  const sonando = estado === "sonando";

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={sonando ? t(locale, "radio.stop") : t(locale, "radio.listen")}
      title={sonando ? t(locale, "radio.stop") : t(locale, "radio.listen")}
      // 44 px de área táctil (DM-01) aunque el icono sea pequeño.
      className={`lx-ui inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:border-[var(--accent)] hover:text-[var(--accent)] ${
        sonando ? "border-[var(--accent)] text-[var(--accent)]" : ""
      } ${className}`}
    >
      {estado === "cargando" ? (
        <Loader2 size={13} className="animate-spin" />
      ) : sonando ? (
        <Pause size={13} />
      ) : (
        <Play size={13} />
      )}
      <span className="hidden sm:inline">
        {sonando ? t(locale, "radio.playing") : "Radio"}
      </span>
      {sonando && (
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-[var(--accent)]" />
        </span>
      )}
    </button>
  );
}
