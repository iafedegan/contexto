import { t, type Locale } from "@/lib/i18n";
import {
  ClasicoTemplate,
  CompactoTemplate,
  EsmeraldaTemplate,
  GremialTemplate,
  RevistaTemplate,
  VanguardiaTemplate,
} from "@/components/home/templates";
import { FeatureStrip } from "@/components/feature-strip";
import { AdsBanner } from "@/components/ads-banner";
import { CardSlugsProvider } from "@/components/home/card-styles";
import { blockStylesCss } from "@/lib/home-style";
import { SiteSidebar } from "@/components/site-sidebar";
import { SiteShell } from "@/components/site-shell";
import { getArticlesByCategory, getHomeLayoutConfig, getHomepageArticles, getRecentArticles, PORTADA_NOTAS } from "@/lib/content";
import { duracionDelCintillo, piezasDelCintillo, sanitizeTicker } from "@/lib/cintillo";
import { DEFAULT_HOME_LAYOUT, splitHomeSlots } from "@/lib/home-layout";
import { getSiteTheme } from "@/lib/site-theme";
import { getSiteIdentity } from "@/lib/site-identity";
import { formatMarketValue, getMarketTicker } from "@/lib/market-data";

/**
 * Portada — generación estática con ISR.
 * `revalidate` de respaldo cada 5 min; la revalidación real es *on-demand*,
 * disparada por el panel editorial al publicar (POST /api/revalidate).
 *
 * La plantilla se elige en /panel/portada y no solo cambia la cuadrícula: su
 * `templateId` es también el tema de la página (`data-theme`), así que cabecera,
 * pie, paleta y tipografías cambian con ella. El orden de las notas respeta el
 * fijado manualmente por el editor (`articles.homePosition`).
 */
export const revalidate = 300;

