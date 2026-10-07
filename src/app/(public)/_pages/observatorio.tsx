import { Beef, CircleDollarSign, Factory, FileText, Globe, MapPinned, Wallet, type LucideIcon } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { ObservatorioHero, type KpiHero } from "@/components/observatorio-hero";
import { ObservatorioIndice } from "@/components/observatorio-indice";
import { IndicadoresGanaderos } from "@/components/indicadores-ganaderos";
import { ObservatorioSerie } from "@/components/observatorio-serie";
import { ObservatorioMapa } from "@/components/observatorio-mapa";
import { ObservatorioHato } from "@/components/observatorio-hato";
import { ObservatorioDocumentos } from "@/components/observatorio-documentos";
import { getIndicadores } from "@/lib/indicadores-fedegan";
import { getObservatorio, type Grupo, type IndicadorGeneral } from "@/lib/observatorio-fedegan";
import { etiquetasIndicadores } from "@/lib/indicadores-etiquetas";
import { periodoLargo, variacion } from "@/lib/graficas";
import { hallazgos as armarHallazgos } from "@/lib/observatorio-resumen";
import { normaDepartamento } from "@/lib/mapa-util";
import { getSiteTheme } from "@/lib/site-theme";
import type { Locale } from "@/lib/i18n";

/**
 * Observatorio: el tablero completo de cifras del sector ganadero, con los mismos indicadores de la página «General»
 * de FEDEGÁN (precios, inventario por departamento, producción, consumo, mercado internacional y costos), leídos de su
 * sistema de estadísticas. Cifras clave arriba, secciones con gráficas, un mapa de calor y la nota de cómo leerlas.
 */
const TEXTOS = {
  es: {
    kicker: "Datos oficiales de FEDEGÁN",
    titulo: ["Observatorio", "ganadero"],
    hallazgos: "Lo que dicen los datos",
    indice: "En esta página",
    intro: "Las cifras del sector en un solo lugar: precios, inventario por departamento, producción, consumo, mercado internacional y costos. Datos oficiales de FEDEGÁN, siempre al día.",
    vacio: "Los indicadores no están disponibles en este momento. Intenta de nuevo en unos minutos.",
    clave: "Cifras clave",
    secciones: { precios: "Precios", inventario: "Inventario", produccion: "Producción", consumo: "Consumo", internacional: "Internacional", costos: "Costos", documentos: "Documentos" },
    descripciones: {
      precios: "Precio del ganado en pie por región, mes a mes, con tarjetas por región y un mapa.",
      inventario: "Cuántos bovinos y predios ganaderos hay en cada departamento, año tras año. Mueve la barra de años o dale reproducir.",
      produccion: "Cuánto se sacrifica en Colombia y cuánta carne produce el mundo.",
      consumo: "Cuánta carne y leche consume cada colombiano al año.",
      internacional: "Cómo se compara el precio del novillo, la leche y la carne con el de otros países.",
      costos: "Cómo evolucionan los costos de producir leche y carne frente a la inflación.",
      documentos: "Informes, balances, coyuntura, cifras de referencia y presentaciones de FEDEGÁN, listos para abrir.",
    },
    kpis: { inventario: "Inventario bovino", gordo: "Ganado gordo", sacrificio: "Sacrificio formal", consumo: "Consumo de carne de res", cabezas: "cabezas", porKilo: "por kilo en pie", milCabezas: "miles de cabezas", kgHab: "kg por habitante" },
    mapa: { bovinos: "Bovinos", predios: "Predios", year: "Año", national: "Total nacional", share: "del total", rank: "Puesto", play: "Reproducir", pause: "Pausar", top: "Los ocho primeros" },
    docs: { buscar: "Buscar documentos", placeholder: "Buscar un informe, un año…", abrir: "Abrir el más reciente", todos: "Ver todos", documentos: "Los documentos son de FEDEGÁN y se abren en su sitio, en una pestaña nueva.", sinResultados: "No hay documentos con esa búsqueda.", nuevaPestana: "Se abre en una pestaña nueva" },
    comoLeer: "Cómo leer estas cifras",
    notas: [
      ["Fuente", "Sistema de información estadística de FEDEGÁN. Los datos se descargan de su servicio público y se actualizan solos varias veces al día."],
      ["Periodos", "Los precios son mensuales y se publican con uno o dos meses de retraso; inventario, sacrificio, consumo y costos son anuales."],
      ["Regiones", "El mapa de precios agrupa departamentos de forma aproximada (Caribe, Santanderes y Magdalena Medio, Llanos Orientales); no son límites oficiales."],
    ],
  },
  en: {
    kicker: "Official FEDEGÁN data",
    titulo: ["Cattle", "observatory"],
    hallazgos: "What the data says",
    indice: "On this page",
    intro: "The sector's figures in one place: prices, inventory by department, production, consumption, the international market and costs. Official FEDEGÁN data, always up to date.",
    vacio: "The indicators are not available right now. Please try again in a few minutes.",
    clave: "Key figures",
    secciones: { precios: "Prices", inventario: "Inventory", produccion: "Production", consumo: "Consumption", internacional: "International", costos: "Costs", documentos: "Documents" },
    descripciones: {
      precios: "Cattle prices on the hoof by region, month by month, with a card per region and a map.",
      inventario: "How many cattle and livestock farms each department has, year after year. Drag the year bar or press play.",
      produccion: "How many head are slaughtered in Colombia and how much beef the world produces.",
      consumo: "How much meat and milk each Colombian consumes per year.",
      internacional: "How the price of steers, milk and beef compares with other countries.",
      costos: "How the costs of producing milk and beef evolve against inflation.",
      documentos: "FEDEGÁN reports, outlooks, market overviews, reference figures and presentations, ready to open.",
    },
    kpis: { inventario: "Cattle inventory", gordo: "Fattened cattle", sacrificio: "Formal slaughter", consumo: "Beef consumption", cabezas: "head", porKilo: "per kilo on the hoof", milCabezas: "thousand head", kgHab: "kg per person" },
    mapa: { bovinos: "Cattle", predios: "Farms", year: "Year", national: "National total", share: "of total", rank: "Rank", play: "Play", pause: "Pause", top: "Top eight" },
    docs: { buscar: "Search documents", placeholder: "Search a report, a year…", abrir: "Open the latest", todos: "See all", documentos: "The documents belong to FEDEGÁN and open on their site, in a new tab.", sinResultados: "No documents match that search.", nuevaPestana: "Opens in a new tab" },
    comoLeer: "How to read these figures",
    notas: [
      ["Source", "FEDEGÁN's statistical information system. The data is downloaded from their public service and refreshes itself several times a day."],
      ["Periods", "Prices are monthly and published with a one or two month delay; inventory, slaughter, consumption and costs are yearly."],
      ["Regions", "The price map groups departments approximately (Caribbean, Santanderes and Magdalena Medio, Eastern Plains); they are not official boundaries."],
    ],
  },
} as const;

