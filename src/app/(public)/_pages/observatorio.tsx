import { SiteShell } from "@/components/site-shell";
import { IndicadoresGanaderos } from "@/components/indicadores-ganaderos";
import { getIndicadores } from "@/lib/indicadores-fedegan";
import { etiquetasIndicadores } from "@/lib/indicadores-etiquetas";
import { getSiteTheme } from "@/lib/site-theme";
import type { Locale } from "@/lib/i18n";

/**
 * Observatorio: el tablero completo de indicadores ganaderos (precio del ganado gordo y del flaco por región, con
 * gráfica, mapa, tabla y exportación). Lo mismo que muestra la portada, con más aire y la nota de cómo leer las cifras.
 */
const TEXTOS = {
  es: {
    kicker: "Observatorio",
    titulo: "Observatorio ganadero",
    intro: "Las cifras del mercado de ganado en Colombia, mes a mes y por región, tomadas de las estadísticas oficiales de FEDEGÁN y siempre al día.",
    vacio: "Los indicadores no están disponibles en este momento. Intenta de nuevo en unos minutos.",
    comoLeer: "Cómo leer estas cifras",
    notas: [
      ["Fuente", "Sistema de información estadística de FEDEGÁN. Los datos se descargan de su servicio público y se actualizan solos varias veces al día."],
      ["Qué mide", "Precio promedio en pesos por kilo en pie. El ganado flaco sale de las subastas ganaderas, por región; el gordo es el promedio nacional registrado."],
      ["Regiones", "El mapa agrupa departamentos de forma aproximada (Caribe, Santanderes y Magdalena Medio, Llanos Orientales); no son límites oficiales."],
    ],
  },
  en: {
    kicker: "Observatory",
    titulo: "Cattle observatory",
    intro: "Colombia's cattle market figures, month by month and by region, taken from FEDEGÁN's official statistics and always up to date.",
    vacio: "The indicators are not available right now. Please try again in a few minutes.",
    comoLeer: "How to read these figures",
    notas: [
      ["Source", "FEDEGÁN's statistical information system. The data is downloaded from their public service and refreshes itself several times a day."],
      ["What it measures", "Average price in pesos per kilo on the hoof. Feeder cattle comes from livestock auctions, by region; fattened cattle is the registered national average."],
      ["Regions", "The map groups departments approximately (Caribbean, Santanderes and Magdalena Medio, Eastern Plains); they are not official boundaries."],
    ],
  },
} as const;

/** Fábrica: la misma página en cualquier idioma de interfaz (el contenido sigue en español). */
export function makePage(locale: Locale) {
  return async function Page() {
    const [site, indicadores] = await Promise.all([getSiteTheme(), getIndicadores()]);
    const tx = TEXTOS[locale];
    return (
      <SiteShell theme={site.theme} style={site.style} locale={locale} variant="seccion">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-3xl pb-8 pt-2 sm:pt-6">
            <p className="lx-kicker text-[var(--accent)]">{tx.kicker}</p>
            <h1 className="lx-display mt-3 text-4xl font-semibold leading-tight sm:text-5xl">{tx.titulo}</h1>
            <p className="mt-4 text-lg leading-relaxed text-[var(--fg-muted)]">{tx.intro}</p>
          </header>
          {indicadores.length > 0 ? (
            <IndicadoresGanaderos indicadores={indicadores} etiquetas={etiquetasIndicadores(locale)} />
          ) : (
            <p className="rounded-[var(--radius-lg)] border border-[var(--border)] p-8 text-center text-[var(--fg-muted)]">{tx.vacio}</p>
          )}
          <section aria-labelledby="como-leer" className="mt-12 pb-6">
            <h2 id="como-leer" className="lx-display text-2xl font-semibold">{tx.comoLeer}</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              {tx.notas.map(([t, d]) => (
                <div key={t} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <dt className="font-semibold text-[var(--accent)]">{t}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-[var(--fg-muted)]">{d}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </SiteShell>
    );
  };
}
