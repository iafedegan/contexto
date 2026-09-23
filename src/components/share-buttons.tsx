"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { FacebookIcon, LinkedinIcon, WhatsappIcon, XIcon } from "@/components/social-icons";
import { t, type Locale } from "@/lib/i18n";

/**
 * Botones de compartir (A-04). En escritorio van fijos al lateral del artículo
 * y en móvil como fila horizontal, que es donde alcanza el pulgar (M-04).
 *
 * La URL se toma del navegador en el momento del clic y no de una prop: la
 * página se sirve cacheada por ISR y una URL incrustada en el HTML puede no
 * corresponder al idioma o a los parámetros con los que llegó el lector.
 */
export function ShareButtons({ title, locale }: { title: string; locale: Locale }) {
  const [copiado, setCopiado] = useState(false);

  function url() {
    return typeof window === "undefined" ? "" : window.location.href.split("#")[0];
  }

  function abrir(plantilla: (u: string, t: string) => string) {
    const u = encodeURIComponent(url());
    const ti = encodeURIComponent(title);
    window.open(plantilla(u, ti), "_blank", "noopener,noreferrer,width=640,height=560");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin permiso de portapapeles: el lector siempre puede copiar de la barra */
    }
  }

  /** Hoja nativa del sistema en móvil: es la vía que el lector espera. */
  async function compartirNativo() {
    if (!navigator.share) return copiar();
    try {
      await navigator.share({ title, url: url() });
    } catch {
      /* cancelado por el usuario */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t(locale, "share.label")}>
      <span className="lx-kicker mr-1 text-[var(--fg-muted)]">{t(locale, "share.label")}</span>

      <Boton etiqueta="WhatsApp" onClick={() => abrir((u, ti) => `https://wa.me/?text=${ti}%20${u}`)}>
        <WhatsappIcon />
      </Boton>
      <Boton etiqueta="X" onClick={() => abrir((u, ti) => `https://twitter.com/intent/tweet?url=${u}&text=${ti}`)}>
        <XIcon />
      </Boton>
      <Boton etiqueta="Facebook" onClick={() => abrir((u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`)}>
        <FacebookIcon />
      </Boton>
      <Boton
        etiqueta="LinkedIn"
        onClick={() => abrir((u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`)}
      >
        <LinkedinIcon />
      </Boton>
      <Boton etiqueta={copiado ? t(locale, "share.copied") : t(locale, "share.copy")} onClick={copiar}>
        {copiado ? <Check size={17} /> : <Link2 size={17} />}
      </Boton>
      <Boton etiqueta={t(locale, "share.more")} onClick={compartirNativo} className="sm:hidden">
        <Share2 size={17} />
      </Boton>
    </div>
  );
}

function Boton({
  etiqueta,
  onClick,
  children,
  className = "",
}: {
  etiqueta: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      // 44 × 44 px con 8 px de separación: D-09 y DM-04.
      className={`grid size-11 place-items-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] ${className}`}
    >
      {children}
    </button>
  );
}
