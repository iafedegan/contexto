import Link from "next/link";
import { categoryLabel, localePath, t, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionGrid, SectionHeader } from "@/components/section/section-layout";
import { AdsBanner } from "@/components/ads-banner";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { getArticlesByCategory, getAutoresDeSeccion, getHomeLayoutConfig } from "@/lib/content";
import { MapaSeccionRegiones } from "@/components/mapa-seccion-regiones";
import { regionPorSlug } from "@/lib/regiones-colombia";
import { siteUrl } from "@/lib/utils";
import { blockStylesCss } from "@/lib/home-style";

/** Sección — plantilla «Cobre & Obsidiana». */
export const revalidate = 600;

// Parámetros de la ruta: la dirección de la sección.
type Params = { params: Promise<{ slug: string }> };
/** Filtros de la sección: subcategoría, rango de fechas y página. */
type Query = Promise<{ subcategoria?: string; desde?: string; hasta?: string; pagina?: string; autor?: string; anio?: string; mes?: string; region?: string }>;
// Parámetros de la ruta y filtros de la dirección.
type PageProps = Params & { searchParams?: Query };

// Secciones de columnistas: llevan el filtro «Nombre autor · Año · Mes» del sitio anterior.
const SECCIONES_CON_AUTOR = new Set(["columnas", "blogs", "opinion"]);
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Notas por página.
const PAGE_SIZE = 24;

/**
 * Las secciones tampoco se prerenderizan: mismo motivo que los artículos, la
 * concurrencia del build agota el pooler. Se generan en la primera visita y
 * quedan cacheadas por ISR.
 */
export async function generateStaticParams() {
  return [];
}