const ICONOS: Record<string, LucideIcon> = { precios: CircleDollarSign, inventario: MapPinned, produccion: Factory, consumo: Beef, internacional: Globe, costos: Wallet, documentos: FileText };

// Índice del último valor con dato.
const ultimo = (v: (number | null)[]) => { for (let i = v.length - 1; i >= 0; i--) if (v[i] !== null) return i; return -1; };

// Encabezado de cada sección: icono, número, título y una línea que explica qué se va a ver.
function Seccion({ id, n, titulo, texto, children }: { id: string; n: number; titulo: string; texto: string; children: React.ReactNode }) {
  const Icono = ICONOS[id];
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-32 pt-14 [contain-intrinsic-size:auto_900px] [content-visibility:auto] sm:pt-20 first:pt-8">
      <header className="flex items-start gap-4">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[var(--border-strong)] bg-[var(--accent)]/10 text-[var(--accent)] sm:size-14">
          <Icono size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold tabular-nums tracking-[0.2em] text-[var(--accent)]">{String(n).padStart(2, "0")}</p>
          <h2 id={`${id}-t`} className="lx-display text-3xl font-semibold leading-tight sm:text-4xl">{titulo}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--fg-muted)] sm:text-base">{texto}</p>
        </div>
      </header>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Fábrica: la misma página en cualquier idioma de interfaz (el contenido sigue en español). */
