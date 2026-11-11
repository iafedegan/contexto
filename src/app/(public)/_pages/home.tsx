import { INTL_LOCALE, t, type Locale } from "@/lib/i18n";
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
import { ColumnaLafaurieSuelta, SiteSidebar } from "@/components/site-sidebar";
import { SiteShell } from "@/components/site-shell";
import { getArticlesByCategory, getBandasDeSecciones, getHomeLayoutConfig, getHomepageArticles, getMostReadArticles, getRecentArticles, PORTADA_NOTAS } from "@/lib/content";
import { CarruselPortada, type NotaCarrusel } from "@/components/home/carrusel-portada";
import { sanitizeCarrusel, sanitizeCarruseles } from "@/lib/carrusel";
import { hrefNota } from "@/lib/ruta-nota";
import { formatDate } from "@/lib/utils";
import { duracionDelCintillo, piezasDelCintillo, sanitizeTicker } from "@/lib/cintillo";
import { DEFAULT_HOME_LAYOUT, splitHomeSlots } from "@/lib/home-layout";
import { getSiteTheme } from "@/lib/site-theme";
import { getSiteIdentity } from "@/lib/site-identity";
import { getEnVivo } from "@/lib/en-vivo";
import { EnVivoBlock } from "@/components/home/en-vivo-block";
import { SeccionesPorBandas } from "@/components/home/secciones-por-bandas";
import { formatMarketValue, getMarketTicker } from "@/lib/market-data";
import { PaginaVista } from "@/components/pagina-vista";
import { getPaginaPublicada, notasDeLaPagina } from "@/lib/paginas";
import { SLUG_INICIO_SITIO, type ContenidoPagina } from "@/lib/paginas-bloques";

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
async function HomePage({ locale, portadaBorrador }: { locale: Locale; portadaBorrador?: ContenidoPagina }) {
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

  const { lead, second, rail, river: rioCompleto } = splitHomeSlots(articles);
  // La cuadrícula del final se recorta a filas completas: así no queda una nota sola en la última fila.
  const colsRio = Math.max(1, layout.riverColumns || 3);
  const river = rioCompleto.length > colsRio ? rioCompleto.slice(0, rioCompleto.length - (rioCompleto.length % colsRio)) : rioCompleto;
  // Cuerpo de la plantilla compuesta; la paleta sigue siendo `templateId`.
  // Se toma de getSiteTheme (misma fuente que el resto del portal).
  const [site, identity, enVivo] = await Promise.all([getSiteTheme(), getSiteIdentity(), getEnVivo()]);
  const body = site.parts.body;

  const opinion = articles.find((a) => a.categorySlug === "opinion");
  const strip = [
    { label: t(locale, "home.current"), article: articles[1] ?? articles[0] },
    { label: t(locale, "home.specials"), article: articles[2] ?? articles[0] },
    { label: t(locale, "home.featuredColumn"), article: opinion ?? articles[3] ?? articles[0] },
  ].filter((x) => x.article);

  // Portada propia del inicio (página «inicio»): publicada, o el borrador en la vista previa del constructor.
  const inicioPropio = portadaBorrador ?? (await getPaginaPublicada(SLUG_INICIO_SITIO).catch(() => null))?.contenido ?? null;
  // Cada fila de la portada propia sale arriba de las notas, tras la principal o abajo, según lo que se eligió en el constructor.
  const filasInicio = (lugar: "arriba" | "tras-principal" | "abajo") => (inicioPropio?.filas ?? []).filter((f) => (f.lugar ?? "arriba") === lugar);
  const bloqueInicio = (lugar: "tras-principal" | "abajo", clase: string) =>
    filasInicio(lugar).length > 0 ? (
      <article className={`${clase} flex flex-col gap-8`}>
        <PaginaVista contenido={{ filas: filasInicio(lugar) }} notas={notasInicioPropio} />
      </article>
    ) : null;
  const notasInicioPropio = inicioPropio ? await notasDeLaPagina(inicioPropio).catch(() => ({})) : {};

  // Franjas «sección por sección» debajo de la portada: las 6 secciones principales con notas suficientes (la más nueva grande y tres tarjetas).
  const bandas = await getBandasDeSecciones(6, 4, 2).catch(() => []);

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
        mercado: market.map((m) => ({ key: m.key, texto: `${t(locale, `market.${m.key}`)} ${formatMarketValue(m)}`, etiqueta: t(locale, `market.${m.key}`), valor: formatMarketValue(m), cambio: m.previousValue ? ((m.value - m.previousValue) / m.previousValue) * 100 : null })),
        notas: notasCintillo,
        // Solo información financiera (como una cinta de cotizaciones): sin titulares ni mensajes.
      }).filter((p) => p.tipo === "mercado")
    : [];
  // Carrusel de notas (todas las plantillas): de dónde salen, cuántas y dónde se pone se decide en /panel/portada.
  const carruseles = [sanitizeCarrusel(layout.carrusel), ...sanitizeCarruseles(layout.carruseles)];
  const construirCarrusel = async (car: ReturnType<typeof sanitizeCarrusel>, clave: number): Promise<React.ReactNode> => {
    if (!car.activo) return null;
    const pedir = car.cantidad * 2;
    const fuente =
      car.fuente === "recientes"
        ? await getRecentArticles(pedir).catch(() => [])
        : car.fuente === "masleidas"
          ? await getMostReadArticles(pedir).catch(() => [])
          : car.fuente === "seccion" && car.seccion
            ? await getArticlesByCategory(car.seccion, { limit: pedir }).then((r) => r.items).catch(() => [])
            : articles;
    const propias: NotaCarrusel[] = car.diapositivas.map((d) => ({
      slug: `propia-${d.id}`,
      href: d.enlace || null,
      externa: d.nuevaPestana && /^https?:/.test(d.enlace),
      sinOptimizar: true,
      title: d.titulo,
      excerpt: d.texto,
      image: d.imagen,
      imageAlt: d.titulo || d.etiqueta || "",
      categoria: d.etiqueta || null,
      autor: null,
      fecha: null,
    }));
    const delSitio: NotaCarrusel[] = (car.fuente === "propias" ? [] : fuente)
      .filter((a) => !car.soloConFoto || a.coverImageUrl)
      .slice(0, car.cantidad)
      .map((a) => ({
        slug: a.slug,
        href: hrefNota(locale, a),
        title: a.title,
        excerpt: a.excerpt,
        image: a.coverImageUrl,
        imageAlt: a.coverImageAlt ?? a.title,
        categoria: a.categoryName,
        autor: a.authorName,
        fecha: a.publishedAt ? formatDate(a.publishedAt, INTL_LOCALE[locale]) : null,
      }));
    const notasCar = car.propiasPosicion === "antes" ? [...propias, ...delSitio] : [...delSitio, ...propias];
    return notasCar.length ? <CarruselPortada key={clave} config={car} notas={notasCar} /> : null;
  };
  const nodosCarrusel = await Promise.all(carruseles.map((c, i) => construirCarrusel(c, i)));
  const car = carruseles[0];
  const carrusel = nodosCarrusel[0];
  // Los carruseles adicionales, agrupados por el lugar de la portada que cada uno eligió.
  const extrasEn = (pos: string) => carruseles.map((c, i) => (i > 0 && c.posicion === pos ? nodosCarrusel[i] : null)).filter(Boolean);
  // En el celular la columna del Dr. Lafaurie sube justo debajo del carrusel (en computador sigue en la barra lateral).
  // Sin carrusel, la columna baja justo debajo de la nota principal de la plantilla (las de cuadrícula la reciben después del bloque).
  // Esmeralda sin carrusel: la columna va arriba de la columna derecha («Lo último») también en el computador, y la barra lateral ya no la repite.
  const columnaArriba = !carrusel && !["revista", "compacto", "vanguardia", "clasico", "gremial"].includes(body);
  const columnaMovil = (
    <div className={columnaArriba ? undefined : "lg:hidden"}>
      <ColumnaLafaurieSuelta locale={locale} />
    </div>
  );
  const carruselConColumna = carrusel ? (
    <>
      {carrusel}
      <div className="mb-10">{columnaMovil}</div>
    </>
  ) : null;
  const sinSlot = body === "compacto" || body === "vanguardia";
  const esEsmeralda = !["revista", "compacto", "vanguardia", "clasico", "gremial"].includes(body);
  const trasPrincipal = carrusel || sinSlot ? undefined : columnaMovil;
  // Cintillo como una cinta de cotizaciones: fondo verde oscuro, nombre en negrita, valor y la variación con flecha verde o roja.
  // Debajo, la cinta de seis colores de la marca (la de la cabecera se oculta cuando está el cintillo, para no repetirla).
  const cintillo =
    piezas.length > 0 ? (
      <div data-region="cintillo" data-el="h-cintillo" className="cg-cintillo-arriba bg-[#0b2a1c] pt-[env(safe-area-inset-top)] text-white [--fg:#ffffff]">
        <div className="overflow-hidden py-2">
          {(() => {
            // Una vuelta lo bastante larga para llenar pantallas anchas: si hay pocos datos, se repiten seguidos.
            const largo = piezas.reduce((n, p) => n + (p.etiqueta ? p.etiqueta.length + (p.valor?.length ?? 0) + 8 : p.texto.length), 0) || 1;
            const veces = Math.max(1, Math.ceil(320 / largo));
            const vuelta = Array.from({ length: veces }, () => piezas).flat();
            const pieza = (p: (typeof piezas)[number], i: number) =>
              p.tipo === "mercado" && p.etiqueta ? (
                <span key={`${p.clave}-${i}`} className="flex items-center gap-2 whitespace-nowrap tabular-nums">
                  <span className="font-bold">{p.etiqueta}</span>
                  <span className="opacity-90">{p.valor}</span>
                  {typeof p.cambio === "number" && Number.isFinite(p.cambio) && (
                    <span className="font-bold">
                      {/* Solo la flecha lleva el verde o el rojo; el número sigue el color de letra del cintillo. */}
                      <span data-color-propio className="text-[color:var(--color-propio)]" style={{ "--color-propio": p.cambio >= 0 ? "#4ade80" : "#f87171" } as React.CSSProperties}>
                        {p.cambio >= 0 ? "▲" : "▼"}
                      </span>{" "}
                      {Math.abs(p.cambio).toLocaleString(locale === "en" ? "en-US" : "es-CO", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%
                    </span>
                  )}
                </span>
              ) : (
                <span key={`${p.clave}-${i}`} className={`flex items-center gap-2 whitespace-nowrap ${p.tipo === "nota" ? "" : "font-bold"}`}>
                  <span className="text-[0.6rem] text-[#f2a900]">◆</span>
                  {p.texto}
                </span>
              );
            return (
              <div
                className="lx-marquee !gap-0 items-center text-[0.8rem] font-medium text-[color:var(--cin,#ffffff)]"
                style={{ "--lx-marquee-s": `${duracionDelCintillo(vuelta, ticker.velocidad)}s`, ...(ticker.color ? { "--cin": ticker.color } : {}) } as React.CSSProperties}
              >
                {/* Dos copias idénticas, cada una con su espacio final: al avanzar media tira la segunda queda justo donde empezó la primera y reinicia sin salto. */}
                {[0, 1].map((k) => (
                  <div key={k} aria-hidden={k === 1} className="flex shrink-0 items-center gap-8 pr-8">
                    {vuelta.map(pieza)}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        <div aria-hidden className="flex h-[2px] w-full">
          {["#f2a900", "#b5124f", "#00587c", "#6a9fc0", "#e5214f", "#5a8f9e"].map((c) => (
            <span key={c} className="cg-cinta-tramo h-full flex-1" style={{ "--c": c } as React.CSSProperties} />
          ))}
        </div>
      </div>
    ) : undefined;

  return (
    <SiteShell
      theme={site.theme}
      style={site.style}
      locale={locale} variant="portada"
      topBar={cintillo}
      aboveMain={
        <>
          {car.posicion === "arriba" && carruselConColumna && <div className="mt-4">{carruselConColumna}</div>}
          {extrasEn("arriba").map((n, i) => <div key={`ar${i}`} className="mt-4">{n}</div>)}
        </>
      }
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

      {/* La portada propia del inicio, armada en Páginas con el constructor: va arriba de las notas. En la vista previa manda el borrador. */}
      {filasInicio("arriba").length > 0 && (
        <article className="mb-12 flex flex-col gap-8">
          <PaginaVista contenido={{ filas: filasInicio("arriba") }} notas={notasInicioPropio} />
        </article>
      )}

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
      {/* Esmeralda lleva la barra lateral dentro, junto a «Lo más reciente»: arriba, la apertura y «Lo último» respiran a dos columnas. */}
      <div className={`grid grid-cols-1 gap-12 ${esEsmeralda ? "" : "lg:grid-cols-[minmax(0,1fr)_19rem]"}`}>
        <div className="lx-bleed-off min-w-0">
          {/* Cada plantilla se referencia por su nombre en el JSX (y no por un
              mapa indexado en runtime) para no perder el límite cliente/servidor
              que Next resuelve de forma estática. */}
          {/* Con una transmisión encendida en /panel/en-vivo, el video toma el lugar principal y la nota destacada baja. */}
          <EnVivoBlock config={enVivo} locale={locale} />
          {car.posicion === "tras-en-vivo" && carruselConColumna && <div className="mb-10">{carruselConColumna}</div>}
          {extrasEn("tras-en-vivo").map((n, i) => <div key={`ev${i}`} className="mb-10">{n}</div>)}
          {body === "revista" ? (
            <RevistaTemplate {...props} trasPrincipal={trasPrincipal} />
          ) : body === "compacto" ? (
            <CompactoTemplate {...props} />
          ) : body === "vanguardia" ? (
            <VanguardiaTemplate {...props} />
          ) : body === "clasico" ? (
            <ClasicoTemplate {...props} trasPrincipal={trasPrincipal} />
          ) : body === "gremial" ? (
            <GremialTemplate {...props} trasPrincipal={trasPrincipal} />
          ) : (
            <EsmeraldaTemplate {...props} trasPrincipal={trasPrincipal} lateral={<SiteSidebar locale={locale} columnaEnMovil={false} sinColumna={columnaArriba} />} />
          )}
          {!carrusel && sinSlot && <div className="mt-8">{columnaMovil}</div>}

          {car.posicion === "tras-principal" && carruselConColumna && <div className="mt-12">{carruselConColumna}</div>}
          {bloqueInicio("tras-principal", "mt-12")}
          {extrasEn("tras-principal").map((n, i) => <div key={`tp${i}`} className="mt-12">{n}</div>)}

          {/* Billboard entre el bloque destacado y el resto (§9.1). */}
          <AdsBanner zone="home_billboard" className="mx-auto mt-14" />
        </div>

        {!esEsmeralda && <SiteSidebar locale={locale} columnaEnMovil={false} />}
      </div>
      </CardSlugsProvider>

      <SeccionesPorBandas bandas={bandas} locale={locale} />

      {car.posicion === "abajo" && carruselConColumna && <div className="mt-12">{carruselConColumna}</div>}
      {bloqueInicio("abajo", "mt-12")}
      {extrasEn("abajo").map((n, i) => <div key={`ab${i}`} className="mt-12">{n}</div>)}

      <AdsBanner zone="home_bottom" className="mx-auto mt-14" />

    </SiteShell>
  );
}


/** El inicio con una portada en borrador en su lugar (vista previa del constructor). */
export function VistaPortadaInicio({ contenido }: { contenido: ContenidoPagina }) {
  return HomePage({ locale: "es", portadaBorrador: contenido });
}

/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof HomePage>[0]) {
    return HomePage({ ...props, locale } as never);
  };
}
