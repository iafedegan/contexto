import { SiteShell } from "@/components/site-shell";
import { IndicadoresGanaderos } from "@/components/indicadores-ganaderos";
import { ObservatorioSerie } from "@/components/observatorio-serie";
import { ObservatorioMapa } from "@/components/observatorio-mapa";
import { ObservatorioHato } from "@/components/observatorio-hato";
import { getIndicadores } from "@/lib/indicadores-fedegan";
import { getObservatorio, type Grupo, type IndicadorGeneral } from "@/lib/observatorio-fedegan";
import { etiquetasIndicadores } from "@/lib/indicadores-etiquetas";
import { formatear, pct, tramos, trazoSuave, variacion } from "@/lib/graficas";
import { getSiteTheme } from "@/lib/site-theme";
import type { Locale } from "@/lib/i18n";

/**
 * Observatorio: el tablero completo de cifras del sector ganadero, con los mismos indicadores de la página «General»
 * de FEDEGÁN (precios, inventario por departamento, producción, consumo, mercado internacional y costos), leídos de su
 * sistema de estadísticas. Cifras clave arriba, secciones con gráficas, un mapa de calor y la nota de cómo leerlas.
 */
const TEXTOS = {
  es: {
    kicker: "Observatorio",
    titulo: "Observatorio ganadero",
    intro: "Las cifras del sector en un solo lugar: precios, inventario por departamento, producción, consumo, mercado internacional y costos. Datos oficiales de FEDEGÁN, siempre al día.",
    vacio: "Los indicadores no están disponibles en este momento. Intenta de nuevo en unos minutos.",
    clave: "Cifras clave",
    secciones: { precios: "Precios", inventario: "Inventario", produccion: "Producción", consumo: "Consumo", internacional: "Internacional", costos: "Costos" },
    descripciones: {
      precios: "Precio del ganado en pie por región, mes a mes, con tarjetas por región y un mapa.",
      inventario: "Cuántos bovinos y predios ganaderos hay en cada departamento, año tras año. Mueve la barra de años o dale reproducir.",
      produccion: "Cuánto se sacrifica en Colombia y cuánta carne produce el mundo.",
      consumo: "Cuánta carne y leche consume cada colombiano al año.",
      internacional: "Cómo se compara el precio del novillo, la leche y la carne con el de otros países.",
      costos: "Cómo evolucionan los costos de producir leche y carne frente a la inflación.",
    },
    kpis: { inventario: "Inventario bovino", gordo: "Ganado gordo", sacrificio: "Sacrificio formal", consumo: "Consumo de carne de res", cabezas: "cabezas", porKilo: "por kilo en pie", milCabezas: "miles de cabezas", kgHab: "kg por habitante" },
    mapa: { bovinos: "Bovinos", predios: "Predios", year: "Año", national: "Total nacional", share: "del total", rank: "Puesto", play: "Reproducir", pause: "Pausar", top: "Los ocho primeros" },
    comoLeer: "Cómo leer estas cifras",
    notas: [
      ["Fuente", "Sistema de información estadística de FEDEGÁN. Los datos se descargan de su servicio público y se actualizan solos varias veces al día."],
      ["Periodos", "Los precios son mensuales y se publican con uno o dos meses de retraso; inventario, sacrificio, consumo y costos son anuales."],
      ["Regiones", "El mapa de precios agrupa departamentos de forma aproximada (Caribe, Santanderes y Magdalena Medio, Llanos Orientales); no son límites oficiales."],
    ],
  },
  en: {
    kicker: "Observatory",
    titulo: "Cattle observatory",
    intro: "The sector's figures in one place: prices, inventory by department, production, consumption, the international market and costs. Official FEDEGÁN data, always up to date.",
    vacio: "The indicators are not available right now. Please try again in a few minutes.",
    clave: "Key figures",
    secciones: { precios: "Prices", inventario: "Inventory", produccion: "Production", consumo: "Consumption", internacional: "International", costos: "Costs" },
    descripciones: {
      precios: "Cattle prices on the hoof by region, month by month, with a card per region and a map.",
      inventario: "How many cattle and livestock farms each department has, year after year. Drag the year bar or press play.",
      produccion: "How many head are slaughtered in Colombia and how much beef the world produces.",
      consumo: "How much meat and milk each Colombian consumes per year.",
      internacional: "How the price of steers, milk and beef compares with other countries.",
      costos: "How the costs of producing milk and beef evolve against inflation.",
    },
    kpis: { inventario: "Cattle inventory", gordo: "Fattened cattle", sacrificio: "Formal slaughter", consumo: "Beef consumption", cabezas: "head", porKilo: "per kilo on the hoof", milCabezas: "thousand head", kgHab: "kg per person" },
    mapa: { bovinos: "Cattle", predios: "Farms", year: "Year", national: "National total", share: "of total", rank: "Rank", play: "Play", pause: "Pause", top: "Top eight" },
    comoLeer: "How to read these figures",
    notas: [
      ["Source", "FEDEGÁN's statistical information system. The data is downloaded from their public service and refreshes itself several times a day."],
      ["Periods", "Prices are monthly and published with a one or two month delay; inventory, slaughter, consumption and costs are yearly."],
      ["Regions", "The price map groups departments approximately (Caribbean, Santanderes and Magdalena Medio, Eastern Plains); they are not official boundaries."],
    ],
  },
} as const;

