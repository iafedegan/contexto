import { localePath, t, type Locale } from "@/lib/i18n";
import Link from "next/link";
import {
  ClasicoTemplate,
  CompactoTemplate,
  EsmeraldaTemplate,
  RevistaTemplate,
  VanguardiaTemplate,
} from "@/components/home/templates";
import { FeatureStrip } from "@/components/feature-strip";
import { AdsBanner } from "@/components/ads-banner";
import { SiteShell } from "@/components/site-shell";
import { getHomeLayoutConfig, getHomepageArticles } from "@/lib/content";
import { DEFAULT_HOME_LAYOUT, splitHomeSlots } from "@/lib/home-layout";
import { homeBackgroundStyle } from "@/lib/home-background";

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
export const dynamic = "error"; // falla el build si algo fuerza render dinámico

async function HomePage({ locale }: { locale: Locale }) {
  let articles: Awaited<ReturnType<typeof getHomepageArticles>> = [];
  let layout = DEFAULT_HOME_LAYOUT;
  try {
    [articles, layout] = await Promise.all([getHomepageArticles(13), getHomeLayoutConfig()]);
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
  const props = { lead, second, rail, river, layout, locale };

  const opinion = articles.find((a) => a.categorySlug === "opinion");
  const strip = [
    { label: t(locale, "home.current"), article: articles[1] ?? articles[0] },
    { label: t(locale, "home.specials"), article: articles[2] ?? articles[0] },
    { label: t(locale, "home.featuredColumn"), article: opinion ?? articles[3] ?? articles[0] },
  ].filter((x) => x.article);

  return (
    <SiteShell
      theme={layout.templateId}
      style={homeBackgroundStyle(layout.background)}
      locale={locale} variant="portada"
    >
      {/* Cintillo de titulares: identidad de la portada esmeralda. */}
      {layout.templateId === "esmeralda" && (
        <div className="-mt-6 mb-10 overflow-hidden border-y border-[var(--border)] py-2.5">
          <div className="lx-marquee text-[0.68rem] uppercase tracking-[0.25em] text-[var(--fg-muted)]">
            {[...articles, ...articles].map((a, i) => (
              <span key={`${a.slug}-${i}`} className="flex items-center gap-3 whitespace-nowrap">
                <span className="text-[var(--accent)]">◆</span>
                {a.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Zona comercial de portada. No ocupa sitio si no hay creatividad
          activa y vigente (ver src/lib/ads.ts). */}
      <AdsBanner zone="home_top" className="mx-auto mb-10" />

      {/* La cinta de destacados es parte de la identidad "diario"; el resto de
          plantillas ya destaca con su propio hero o cuadrícula. */}
      {layout.templateId === "clasico" && (
        <div className="mb-10">
          <FeatureStrip items={strip} locale={locale} />
        </div>
      )}

      {/* Cada plantilla se referencia por su nombre en el JSX (y no por un mapa
          indexado en runtime) para no perder el límite cliente/servidor que
          Next resuelve de forma estática. */}
      {layout.templateId === "revista" ? (
        <RevistaTemplate {...props} />
      ) : layout.templateId === "compacto" ? (
        <CompactoTemplate {...props} />
      ) : layout.templateId === "vanguardia" ? (
        <VanguardiaTemplate {...props} />
      ) : layout.templateId === "clasico" ? (
        <ClasicoTemplate {...props} />
      ) : (
        <EsmeraldaTemplate {...props} />
      )}

      {/* Banda de llamada al asistente, común a todas las plantillas. */}
      <section className="lx-card lx-shine relative mt-20 overflow-hidden px-8 py-14 text-center">
        <div className="lx-inlay absolute inset-0" />
        <p className="lx-kicker text-[var(--accent)]">{t(locale, "home.archiveKicker")}</p>
        <h2 className="lx-display mx-auto mt-4 max-w-2xl text-3xl font-semibold leading-tight md:text-4xl">
          {t(locale, "home.ctaTitle")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--fg-muted)]">
          {t(locale, "home.ctaText")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={localePath(locale, "/asistente")} className="lx-btn">
            {t(locale, "home.ctaPrimary")}
          </Link>
          <Link href={localePath(locale, "/buscar")} className="lx-btn lx-btn-ghost">
            {t(locale, "home.ctaSecondary")}
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}


/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof HomePage>[0]) {
    return HomePage({ ...props, locale } as never);
  };
}
