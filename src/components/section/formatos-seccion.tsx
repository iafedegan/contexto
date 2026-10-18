import Link from "next/link";
import { Headphones, Play, Sparkles } from "lucide-react";
import type { ArticleListItem } from "@/lib/content";
import { CardMedia } from "@/components/cover-art";
import { formatDate } from "@/lib/utils";
import { INTL_LOCALE, type Locale } from "@/lib/i18n";
import { hrefNota } from "@/lib/ruta-nota";
import type { FormatoSeccion } from "@/lib/formato-seccion";

/**
 * Plantillas propias de las secciones de TV, Radio y Especiales (Anexo Funcional): cada una se ve como lo que es, sobre los colores de
 * la plantilla activa del sitio. TV: pantalla grande y videos en 16:9 con su botón de reproducir. Radio: el último programa destacado y
 * los demás como lista de episodios. Especiales: dossier con una apertura a todo el ancho y piezas grandes en dos columnas.
 */
export function FormatoDeSeccion({ formato, items, locale }: { formato: FormatoSeccion; items: ArticleListItem[]; locale: Locale }) {
  const [lead, ...resto] = items;
  if (!lead) return null;
  const fecha = (a: ArticleListItem) => (a.publishedAt ? formatDate(a.publishedAt, INTL_LOCALE[locale]) : "");
  const meta = (a: ArticleListItem) => [a.authorName, fecha(a)].filter(Boolean).join(" · ");

  if (formato === "tv") {
    return (
      <div className="flex flex-col gap-10" data-formato="tv">
        {/* La pantalla: el video más reciente, grande, con el título debajo como en un reproductor. */}
        <article className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[#0a0a0a] text-white">
          <Link href={hrefNota(locale, lead)} className="group relative block">
            <CardMedia src={lead.coverImageUrl} alt={lead.coverImageAlt ?? lead.title} seed={lead.slug} label={lead.categoryName} ratio="aspect-video" priority sizes="(min-width: 1024px) 70vw, 100vw" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span aria-hidden className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-2xl transition group-hover:scale-110 sm:size-24">
              <Play size={34} className="translate-x-0.5" fill="currentColor" />
            </span>
          </Link>
          <div className="flex flex-col gap-2 p-5 sm:p-7">
            <p className="lx-kicker text-[var(--accent)]">Lo más reciente</p>
            <h2 className="lx-display text-2xl font-semibold leading-tight sm:text-3xl">
              <Link href={hrefNota(locale, lead)} className="hover:text-[var(--accent)]">{lead.title}</Link>
            </h2>
            {lead.excerpt && <p className="max-w-3xl text-sm leading-relaxed text-white/75 sm:text-base">{lead.excerpt}</p>}
            <p className="text-xs text-white/60">{meta(lead)}</p>
          </div>
        </article>
        {resto.length > 0 && (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {resto.map((a) => (
              <li key={a.slug}>
                <Link href={hrefNota(locale, a)} className="group flex flex-col gap-3">
                  <span className="relative block overflow-hidden rounded-[var(--radius)]">
                    <CardMedia src={a.coverImageUrl} alt={a.coverImageAlt ?? a.title} seed={a.slug} label={a.categoryName} ratio="aspect-video" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw" />
                    <span aria-hidden className="absolute bottom-2 left-2 grid size-10 place-items-center rounded-full bg-black/70 text-white transition group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-fg)]">
                      <Play size={16} className="translate-x-px" fill="currentColor" />
                    </span>
                  </span>
                  <span className="lx-display text-lg font-semibold leading-snug transition group-hover:text-[var(--accent)]">{a.title}</span>
                  <span className="text-xs text-[var(--fg-muted)]">{meta(a)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (formato === "radio") {
    return (
      <div className="flex flex-col gap-8" data-formato="radio">
        {/* El último programa, destacado como en una app de pódcast. */}
        <article className="grid gap-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:p-7">
          <Link href={hrefNota(locale, lead)} className="relative block overflow-hidden rounded-[var(--radius)]">
            <CardMedia src={lead.coverImageUrl} alt={lead.coverImageAlt ?? lead.title} seed={lead.slug} label={lead.categoryName} ratio="aspect-square" priority sizes="(min-width: 640px) 13rem, 100vw" />
          </Link>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <p className="lx-kicker inline-flex items-center gap-1.5 text-[var(--accent)]"><Headphones size={14} aria-hidden /> Último programa</p>
            <h2 className="lx-display text-2xl font-semibold leading-tight sm:text-3xl">
              <Link href={hrefNota(locale, lead)} className="hover:text-[var(--accent)]">{lead.title}</Link>
            </h2>
            {lead.excerpt && <p className="text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">{lead.excerpt}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Link href={hrefNota(locale, lead)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90">
                <Play size={15} fill="currentColor" aria-hidden /> Escuchar
              </Link>
              <span className="text-xs text-[var(--fg-muted)]">{meta(lead)}</span>
            </div>
          </div>
        </article>
        {resto.length > 0 && (
          <ol className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)]">
            {resto.map((a) => (
              <li key={a.slug}>
                <Link href={hrefNota(locale, a)} className="group flex items-center gap-4 p-4 transition hover:bg-[var(--surface-2)]">
                  <span className="relative block size-16 shrink-0 overflow-hidden rounded-[var(--radius)]">
                    <CardMedia src={a.coverImageUrl} alt="" seed={a.slug} label={a.categoryName} ratio="aspect-square" sizes="64px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug transition group-hover:text-[var(--accent)]">{a.title}</span>
                    <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">{meta(a)}</span>
                  </span>
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--accent)] transition group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-fg)]">
                    <Play size={15} className="translate-x-px" fill="currentColor" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  // Especiales: dossier.
  return (
    <div className="flex flex-col gap-10" data-formato="especiales">
      <article className="relative isolate overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
        <Link href={hrefNota(locale, lead)} className="block">
          <CardMedia src={lead.coverImageUrl} alt={lead.coverImageAlt ?? lead.title} seed={lead.slug} label={lead.categoryName} ratio="aspect-[4/5] sm:aspect-[21/9]" priority sizes="100vw" />
        </Link>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10">
          <p className="lx-kicker inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-white backdrop-blur-sm"><Sparkles size={13} aria-hidden className="text-[var(--accent)]" /> Especial</p>
          <h2 className="lx-display mt-2 max-w-4xl text-3xl font-semibold leading-[1.08] sm:text-5xl">
            <Link href={hrefNota(locale, lead)} className="pointer-events-auto hover:text-[var(--accent)]">{lead.title}</Link>
          </h2>
          {lead.excerpt && <p className="mt-3 hidden max-w-2xl text-base leading-relaxed text-white/80 sm:block">{lead.excerpt}</p>}
          <p className="mt-3 text-xs text-white/70">{meta(lead)}</p>
        </div>
      </article>
      {resto.length > 0 && (
        <ul className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {resto.map((a, i) => (
            <li key={a.slug} className={i % 5 === 4 ? "md:col-span-2" : undefined}>
              <Link href={hrefNota(locale, a)} className="group flex flex-col gap-3">
                <span className="block overflow-hidden rounded-[var(--radius-lg)]">
                  <CardMedia src={a.coverImageUrl} alt={a.coverImageAlt ?? a.title} seed={a.slug} label={a.categoryName} ratio={i % 5 === 4 ? "aspect-[21/9]" : "aspect-[3/2]"} sizes="(min-width: 768px) 50vw, 100vw" />
                </span>
                <span className="lx-kicker text-[var(--accent)]">Especial</span>
                <span className="lx-display text-2xl font-semibold leading-tight transition group-hover:text-[var(--accent)]">{a.title}</span>
                {a.excerpt && <span className="line-clamp-3 text-sm leading-relaxed text-[var(--fg-muted)]">{a.excerpt}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