type Kpi = { etiqueta: string; valor: string; unidad: string; delta: number | null; tendencia: (number | null)[] };

// Línea pequeña de tendencia de una cifra clave (se dibuja en el servidor).
function Tendencia({ valores }: { valores: (number | null)[] }) {
  const reales = valores.filter((v): v is number => v !== null);
  if (reales.length < 2) return null;
  const [min, max] = [Math.min(...reales), Math.max(...reales)];
  const x = (i: number) => (i / (valores.length - 1)) * 120;
  const y = (v: number) => 30 - 3 - ((v - min) / (max - min || 1)) * 24;
  return (
    <svg viewBox="0 0 120 30" className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      {tramos(valores, x, y).map((t, i) => <path key={i} d={trazoSuave(t)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

// Último valor con dato de una lista.
const ultimo = (v: (number | null)[]) => { for (let i = v.length - 1; i >= 0; i--) if (v[i] !== null) return i; return -1; };

// Una cifra clave: valor grande, variación frente al periodo anterior y tendencia.
function KpiTarjeta({ k }: { k: Kpi }) {
  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{k.etiqueta}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="lx-display text-3xl font-semibold tabular-nums sm:text-[2.1rem]">{k.valor}</span>
        {k.delta !== null && <span className={`text-xs font-bold tabular-nums ${k.delta >= 0 ? "text-[var(--accent-2)]" : "text-[#f87171]"}`}>{k.delta >= 0 ? "▲" : "▼"} {pct(k.delta)}</span>}
      </p>
      <p className="text-xs text-[var(--fg-muted)]">{k.unidad}</p>
      <div className="mt-2"><Tendencia valores={k.tendencia} /></div>
    </li>
  );
}

// Encabezado de cada sección, con su ancla.
function Seccion({ id, titulo, texto, children }: { id: string; titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 pt-12 sm:pt-16">
      <h2 id={`${id}-t`} className="lx-display text-2xl font-semibold sm:text-3xl">{titulo}</h2>
      <p className="mt-1.5 max-w-2xl text-sm text-[var(--fg-muted)] sm:text-base">{texto}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Fábrica: la misma página en cualquier idioma de interfaz (el contenido sigue en español). */
export function makePage(locale: Locale) {
  return async function Page() {
    const [site, precios, obs] = await Promise.all([getSiteTheme(), getIndicadores(), getObservatorio()]);
    const tx = TEXTOS[locale];
    const hayDatos = precios.length > 0 || obs.generales.length > 0 || obs.departamental.length > 0;
    const grupo = (g: Grupo) => obs.generales.filter((x) => x.grupo === g);
    const por = (clave: string) => obs.generales.find((x) => x.clave === clave);

    // Cifras clave: lo más mirado, con su variación y tendencia.
    const kpis: Kpi[] = [];
    const inv = obs.departamental.find((d) => d.clave === "bovinos");
    if (inv?.nacional.length) {
      const i = ultimo(inv.nacional);
      if (i >= 0) kpis.push({ etiqueta: `${tx.kpis.inventario} · ${inv.periodos[i]}`, valor: formatear(inv.nacional[i] as number), unidad: tx.kpis.cabezas, delta: variacion(inv.nacional, i), tendencia: inv.nacional });
    }
    const gordo = precios.find((p) => p.clave === "gordo");
    if (gordo) {
      const v = gordo.series[0].valores, i = ultimo(v);
      if (i >= 0) kpis.push({ etiqueta: `${tx.kpis.gordo} · ${gordo.periodos[i]}`, valor: formatear(v[i] as number, "pesos"), unidad: tx.kpis.porKilo, delta: variacion(v, i), tendencia: v });
    }
    const sac = por("sacrificio");
    if (sac) {
      const v = sac.series[0].valores, i = ultimo(v);
      if (i >= 0) kpis.push({ etiqueta: `${tx.kpis.sacrificio} · ${sac.periodos[i]}`, valor: formatear(v[i] as number), unidad: tx.kpis.milCabezas, delta: variacion(v, i), tendencia: v });
    }
    const res = por("consumo-res");
    if (res) {
      const v = (res.series.find((s) => /total/i.test(s.nombre)) ?? res.series[res.series.length - 1]).valores, i = ultimo(v);
      if (i >= 0) kpis.push({ etiqueta: `${tx.kpis.consumo} · ${res.periodos[i]}`, valor: formatear(v[i] as number, "decimal1"), unidad: tx.kpis.kgHab, delta: variacion(v, i), tendencia: v });
    }

    // Una sección de tarjetas: las que traen muchas series ocupan el ancho.
    const tarjetas = (lista: IndicadorGeneral[]) => (
      <div className="grid gap-5 md:grid-cols-2">
        {lista.map((x) => <ObservatorioSerie key={x.clave} ind={x} ancha={x.series.length > 5 || lista.length % 2 === 1 && x === lista[lista.length - 1]} />)}
      </div>
    );
    const nav = [
      precios.length ? "precios" : null, obs.departamental.length ? "inventario" : null,
      grupo("produccion").length ? "produccion" : null, grupo("consumo").length ? "consumo" : null,
      grupo("internacional").length ? "internacional" : null, grupo("costos").length ? "costos" : null,
    ].filter((x): x is keyof typeof tx.secciones => x !== null);

    return (
      <SiteShell theme={site.theme} style={site.style} locale={locale} variant="seccion">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-3xl pb-6 pt-2 sm:pt-6">
            <p className="lx-kicker text-[var(--accent)]">{tx.kicker}</p>
            <h1 className="lx-display mt-3 text-4xl font-semibold leading-tight sm:text-5xl">{tx.titulo}</h1>
            <p className="mt-4 text-lg leading-relaxed text-[var(--fg-muted)]">{tx.intro}</p>
          </header>

          {!hayDatos ? (
            <p className="rounded-[var(--radius-lg)] border border-[var(--border)] p-8 text-center text-[var(--fg-muted)]">{tx.vacio}</p>
          ) : (
            <>
              {kpis.length > 0 && (
                <section aria-label={tx.clave}>
                  <ul className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">{kpis.map((k) => <KpiTarjeta key={k.etiqueta} k={k} />)}</ul>
                </section>
              )}
              <nav aria-label={tx.kicker} className="sticky top-0 z-30 -mx-4 mt-8 border-y border-[var(--border)] bg-[var(--bg)]/90 px-4 backdrop-blur-md md:top-[4.5rem] sm:mx-0 sm:rounded-full sm:border">
                <ul className="flex gap-1 overflow-x-auto py-1.5">
                  {nav.map((k) => (
                    <li key={k} className="shrink-0"><a href={`#${k}`} className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-[var(--fg-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--accent)]">{tx.secciones[k]}</a></li>
                  ))}
                </ul>
              </nav>

              {precios.length > 0 && (
                <Seccion id="precios" titulo={tx.secciones.precios} texto={tx.descripciones.precios}>
                  <IndicadoresGanaderos indicadores={precios} etiquetas={etiquetasIndicadores(locale)} />
                </Seccion>
              )}
              {obs.departamental.length > 0 && (
                <Seccion id="inventario" titulo={tx.secciones.inventario} texto={tx.descripciones.inventario}>
                  <div className="flex flex-col gap-5">
                    <ObservatorioMapa datos={obs.departamental} etiquetas={tx.mapa} />
                    {obs.hato.length > 0 && <ObservatorioHato hato={obs.hato} />}
                  </div>
                </Seccion>
              )}
              {grupo("produccion").length > 0 && <Seccion id="produccion" titulo={tx.secciones.produccion} texto={tx.descripciones.produccion}>{tarjetas(grupo("produccion"))}</Seccion>}
              {grupo("consumo").length > 0 && <Seccion id="consumo" titulo={tx.secciones.consumo} texto={tx.descripciones.consumo}>{tarjetas(grupo("consumo"))}</Seccion>}
              {grupo("internacional").length > 0 && <Seccion id="internacional" titulo={tx.secciones.internacional} texto={tx.descripciones.internacional}>{tarjetas(grupo("internacional"))}</Seccion>}
              {grupo("costos").length > 0 && <Seccion id="costos" titulo={tx.secciones.costos} texto={tx.descripciones.costos}>{tarjetas(grupo("costos"))}</Seccion>}
            </>
          )}

          <section aria-labelledby="como-leer" className="mt-16 pb-6">
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
