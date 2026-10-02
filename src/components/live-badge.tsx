import { Radio } from "lucide-react";
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