export function makePage(locale: Locale) {
  return async function Page() {
    const [site, precios, obs] = await Promise.all([getSiteTheme(), getIndicadores(), getObservatorio()]);
    const tx = TEXTOS[locale];
    const hayDatos = precios.length > 0 || obs.generales.length > 0 || obs.departamental.length > 0 || obs.documentos.length > 0;
    const grupo = (g: Grupo) => obs.generales.filter((x) => x.grupo === g);
    const por = (clave: string) => obs.generales.find((x) => x.clave === clave);

    // Cifras clave: lo más mirado, con su variación y tendencia.
    const kpis: KpiHero[] = [];
    const inv = obs.departamental.find((d) => d.clave === "bovinos");
    if (inv?.nacional.length) {
      const i = ultimo(inv.nacional);
      if (i >= 0) kpis.push({ etiqueta: `${tx.kpis.inventario} · ${inv.periodos[i]}`, valor: inv.nacional[i] as number, formato: "entero", unidad: tx.kpis.cabezas, delta: variacion(inv.nacional, i), tendencia: inv.nacional });
    }
    const gordo = precios.find((p) => p.clave === "gordo");
    if (gordo) {
      const v = gordo.series[0].valores, i = ultimo(v);
      if (i >= 0) kpis.push({ etiqueta: `${tx.kpis.gordo} · ${gordo.periodos[i]}`, valor: v[i] as number, formato: "pesos", unidad: tx.kpis.porKilo, delta: variacion(v, i), tendencia: v });
    }
    const sac = por("sacrificio");
    if (sac) {
      const v = sac.series[0].valores, i = ultimo(v);
      if (i >= 0) kpis.push({ etiqueta: `${tx.kpis.sacrificio} · ${sac.periodos[i]}`, valor: v[i] as number, formato: "entero", unidad: tx.kpis.milCabezas, delta: variacion(v, i), tendencia: v });
    }
    const res = por("consumo-res");
    if (res) {
      const v = (res.series.find((s) => /total/i.test(s.nombre)) ?? res.series[res.series.length - 1]).valores, i = ultimo(v);
      if (i >= 0) kpis.push({ etiqueta: `${tx.kpis.consumo} · ${res.periodos[i]}`, valor: v[i] as number, formato: "decimal1", unidad: tx.kpis.kgHab, delta: variacion(v, i), tendencia: v });
    }

    // Mapa de fondo de la portada: inventario del último año por departamento.
    let mapa: { valores: Record<string, number>; max: number } | null = null;
    if (inv) {
      const i = inv.nacional.length - 1;
      const valores = Object.fromEntries(inv.departamentos.filter((s) => s.valores[i] !== null).map((s) => [normaDepartamento(s.nombre), s.valores[i] as number]));
      const max = Math.max(1, ...Object.values(valores));
      mapa = Object.keys(valores).length ? { valores, max } : null;
    }
    const ultimaFecha = gordo ? periodoLargo(gordo.periodos[gordo.periodos.length - 1]) : null;

    // Una sección de tarjetas: las que traen muchas series ocupan el ancho.
    const tarjetas = (lista: IndicadorGeneral[]) => (
      <div className="grid gap-5 md:grid-cols-2">
        {lista.map((x) => <ObservatorioSerie key={x.clave} ind={x} ancha={x.series.length > 5 || (lista.length % 2 === 1 && x === lista[lista.length - 1])} />)}
      </div>
    );
    const presentes = [
      precios.length ? "precios" : null, obs.departamental.length ? "inventario" : null,
      grupo("produccion").length ? "produccion" : null, grupo("consumo").length ? "consumo" : null,
      grupo("internacional").length ? "internacional" : null, grupo("costos").length ? "costos" : null,
      obs.documentos.length ? "documentos" : null,
    ].filter((x): x is keyof typeof tx.secciones => x !== null);
    const n = (k: string) => presentes.indexOf(k as never) + 1;

    return (
      <SiteShell theme={site.theme} style={site.style} locale={locale} variant="seccion">
        <div className="mx-auto max-w-7xl">
          <ObservatorioHero kicker={tx.kicker} titulo={[...tx.titulo] as [string, string]} intro={tx.intro} actualizado={ultimaFecha} kpis={kpis} hallazgos={armarHallazgos(precios, obs, locale)} tituloHallazgos={tx.hallazgos} mapa={mapa} />

          {!hayDatos ? (
            <p className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] p-8 text-center text-[var(--fg-muted)]">{tx.vacio}</p>
          ) : (
            <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:gap-10">
              <ObservatorioIndice titulo={tx.indice} items={presentes.map((k) => ({ id: k, etiqueta: tx.secciones[k] }))} />
              <div className="min-w-0">
                {precios.length > 0 && (
                  <Seccion id="precios" n={n("precios")} titulo={tx.secciones.precios} texto={tx.descripciones.precios}>
                    <IndicadoresGanaderos indicadores={precios} etiquetas={etiquetasIndicadores(locale)} />
                  </Seccion>
                )}
                {obs.departamental.length > 0 && (
                  <Seccion id="inventario" n={n("inventario")} titulo={tx.secciones.inventario} texto={tx.descripciones.inventario}>
                    <div className="flex flex-col gap-5">
                      <ObservatorioMapa datos={obs.departamental} etiquetas={tx.mapa} />
                      {obs.hato.length > 0 && <ObservatorioHato hato={obs.hato} />}
                    </div>
                  </Seccion>
                )}
                {grupo("produccion").length > 0 && <Seccion id="produccion" n={n("produccion")} titulo={tx.secciones.produccion} texto={tx.descripciones.produccion}>{tarjetas(grupo("produccion"))}</Seccion>}
                {grupo("consumo").length > 0 && <Seccion id="consumo" n={n("consumo")} titulo={tx.secciones.consumo} texto={tx.descripciones.consumo}>{tarjetas(grupo("consumo"))}</Seccion>}
                {grupo("internacional").length > 0 && <Seccion id="internacional" n={n("internacional")} titulo={tx.secciones.internacional} texto={tx.descripciones.internacional}>{tarjetas(grupo("internacional"))}</Seccion>}
                {grupo("costos").length > 0 && <Seccion id="costos" n={n("costos")} titulo={tx.secciones.costos} texto={tx.descripciones.costos}>{tarjetas(grupo("costos"))}</Seccion>}
                {obs.documentos.length > 0 && (
                  <Seccion id="documentos" n={n("documentos")} titulo={tx.secciones.documentos} texto={tx.descripciones.documentos}>
                    <ObservatorioDocumentos bibliotecas={obs.documentos} etiquetas={tx.docs} />
                  </Seccion>
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
            </div>
          )}
        </div>
      </SiteShell>
    );
  };
}