// Metadatos de la sección.
async function generateMetadataImpl({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await getArticlesByCategory(slug, { limit: 1 }).catch(() => ({
    category: null,
  }));
  if (!category) return { title: "Sección no encontrada", robots: { index: false } };
  return {
    title: category.name,
    description:
      category.description ??
      `Noticias y análisis de ${category.name.toLowerCase()} en el sector ganadero colombiano.`,
    alternates: {
      canonical: siteUrl(`/categoria/${slug}`),
      // Los lectores RSS descubren solos el feed de la sección.
      types: { "application/rss+xml": siteUrl(`/categoria/${slug}/feed.xml`) },
    },
  };
}

// Página de una sección: notas con filtros por subsección y fechas, y paginación; 404 si no existe.
async function CategoryPage({ params, searchParams, locale }: PageProps & { locale: Locale }) {
  const { slug } = await params;
  const q = (await searchParams) ?? {};
  const { subcategoria, pagina } = q;
  let { desde, hasta } = q;
  const autor = SECCIONES_CON_AUTOR.has(slug) && /^[\w-]{1,80}$/.test(q.autor ?? "") ? q.autor : undefined;
  // Año y mes se convierten en un rango de fechas: «mes» solo cuenta junto con un año.
  const anio = /^\d{4}$/.test(q.anio ?? "") ? Number(q.anio) : undefined;
  const mes = anio && /^(?:[1-9]|1[0-2])$/.test(q.mes ?? "") ? Number(q.mes) : undefined;
  if (anio) {
    const m0 = mes ?? 1;
    desde = `${anio}-${String(m0).padStart(2, "0")}-01`;
    const fin = mes ? new Date(Date.UTC(anio, mes, 0)) : new Date(Date.UTC(anio, 12, 0));
    hasta = fin.toISOString().slice(0, 10);
  }
  const region = slug === "regiones" ? regionPorSlug(q.region)?.slug : undefined;
  const page = Math.max(1, Number(pagina) || 1);

  const { category, subcategories, items, total } = await getArticlesByCategory(slug, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    subcategorySlug: subcategoria || undefined,
    dateFrom: desde || undefined,
    dateTo: hasta || undefined,
    authorSlug: autor,
    regionSlug: region,
  }).catch(() => ({ category: null, subcategories: [], items: [], total: 0 }));
  if (!category) notFound();

  const conAutor = SECCIONES_CON_AUTOR.has(slug);
  const autores = conAutor ? await getAutoresDeSeccion(slug).catch(() => []) : [];
  const anioActual = new Date().getFullYear();
  const site = await getSiteTheme();
  // Dónde van los filtros lo elige el editor en /panel/portada (por defecto, junto al título).
  const pos = (await getHomeLayoutConfig()).sectionFilters ?? "cabecera";
  const A =
    pos === "izquierda" || pos === "barra"
      ? { items: "lg:items-start", justify: "lg:justify-start" }
      : pos === "centro"
        ? { items: "lg:items-center", justify: "lg:justify-center" }
        : { items: "lg:items-end", justify: "lg:justify-end" };
  const filtrando = Boolean(subcategoria || desde || hasta || autor);
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Conserva los filtros al cambiar de página. */
  const hrefPagina = (n: number) => {
    const sp = new URLSearchParams();
    if (subcategoria) sp.set("subcategoria", subcategoria);
    if (q.desde && !anio) sp.set("desde", q.desde);
    if (q.hasta && !anio) sp.set("hasta", q.hasta);
    if (autor) sp.set("autor", autor);
    if (region) sp.set("region", region);
    if (anio) sp.set("anio", String(anio));
    if (mes) sp.set("mes", String(mes));
    if (n > 1) sp.set("pagina", String(n));
    const qs = sp.toString();
    return localePath(locale, `/categoria/${slug}${qs ? `?${qs}` : ""}`);
  };

  // Filtros de la sección, compactos y junto al título (ver SectionHeader). Los
  // atajos de fecha (C-09) son enlaces, no botones: cada rango tiene su propia
  // URL, cacheable y compartible. El formulario es GET y funciona sin JavaScript.
  const selectCls = "lx-ui w-full min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm lg:min-h-10 outline-none transition focus:border-[var(--accent)] pointer-coarse:min-h-11";
  const filters = (
    <div data-el="filters" className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${A.justify}`}>
      {/* Filtros de la sección. Formulario GET: cada combinación es una URL
          propia, enlazable y cacheable, y funciona sin JavaScript. */}
      {subcategories.length > 0 && (
        // Los filtros avanzados quedan plegados tras un solo botón; se abre un panel flotante (sin JavaScript: <details>).
        <details className="group relative" open={filtrando || undefined}>
          <summary className="lx-ui inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] group-open:border-[var(--accent)] group-open:text-[var(--accent)] lg:min-h-7 [&::-webkit-details-marker]:hidden">
            <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            {t(locale, "section.filter")}
            {filtrando && <span aria-hidden className="size-1.5 rounded-full bg-[var(--accent)]" />}
          </summary>
        <form
          action={localePath(locale, `/categoria/${slug}`)}
          method="get"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-40 flex w-[min(30rem,calc(100vw-2rem))] flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong,var(--border))] bg-[var(--bg-2)] p-4 text-left shadow-2xl"
        >
          <label className="flex min-w-[8.5rem] flex-col gap-1">
            <span className="lx-kicker !text-[0.72rem] text-[var(--fg-muted)]">{t(locale, "section.subcategory")}</span>
            <select
              name="subcategoria"
              defaultValue={subcategoria ?? ""}
              className="lx-ui rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-xs outline-none transition focus:border-[var(--accent)] pointer-coarse:min-h-11"
            >
              <option value="">{t(locale, "section.all")}</option>
              {subcategories.map((sc) => (
                <option key={sc.slug} value={sc.slug}>
                  {sc.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="lx-kicker !text-[0.72rem] text-[var(--fg-muted)]">{t(locale, "section.from")}</span>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="lx-ui w-[8.5rem] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-xs outline-none transition focus:border-[var(--accent)] pointer-coarse:min-h-11"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="lx-kicker !text-[0.72rem] text-[var(--fg-muted)]">{t(locale, "section.to")}</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="lx-ui w-[8.5rem] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5 text-xs outline-none transition focus:border-[var(--accent)] pointer-coarse:min-h-11"
            />
          </label>

          <button
            type="submit"
            className="lx-ui min-h-11 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold lg:min-h-8 text-[var(--accent-fg)] transition hover:opacity-90"
          >
            {t(locale, "section.filter")}
          </button>

          {filtrando && (
            <Link
              href={localePath(locale, `/categoria/${slug}`)}
              className="lx-link text-xs text-[var(--fg-muted)]"
            >
              {t(locale, "section.clear")}
            </Link>
          )}
        </form>
        </details>
      )}
    </div>
  );

  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="seccion">
      {(() => {
        const css = blockStylesCss(items);
        return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
      })()}
      <JsonLd
        data={collectionJsonLd({
          name: category.name,
          description: category.description,
          path: `/categoria/${slug}`,
          items: items.map((a) => ({ title: a.title, slug: a.slug })),
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: locale === "es" ? "Inicio" : "Home", path: "/" },
          { name: category.name, path: `/categoria/${slug}` },
        ])}
      />

      <SectionHeader
        theme={site.parts.body}
        kicker={t(locale, "section.kicker")}
        title={categoryLabel(locale, slug, category.name)}
        description={category.description}
        breadcrumb={
          /* Miga visible (C-02): ubica al lector y alimenta el dato estructurado. */
          <nav
            data-el="breadcrumb"
            aria-label="breadcrumb"
            className="sr-only lx-ui flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--fg-muted)]"
          >
            <Link href={localePath(locale, "/")} className="lx-link">
              {locale === "es" ? "Inicio" : "Home"}
            </Link>
            <span aria-hidden className="text-[var(--accent-2)]">/</span>
            <span className="text-[var(--accent)]">{categoryLabel(locale, slug, category.name)}</span>
          </nav>
        }
        // En «cabecera» y «barra» los filtros van al lado de las etiquetas (n publicaciones · actualizado), no en un bloque aparte.
        filters={undefined}
        chips={
          <>
            <span className="lx-chip border-[var(--border-strong)] text-[var(--accent)]">
              {total} {t(locale, "section.count")}
            </span>
            <span className="lx-chip max-sm:hidden">{t(locale, "section.live")}</span>
            {(pos === "cabecera" || pos === "barra") && filters}
          </>
        }
      />

      {slug === "regiones" && <MapaSeccionRegiones locale={locale} actual={region} />}

      {conAutor && autores.length > 0 && (
        // Filtro de columnistas: una barra delgada bajo el encabezado, con autor, año y mes en una sola fila. Formulario GET (URL propia, sin JavaScript).
        <form
          action={localePath(locale, `/categoria/${slug}`)}
          method="get"
          className="mb-8 grid grid-cols-2 items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)] p-3 sm:p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]"
        >
          <label className="col-span-2 flex flex-col gap-1 lg:col-span-1">
            <span className="lx-kicker !text-[0.68rem] text-[var(--fg-muted)]">{t(locale, "section.author")}</span>
            <select name="autor" defaultValue={autor ?? ""} className={selectCls}>
              <option value="">{t(locale, "section.anyAuthor")}</option>
              {autores.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="lx-kicker !text-[0.68rem] text-[var(--fg-muted)]">{t(locale, "section.year")}</span>
            <select name="anio" defaultValue={anio ? String(anio) : ""} className={selectCls}>
              <option value="">{t(locale, "section.anyYear")}</option>
              {Array.from({ length: anioActual - 2009 }, (_, i) => anioActual - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="lx-kicker !text-[0.68rem] text-[var(--fg-muted)]">{t(locale, "section.month")}</span>
            <select name="mes" defaultValue={mes ? String(mes) : ""} className={selectCls}>
              <option value="">{t(locale, "section.anyMonth")}</option>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <div className="col-span-2 flex items-center gap-4 lg:col-span-1">
            <button type="submit" className="lx-ui min-h-11 flex-1 rounded-full bg-[var(--accent)] px-7 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 lg:min-h-10 lg:flex-none">
              {t(locale, "section.search")}
            </button>
            {filtrando && (
              <Link href={localePath(locale, `/categoria/${slug}`)} className="lx-link whitespace-nowrap text-xs text-[var(--fg-muted)]">
                {t(locale, "section.clear")}
              </Link>
            )}
          </div>
        </form>
      )}

      {pos !== "cabecera" && pos !== "barra" && pos !== "oculto" && (
        <div
          className={`mb-8 flex ${pos === "centro" ? "justify-center" : pos === "derecha" ? "justify-end" : "justify-start"}`}
        >
          {filters}
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-16 text-center text-[var(--fg-muted)]">
          {filtrando ? t(locale, "section.noMatches") : t(locale, "section.empty")}
        </p>
      ) : (
        <>
          <AdsBanner zone="section_top" className="mx-auto mb-10" />
          <SectionGrid theme={site.parts.body} items={items} locale={locale} />
        </>
      )}

      {/* Continuidad de resultados (C-12): siempre se indica cuántos hay y
          cómo seguir, con paginación numérica enlazable. */}
      {items.length > 0 && (
        <nav className="mt-14 flex flex-col items-center gap-4" aria-label="paginación">
          <p className="lx-ui text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
            {t(locale, "section.showing")} {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} {t(locale, "section.of")} {total}
          </p>

          {paginas > 1 && (
            <ol className="flex flex-wrap items-center justify-center gap-2">
              {page > 1 && (
                <li>
                  <Link href={hrefPagina(page - 1)} className={BOTON_PAG}>
                    ←
                  </Link>
                </li>
              )}
              {paginasVisibles(page, paginas).map((n, i) =>
                n === null ? (
                  <li key={`gap-${i}`} className="px-1 text-[var(--fg-muted)]">
                    …
                  </li>
                ) : (
                  <li key={n}>
                    <Link
                      href={hrefPagina(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={`${BOTON_PAG} ${
                        n === page
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                          : ""
                      }`}
                    >
                      {n}
                    </Link>
                  </li>
                ),
              )}
              {page < paginas && (
                <li>
                  <Link href={hrefPagina(page + 1)} className={BOTON_PAG}>
                    →
                  </Link>
                </li>
              )}
            </ol>
          )}

          {page < paginas && (
            <Link
              href={hrefPagina(page + 1)}
              className="lx-ui inline-flex min-h-11 w-full max-w-sm items-center justify-center rounded-full border border-[var(--border-strong)] px-6 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {t(locale, "section.loadMore")}
            </Link>
          )}
        </nav>
      )}

      <AdsBanner zone="section_bottom" className="mx-auto mt-14" />

    </SiteShell>
  );
}


// Clases de los botones de paginación.
const BOTON_PAG =
  "lx-ui grid min-h-11 min-w-11 place-items-center rounded-full border border-[var(--border)] px-3 text-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]";

/**
 * Ventana de páginas: primera, última, la actual y sus vecinas. `null` marca
 * un salto (…). Evita listar cincuenta números en secciones con mucho archivo.
 */
function paginasVisibles(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const cerca = [actual - 1, actual, actual + 1].filter((n) => n > 1 && n < total);
  const nums = [1, ...cerca, total];
  const salida: (number | null)[] = [];
  let previo = 0;
  for (const n of nums) {
    if (n - previo > 1) salida.push(null);
    salida.push(n);
    previo = n;
  }
  return salida;
}

/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof CategoryPage>[0]) {
    return CategoryPage({ ...props, locale } as never);
  };
}

/**
 * En inglés cambia la interfaz, no el contenido: la página es la MISMA nota en
 * español. Se marca `noindex` y se apunta la canónica a la ruta española para
 * no competir contra ella con contenido duplicado.
 */
export function makeMetadata(locale: Locale) {
  return async (props: Parameters<typeof generateMetadataImpl>[0]) => {
    const meta = await generateMetadataImpl({ ...props, locale } as never);
    if (locale === "es") return meta;
    const { slug } = await props.params;
    return {
      ...meta,
      robots: { index: false, follow: true },
      alternates: {
        canonical: siteUrl(`/categoria/${slug}`),
        types: { "application/rss+xml": siteUrl(`/categoria/${slug}/feed.xml`) },
      },
    };
  };
}
