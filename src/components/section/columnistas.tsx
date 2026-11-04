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

/** Columna destacada: retrato grande a la izquierda y el texto a la derecha. */
function Destacada({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  return (
    <Link href={hrefNota(locale, a)} className="lx-card group flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:items-center sm:gap-10 sm:p-10 sm:text-left">
      <Retrato a={a} tam={168} />
      <span className="min-w-0">
        <span className="lx-kicker text-[var(--accent)]">{a.categoryName}</span>
        <span className="lx-display mt-1 block text-lg font-medium text-[var(--fg-muted)]">{a.authorName}</span>
        <span className="lx-display mt-2 block text-3xl font-semibold leading-tight tracking-tight transition group-hover:text-[var(--accent)] md:text-4xl">{a.title}</span>
        {a.excerpt && <span className="mt-3 line-clamp-3 block max-w-2xl text-[var(--fg-muted)]">{a.excerpt}</span>}
        <span className="lx-ui mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--accent)]">
          {fecha(a, locale)} <ArrowRight size={14} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/** Columna en la cuadrícula: autor con su retrato arriba, el título y un resumen debajo. */
function Tarjeta({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  return (
    <Link href={hrefNota(locale, a)} className="lx-card group flex h-full flex-col gap-4 p-5 sm:p-6">
      <span className="flex items-center gap-3">
        <Retrato a={a} tam={64} />
        <span className="min-w-0">
          <span className="lx-display block truncate text-base font-semibold">{a.authorName}</span>
          <span className="lx-ui block text-xs text-[var(--fg-muted)]">{fecha(a, locale)}</span>
        </span>
      </span>
      <span className="lx-display block text-xl font-semibold leading-snug tracking-tight transition group-hover:text-[var(--accent)]">{a.title}</span>
      {a.excerpt && <span className="line-clamp-3 block text-sm leading-relaxed text-[var(--fg-muted)]">{a.excerpt}</span>}
      <span className="lx-ui mt-auto inline-flex items-center gap-2 pt-1 text-xs uppercase tracking-[0.14em] text-[var(--accent)]">
        Leer columna <ArrowRight size={14} aria-hidden className="transition group-hover:translate-x-1" />
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
