import { Radio, Zap } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

/**
 * Etiqueta «En Vivo» (AI-03 / FM-06). La activa la redacción por artículo; el
 * punto parpadea para que se lea como un directo y no como una categoría más.
 */
export function LiveBadge({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <span
      className={`lx-ui inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)] px-2.5 py-0.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white ${className}`}
    >
      <Radio size={10} aria-hidden />
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-white" />
      </span>
      {t(locale, "live.label")}
    </span>
  );
}

/**
 * Insignia «Última hora» para la propia nota: la misma que lleva la barra roja de arriba, para que quien llega a la nota por
 * un enlace (redes, push, buscador) vea de entrada que es la noticia de última hora. Solo se muestra en la nota que la barra
 * destaca hoy.
 */
export function BreakingBadge({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <span
      className={`lx-ui inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)] px-2.5 py-0.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white ${className}`}
    >
      <Zap size={11} className="animate-pulse" aria-hidden />
      {t(locale, "breaking.label")}
    </span>
  );
}
