"use client";

import { useRef, useState } from "react";
import { Check, Clapperboard, Link2, Maximize, Pause, Play, RotateCcw, RotateCw, Share2, Volume2, VolumeX } from "lucide-react";
import { FacebookIcon, WhatsappIcon, XIcon } from "@/components/social-icons";

// Velocidades de reproducción que ofrece el panel (las acepta YouTube en videos grabados).
const VELOCIDADES = [0.5, 1, 1.25, 1.5, 2];

const boton =
  "lx-ui inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold transition hover:border-[var(--border-strong)] hover:text-[var(--accent)] aria-pressed:border-[var(--accent)] aria-pressed:text-[var(--accent)]";

/**
 * Reproductor de /en-vivo: el video de YouTube y, a su lado, un panel de herramientas (pausa, silencio, volumen, saltar 10 s, velocidad,
 * pantalla completa, modo cine y compartir). Los controles hablan con el iframe por `postMessage` (`enablejsapi=1`), sin cargar el script
 * de YouTube. En un directo, saltar y la velocidad dependen de que YouTube los permita (no hay "adelante" más allá del vivo).
 */
export function EnVivoPlayer({ videoId, titulo, url, children }: { videoId: string; titulo: string; url: string; children?: React.ReactNode }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [reproduciendo, setReproduciendo] = useState(true);
  const [silenciado, setSilenciado] = useState(false);
  const [volumen, setVolumen] = useState(100);
  const [velocidad, setVelocidad] = useState(1);
  const [cine, setCine] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Manda una orden al reproductor de YouTube.
  const orden = (func: string, args: unknown[] = []) =>
    iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  const alternarReproduccion = () => {
    orden(reproduciendo ? "pauseVideo" : "playVideo");
    setReproduciendo(!reproduciendo);
  };
  const alternarSilencio = () => {
    orden(silenciado ? "unMute" : "mute");
    setSilenciado(!silenciado);
  };
  const cambiarVolumen = (v: number) => {
    setVolumen(v);
    orden("setVolume", [v]);
    if (v > 0 && silenciado) {
      orden("unMute");
      setSilenciado(false);
    }
  };
  const cambiarVelocidad = (v: number) => {
    setVelocidad(v);
    orden("setPlaybackRate", [v]);
  };
  // Salta hacia atrás o adelante en segundos (`seekBy` no está documentado, pero el reproductor lo acepta).
  const saltar = (segundos: number) => orden("seekBy", [segundos, true]);

  const compartirNativo = async () => {
    try {
      await navigator.share({ title: titulo, url });
    } catch {
      /* la persona cerró el menú de compartir */
    }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin permiso para el portapapeles */
    }
  };
  const texto = encodeURIComponent(`${titulo} · en vivo`);
  const enlace = encodeURIComponent(url);
  const hayCompartir = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className={`grid gap-6 ${cine ? "" : "lg:grid-cols-[minmax(0,1fr)_21rem]"}`}>
      <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-black">
        <iframe
          ref={iframe}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&autoplay=1&enablejsapi=1`}
          title={titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="size-full border-0"
        />
      </div>

      <aside aria-label="Herramientas del video" className={`flex flex-col gap-5 ${cine ? "lg:grid lg:grid-cols-3" : ""}`}>
        <section className="flex flex-col gap-3">
          <h2 className="lx-kicker text-[var(--accent)]">Reproducción</h2>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={alternarReproduccion} className={boton}>
              {reproduciendo ? <Pause size={16} /> : <Play size={16} />} {reproduciendo ? "Pausar" : "Reanudar"}
            </button>
            <button type="button" onClick={alternarSilencio} aria-pressed={silenciado} className={boton}>
              {silenciado ? <VolumeX size={16} /> : <Volume2 size={16} />} {silenciado ? "Con sonido" : "Silenciar"}
            </button>
            <button type="button" onClick={() => saltar(-10)} className={boton}>
              <RotateCcw size={16} /> −10 s
            </button>
            <button type="button" onClick={() => saltar(10)} className={boton}>
              <RotateCw size={16} /> +10 s
            </button>
          </div>
          <label className="flex items-center gap-3 text-sm text-[var(--fg-muted)]">
            <Volume2 size={16} aria-hidden />
            <input
              type="range"
              min={0}
              max={100}
              value={silenciado ? 0 : volumen}
              onChange={(e) => cambiarVolumen(Number(e.target.value))}
              aria-label="Volumen"
              className="h-2 w-full accent-[var(--accent)]"
            />
          </label>
          <div role="group" aria-label="Velocidad" className="flex flex-wrap gap-2">
            {VELOCIDADES.map((v) => (
              <button key={v} type="button" onClick={() => cambiarVelocidad(v)} aria-pressed={velocidad === v} className={`${boton} !min-h-9 !px-3`}>
                {v}×
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="lx-kicker text-[var(--accent)]">Vista</h2>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => iframe.current?.requestFullscreen?.()} className={boton}>
              <Maximize size={16} /> Pantalla completa
            </button>
            <button type="button" onClick={() => setCine(!cine)} aria-pressed={cine} className={boton}>
              <Clapperboard size={16} /> Modo cine
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="lx-kicker text-[var(--accent)]">Compartir</h2>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${texto}%20${enlace}`} target="_blank" rel="noopener noreferrer" className={boton}>
              <WhatsappIcon size={16} /> WhatsApp
            </a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${enlace}`} target="_blank" rel="noopener noreferrer" className={boton}>
              <FacebookIcon size={16} /> Facebook
            </a>
            <a href={`https://twitter.com/intent/tweet?text=${texto}&url=${enlace}`} target="_blank" rel="noopener noreferrer" className={boton}>
              <XIcon size={16} /> X
            </a>
            <button type="button" onClick={copiar} className={boton}>
              {copiado ? <Check size={16} /> : <Link2 size={16} />} {copiado ? "Copiado" : "Copiar enlace"}
            </button>
            {hayCompartir && (
              <button type="button" onClick={compartirNativo} className={`${boton} col-span-2`}>
                <Share2 size={16} /> Más opciones…
              </button>
            )}
          </div>
        </section>

        {children}
      </aside>
    </div>
  );
}