// Portada: notas con el orden manual, plantilla elegida en el panel, anuncios y franja de indicadores.
async function HomePage({ locale }: { locale: Locale }) {
  let articles: Awaited<ReturnType<typeof getHomepageArticles>> = [];
  let layout = DEFAULT_HOME_LAYOUT;
  try {
    [articles, layout] = await Promise.all([getHomepageArticles(PORTADA_NOTAS), getHomeLayoutConfig()]);
  } catch {
    articles = [];
  }

  if (articles.length === 0) {
    return (
      <SiteShell theme={DEFAULT_HOME_LAYOUT.templateId} locale={locale} variant="portada">
        <div className="py-24 text-center">
          <p className="lx-display text-3xl">{t(locale, "home.empty")}</p>
          <p className="mt-3 text-sm text-[var(--fg-muted)]">
            Configura la base de datos y ejecuta <code className="lx-mono">npm run db:seed</code>.
          </p>
        </div>
      </SiteShell>
    );
  }

  const { lead, second, rail, river } = splitHomeSlots(articles);
  // Cuerpo de la plantilla compuesta; la paleta sigue siendo `templateId`.
  // Se toma de getSiteTheme (misma fuente que el resto del portal).
  const [site, identity] = await Promise.all([getSiteTheme(), getSiteIdentity()]);
  const body = site.parts.body;

  const opinion = articles.find((a) => a.categorySlug === "opinion");
  const strip = [
    { label: t(locale, "home.current"), article: articles[1] ?? articles[0] },
    { label: t(locale, "home.specials"), article: articles[2] ?? articles[0] },
    { label: t(locale, "home.featuredColumn"), article: opinion ?? articles[3] ?? articles[0] },
  ].filter((x) => x.article);

  const market = await getMarketTicker().catch(() => []);
  // Gremial es "use client" y market-data.ts es server-only: se le pasan los
  // valores ya formateados en vez del tipo/formateador del módulo.
  const marketFormatted = market
    .filter((m) => m.key === "trm" || m.key === "cattle")
    .map((m) => ({ key: m.key as "trm" | "cattle", label: t(locale, `market.${m.key}`), value: formatMarketValue(m) }));
  const props = { lead, second, rail, river, layout, locale, market: marketFormatted };

  // Cintillo configurable desde /panel/portada: qué lleva (titulares, indicadores, mensajes propios) y a qué velocidad.
  const ticker = sanitizeTicker(layout.ticker);
  const notasCintillo =
    ticker.fuente === "recientes"
      ? await getRecentArticles(Math.max(1, ticker.cantidad)).catch(() => [])
      : ticker.fuente === "seccion" && ticker.seccion
        ? await getArticlesByCategory(ticker.seccion, { limit: Math.max(1, ticker.cantidad) }).then((r) => r.items).catch(() => [])
        : articles;
  const piezas = ticker.activo
    ? piezasDelCintillo(ticker, {
        mercado: market.map((m) => ({ key: m.key, texto: `${t(locale, `market.${m.key}`)} ${formatMarketValue(m)}` })),
        notas: notasCintillo,
      })
    : [];
  const cintillo =
    piezas.length > 0 ? (
      <div className="mb-4 overflow-hidden border-b border-[var(--border)] py-2.5 sm:mb-10 sm:border-y">
        <div
          className="lx-marquee text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-muted)] sm:tracking-[0.25em]"
          style={{ "--lx-marquee-s": `${duracionDelCintillo(piezas, ticker.velocidad)}s` } as React.CSSProperties}
        >
          {/* Dos copias seguidas: la animación avanza media tira y reinicia sin que se note el salto. */}
          {[...piezas, ...piezas].map((p, i) =>
            p.tipo === "nota" ? (
              <span key={`${p.clave}-${i}`} className="flex items-center gap-3 whitespace-nowrap">
                <span className="text-[var(--accent)]">◆</span>
                {p.texto}
              </span>
            ) : (
              <span key={`${p.clave}-${i}`} className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-[var(--fg)]">
                <span className="text-[var(--accent)]">◆</span>
                {p.texto}
              </span>
            ),
          )}
        </div>
      </div>
    ) : undefined;

  return (
    <SiteShell
      theme={site.theme}
      style={site.style}
      locale={locale} variant="portada"
      aboveMain={cintillo}
    >
      {/* La portada no tenía ningún <h1>: la estructura de encabezados
          saltaba directo a los <h2> de cada sección ("Lo último"…), lo que
          rompe la jerarquía SEO (toda página necesita exactamente un <h1>).
          Va oculto visualmente porque el nombre del sitio ya está pintado
          como logo en la cabecera — no hay que duplicarlo en pantalla. */}
      <h1 className="sr-only">
        {identity.name} — {identity.tagline || t(locale, "nav.tagline")}
      </h1>

      {/* Zona comercial de portada. No ocupa sitio si no hay creatividad
          activa y vigente (ver src/lib/ads.ts). */}
      <AdsBanner zone="home_top" className="mx-auto mb-10" />

      {/* La cinta de destacados es parte de la identidad "diario"; el resto de
          plantillas ya destaca con su propio hero o cuadrícula. */}
      {body === "clasico" && (
        <div className="mb-10">
          <FeatureStrip items={strip} locale={locale} />
        </div>
      )}

      {/* Cuerpo de la portada + barra lateral (§8). En pantallas menores de
          1024 px la lateral baja al final, que es lo que pide M-05. */}
      {/* Tamaño, fondo y texto de cada bloque, fijados a mano en /panel/portada. */}
      {(() => {
        const css = blockStylesCss(articles);
        return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
      })()}
      <CardSlugsProvider slugs={[lead, second, ...rail, ...river].filter((a): a is NonNullable<typeof a> => Boolean(a)).map((a) => a.slug)}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="lx-bleed-off min-w-0">
          {/* Cada plantilla se referencia por su nombre en el JSX (y no por un
              mapa indexado en runtime) para no perder el límite cliente/servidor
              que Next resuelve de forma estática. */}
          {body === "revista" ? (
            <RevistaTemplate {...props} />
          ) : body === "compacto" ? (
            <CompactoTemplate {...props} />
          ) : body === "vanguardia" ? (
            <VanguardiaTemplate {...props} />
          ) : body === "clasico" ? (
            <ClasicoTemplate {...props} />
          ) : body === "gremial" ? (
            <GremialTemplate {...props} />
          ) : (
            <EsmeraldaTemplate {...props} />
          )}

          {/* Billboard entre el bloque destacado y el resto (§9.1). */}
          <AdsBanner zone="home_billboard" className="mx-auto mt-14" />
        </div>

        <SiteSidebar locale={locale} />
      </div>
      </CardSlugsProvider>

      <AdsBanner zone="home_bottom" className="mx-auto mt-14" />

    </SiteShell>
  );
}


/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof HomePage>[0]) {
    return HomePage({ ...props, locale } as never);
  };
}
