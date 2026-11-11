import Link from "next/link";
import { CoverArt } from "@/components/cover-art";
import { ImagenSitio } from "@/components/ui/imagen-sitio";
import type { ArticleListItem, BandaDeSeccion } from "@/lib/content";
import { INTL_LOCALE, localePath, type Locale } from "@/lib/i18n";
import { hrefNota } from "@/lib/ruta-nota";
import { formatDate } from "@/lib/utils";

/**
 * Inicio «sección por sección»: una franja por sección con su nombre, el enlace «Ver todo →», la nota más reciente en grande (foto a la izquierda,
 * titular y resumen a la derecha) y debajo hasta tres tarjetas. Las franjas alternan de fondo y de color de acento para que se lean como bloques
 * distintos. Solo usa las variables del tema, así que sigue la plantilla y el modo claro u oscuro del sitio.
 */
const ACENTOS = ["var(--accent)", "var(--accent-2)"] as const;

// Foto de una nota (o su arte de respaldo si no tiene imagen).
function Foto({ a, className, grande = false }: { a: ArticleListItem; className: string; grande?: boolean }) {
  return (
    <div className={`media-frame overflow-hidden ${className}`}>
      {a.coverImageUrl ? (
        <ImagenSitio
          src={a.coverImageUrl}
          alt={a.coverImageAlt ?? a.title}
          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          ancho={grande ? 1120 : 640}
          alto={grande ? 700 : 400}
          sizes={grande ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 640px) 30vw, 100vw"}
        />
      ) : (
        <CoverArt seed={a.slug} label={a.categoryName ?? a.title} className="text-[3.5rem]" />
      )}
    </div>
  );
}

// Autor y fecha de una nota, en una línea.
function Firma({ a, locale }: { a: ArticleListItem; locale: Locale }) {
  return (
    <p className="meta flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
      <span className="truncate uppercase tracking-[0.06em]">{a.authorName ?? ""}</span>
      {a.publishedAt && <time dateTime={new Date(a.publishedAt).toISOString()} className="shrink-0">{formatDate(a.publishedAt, INTL_LOCALE[locale])}</time>}
    </p>
  );
}

// Una franja: encabezado, nota principal y tarjetas.
function Banda({ banda, indice, locale }: { banda: BandaDeSeccion; indice: number; locale: Locale }) {
  const [principal, ...resto] = banda.notas;
  const tarjetas = resto.slice(0, 3);
  const acento = ACENTOS[indice % ACENTOS.length];
  const id = `banda-${banda.slug}`;
  return (
    <section
      aria-labelledby={id}
      data-region="banda-seccion"
      className={`rounded-[var(--radius-lg)] border border-[var(--border)] px-5 py-8 sm:px-8 ${indice % 2 === 1 ? "bg-[var(--surface-2)]/70" : "bg-[var(--surface)]/50"}`}
    >
      <header className="flex items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
        <h2 id={id} className="lx-display text-3xl italic leading-none sm:text-4xl" style={{ color: acento }}>{banda.nombre}</h2>
        <Link href={localePath(locale, `/${banda.slug}`)} className="lx-kicker shrink-0 text-xs hover:underline" style={{ color: acento }}>
          {locale === "en" ? "See all" : "Ver todo"} →
        </Link>
      </header>

      {principal && (
        <article className="group mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-stretch lg:gap-10">
          <Link href={hrefNota(locale, principal)} className="block" tabIndex={-1} aria-hidden>
            <Foto a={principal} grande className="aspect-[16/10]" />
          </Link>
          <div className="flex min-w-0 flex-col justify-between gap-5">
            <Link href={hrefNota(locale, principal)} className="entry-link block">
              <h3 className="lx-display text-2xl font-semibold leading-tight group-hover:underline sm:text-3xl lg:text-[2.1rem]">{principal.title}</h3>
              <p className="mt-3 line-clamp-4 text-[1.02rem] leading-relaxed text-[var(--fg-muted)]">{principal.excerpt}</p>
            </Link>
            <Firma a={principal} locale={locale} />
          </div>
        </article>
      )}

      {tarjetas.length > 0 && (
        <div className={`mt-9 grid gap-x-6 gap-y-8 ${tarjetas.length === 1 ? "" : tarjetas.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {tarjetas.map((a) => (
            <article key={a.slug} className="group flex min-w-0 flex-col gap-3">
              <Link href={hrefNota(locale, a)} className="entry-link flex flex-1 flex-col gap-3">
                <Foto a={a} className="aspect-[3/2]" />
                <h3 className="lx-display text-lg font-semibold leading-snug group-hover:underline">{a.title}</h3>
                <p className="line-clamp-3 text-[0.92rem] leading-relaxed text-[var(--fg-muted)]">{a.excerpt}</p>
              </Link>
              <Firma a={a} locale={locale} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** Las franjas por sección del inicio (nada si no hay ninguna con notas suficientes). */
export function SeccionesPorBandas({ bandas, locale }: { bandas: BandaDeSeccion[]; locale: Locale }) {
  if (!bandas.length) return null;
  return (
    <div data-region="bandas-secciones" className="mt-16 flex flex-col gap-10">
      {bandas.map((b, i) => <Banda key={b.slug} banda={b} indice={i} locale={locale} />)}
    </div>
  );
}
