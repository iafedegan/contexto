import Link from "next/link";
import { Zap } from "lucide-react";
import { getBreakingArticle } from "@/lib/content";
import { localePath, t, type Locale } from "@/lib/i18n";

/**
 * Barra de última hora (H-05). No renderiza nada si no hay nota marcada, que es
 * el estado normal: el requisito pide expresamente que no sature el diseño
 * cuando no hay urgencia.
 */
export async function BreakingBar({ locale }: { locale: Locale }) {
  const nota = await getBreakingArticle().catch(() => null);
  if (!nota) return null;

  return (
    <Link
      href={localePath(locale, `/articulo/${nota.slug}`)}
      className="group block border-b border-[var(--danger)]/40 bg-[var(--danger)] text-[var(--accent-fg)]"
    >
      <div className="shell flex items-center gap-3 py-2.5">
        <span className="lx-ui inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-[0.16em]">
          <Zap size={11} className="animate-pulse" />
          {t(locale, "breaking.label")}
        </span>
        <span className="lx-ui min-w-0 flex-1 truncate text-[0.88rem] font-medium">
          {nota.title}
        </span>
        <span aria-hidden className="shrink-0 transition-transform group-hover:translate-x-1">
          →
        </span>
      </div>
    </Link>
  );
}
