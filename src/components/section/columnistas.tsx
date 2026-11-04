import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ArticleListItem, Columnista } from "@/lib/content";
import { INTL_LOCALE, localePath, type Locale } from "@/lib/i18n";
import { hrefNota } from "@/lib/ruta-nota";
import { formatDate } from "@/lib/utils";

/**
 * Secciones de columnistas (Opinión, Columnas, Blogs): el retrato circular y el nombre del autor son el protagonista, no una foto de
 * portada estirada. Las fotos de autor se guardaron en ~300 px, así que se muestran pequeñas y nítidas.
 */

const iniciales = (nombre: string | null) =>
  (nombre ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/** Retrato redondo con aro dorado; sin foto, las iniciales del autor. */
function Retrato({ a, tam }: { a: ArticleListItem; tam: number }) {
  return (
    <span className="relative inline-flex shrink-0 overflow-hidden rounded-full ring-2 ring-[var(--accent)]/70 ring-offset-2 ring-offset-[var(--surface)]" style={{ width: tam, height: tam }}>
      {a.coverImageUrl ? (
        <Image src={a.coverImageUrl} alt={a.authorName ?? a.title} width={tam * 2} height={tam * 2} sizes={`${tam}px`} className="h-full w-full object-cover object-top" />
      ) : (
        <span className="lx-display flex h-full w-full items-center justify-center bg-[var(--surface-2)] text-lg text-[var(--accent)]">{iniciales(a.authorName)}</span>
      )}
    </span>
  );
}

const fecha = (a: ArticleListItem, locale: Locale) => (a.publishedAt ? formatDate(a.publishedAt, INTL_LOCALE[locale]) : "");

// «Columna de X, cargo, del 7 de octubre de 2026.»: resumen automático que solo repite autor y fecha; no se muestra.
const resumenUtil = (a: ArticleListItem) => (a.excerpt && !/^Columna (de|del)\b[^]*\bdel? \d{1,2} de [a-záéíóú]+ de \d{4}\.?\s*$/i.test(a.excerpt.trim()) ? a.excerpt : null);

/** Columna destacada: retrato grande a la izquierda y el texto a la derecha. */
function Destacada({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  return (
    <Link href={hrefNota(locale, a)} className="lx-card group flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:items-center sm:gap-10 sm:p-10 sm:text-left">
      <Retrato a={a} tam={168} />
      <span className="min-w-0">
        <span className="lx-kicker text-[var(--accent)]">{a.categoryName}</span>
        <span className="lx-display mt-1 block text-lg font-medium text-[var(--fg-muted)]">{a.authorName}</span>
        <span className="lx-display mt-2 block text-3xl font-semibold leading-tight tracking-tight transition group-hover:text-[var(--accent)] md:text-4xl">{a.title}</span>
        {resumenUtil(a) && <span className="mt-3 line-clamp-3 block max-w-2xl text-[var(--fg-muted)]">{resumenUtil(a)}</span>}
        <span className="lx-ui mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--accent)]">
          {fecha(a, locale)} <ArrowRight size={14} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/** Columna en la cuadrícula: retrato y autor arriba, el titular como protagonista y, al pie, la fecha con la invitación a leer. */
function Tarjeta({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  const resumen = resumenUtil(a);
  return (
    <Link
      href={hrefNota(locale, a)}
      className="lx-card group relative flex h-full flex-col overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:origin-left before:scale-x-0 before:bg-[var(--accent)] before:transition before:duration-300 hover:before:scale-x-100"
    >
      <span className="flex items-center gap-4">
        <Retrato a={a} tam={76} />
        <span className="min-w-0">
          <span className="lx-kicker block text-[var(--accent)]">Columnista</span>
          <span className="lx-display mt-0.5 block text-lg font-semibold leading-tight">{a.authorName}</span>
        </span>
      </span>
      <span className="lx-display mt-5 block text-2xl font-semibold leading-snug tracking-tight transition group-hover:text-[var(--accent)]">{a.title}</span>
      {resumen && <span className="mt-3 line-clamp-3 block text-[0.95rem] leading-relaxed text-[var(--fg-muted)]">{resumen}</span>}
      <span className="lx-ui mt-auto flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs uppercase tracking-[0.14em]">
        <span className="text-[var(--fg-muted)]">{fecha(a, locale)}</span>
        <span className="inline-flex items-center gap-2 text-[var(--accent)]">
          Leer <ArrowRight size={14} aria-hidden className="transition group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  );
}

/** Rejilla de columnistas: la primera columna destacada y el resto en tarjetas de 1, 2 o 3 por fila. */
export function ColumnistasGrid({ items, locale }: { items: ArticleListItem[]; locale: Locale }) {
  const [primera, ...resto] = items;
  if (!primera) return null;
  return (
    <div className="flex flex-col gap-8">
      <Destacada a={primera} locale={locale} />
      {resto.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resto.map((a) => (
            <Tarjeta key={a.slug} a={a} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Directorio de columnistas (la antigua página «Columnistas»): un retrato por autor y el acceso a todas sus columnas. */
export function DirectorioColumnistas({ autores, locale }: { autores: Columnista[]; locale: Locale }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-6">
      {autores.map((c) => (
        <li key={c.slug}>
          <Link href={localePath(locale, `/categoria/opinion?autor=${c.slug}`)} className="lx-card group flex h-full flex-col items-center gap-3 p-5 text-center">
            <span className="relative inline-flex size-28 overflow-hidden rounded-full ring-2 ring-[var(--accent)]/70 ring-offset-2 ring-offset-[var(--surface)]">
              {c.foto ? (
                <Image src={c.foto} alt={c.name} width={224} height={224} sizes="112px" className="h-full w-full object-cover object-top" />
              ) : (
                <span className="lx-display flex h-full w-full items-center justify-center bg-[var(--surface-2)] text-2xl text-[var(--accent)]">{c.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}</span>
              )}
            </span>
            <span className="lx-kicker text-[var(--accent)]">Columnista</span>
            <span className="lx-display text-base font-semibold leading-snug">{c.name}</span>
            <span className="lx-ui mt-auto inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-[var(--fg-muted)] transition group-hover:text-[var(--accent)]">
              Ver más artículos <ArrowRight size={13} aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
