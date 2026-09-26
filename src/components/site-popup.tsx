"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { parseEmbed } from "@/lib/embeds";
import type { PopupConfig } from "@/lib/popup-types";

const DAY = 86_400_000;

/**
 * Popup del portal (diseñado en /panel/portada). Respeta la frecuencia elegida
 * por lector (en su navegador), la vigencia y las páginas donde debe salir.
 * En el editor se pinta con `preview` para verlo sin esperas ni memoria.
 */
export function SitePopup({
  config,
  preview = false,
  onClose,
}: {
  config: PopupConfig;
  preview?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(preview);
  const storageKey = `cg-popup-v${config.version}`;

  useEffect(() => {
    if (preview || !config.enabled) return;
    const today = new Date().toISOString().slice(0, 10);
    if (config.startsAt && today < config.startsAt) return;
    if (config.endsAt && today > config.endsAt) return;
    const path = window.location.pathname.replace(/^\/en(?=\/|$)/, "") || "/";
    if (config.pages === "home" && path !== "/") return;
    if (config.pages === "articles" && !path.startsWith("/articulo/")) return;
    if (!shouldShow(config.frequency, storageKey)) return;
    const id = setTimeout(() => setOpen(true), config.delay * 1000);
    return () => clearTimeout(id);
  }, [config, preview, storageKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    if (!preview) remember(config.frequency, storageKey);
    onClose?.();
  }

  if (!open) return null;

  const media = <Media config={config} />;
  const hasMedia = config.mediaType !== "none" && config.mediaUrl;
  const bgMedia = hasMedia && config.layout === "modal" && config.mediaPosition === "background";
  const side = hasMedia && config.layout === "modal" && config.mediaPosition === "left";

  const content = (
    <div className={`relative flex flex-col gap-3 ${bgMedia ? "p-8 pt-24 text-white" : "p-6"}`}>
      {config.kicker && (
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em]" style={{ color: bgMedia ? "#fff" : config.accent }}>
          {config.kicker}
        </p>
      )}
      {config.title && <h2 className="text-2xl font-bold leading-tight">{config.title}</h2>}
      {config.text && <p className="text-sm leading-relaxed opacity-80">{config.text}</p>}
      {config.ctaLabel && config.ctaUrl && (
        <a
          href={config.ctaUrl}
          onClick={() => !preview && remember(config.frequency, storageKey)}
          className="mt-2 inline-flex w-fit items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: config.accent }}
        >
          {config.ctaLabel}
        </a>
      )}
    </div>
  );

  const closeBtn = (
    <button
      type="button"
      onClick={close}
      aria-label="Cerrar"
      className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
    >
      <X size={16} />
    </button>
  );

  const box = { background: config.bg, color: config.fg, borderRadius: config.radius };

  // Franja inferior a todo el ancho.
  if (config.layout === "banner") {
    return (
      <div role="dialog" aria-label={config.title || "Aviso"} className={`fixed inset-x-0 bottom-0 z-[90] p-3`}>
        <div className="relative mx-auto flex max-w-5xl items-center gap-4 overflow-hidden shadow-2xl" style={box}>
          {hasMedia && <div className="hidden h-28 w-44 shrink-0 sm:block">{media}</div>}
          <div className="flex-1">{content}</div>
          {closeBtn}
        </div>
      </div>
    );
  }

  // Tarjeta en la esquina inferior derecha.
  if (config.layout === "corner") {
    return (
      <div role="dialog" aria-label={config.title || "Aviso"} className={`fixed bottom-4 right-4 z-[90] w-[min(22rem,calc(100%-2rem))]`}>
        <div className="relative overflow-hidden shadow-2xl" style={box}>
          {hasMedia && <div className="aspect-video">{media}</div>}
          {content}
          {closeBtn}
        </div>
      </div>
    );
  }

  // Ventana centrada con fondo oscurecido.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={config.title || "Aviso"}
      className={`fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm`}
      onClick={close}
    >
      <div
        className={`relative w-full overflow-hidden shadow-2xl ${side ? "grid sm:grid-cols-2" : ""}`}
        style={{ ...box, maxWidth: config.width }}
        onClick={(e) => e.stopPropagation()}
      >
        {bgMedia && (
          <>
            <div className="absolute inset-0">{media}</div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          </>
        )}
        {hasMedia && !bgMedia && <div className={side ? "min-h-56" : "aspect-video"}>{media}</div>}
        {content}
        {closeBtn}
      </div>
    </div>
  );
}

function Media({ config }: { config: PopupConfig }) {
  if (!config.mediaUrl) return null;
  if (config.mediaType === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={config.mediaUrl} alt="" className="size-full object-cover" />;
  }
  if (config.mediaType === "video") {
    return <video src={config.mediaUrl} autoPlay muted loop playsInline className="size-full object-cover" />;
  }
  if (config.mediaType === "embed") {
    const e = parseEmbed(config.mediaUrl);
    if (!e) return null;
    const src = `${e.src}${e.src.includes("?") ? "&" : "?"}autoplay=1&mute=1${e.tipo === "vimeo" ? "&muted=1" : ""}`;
    return (
      <iframe
        src={src}
        title={config.title || "Vídeo"}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="size-full"
      />
    );
  }
  return null;
}

function shouldShow(freq: PopupConfig["frequency"], key: string): boolean {
  try {
    if (freq === "always") return true;
    if (freq === "session") return !sessionStorage.getItem(key);
    const last = Number(localStorage.getItem(key) ?? 0);
    if (!last) return true;
    if (freq === "once") return false;
    return Date.now() - last > (freq === "daily" ? DAY : 7 * DAY);
  } catch {
    return true;
  }
}

function remember(freq: PopupConfig["frequency"], key: string) {
  try {
    if (freq === "session") sessionStorage.setItem(key, "1");
    else if (freq !== "always") localStorage.setItem(key, String(Date.now()));
  } catch {
    /* sin almacenamiento: se volverá a mostrar */
  }
}
