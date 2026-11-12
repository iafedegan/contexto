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
import { getArticlesByCategory, getBandasDeSecciones, getHomeLayoutConfig, getHomepageArticles, getMostReadArticles, getRecentArticles, getUltimaColumnaLafaurie, PORTADA_NOTAS } from "@/lib/content";
import { CarruselPortada, type NotaCarrusel } from "@/components/home/carrusel-portada";
import { sanitizeCarrusel, sanitizeCarruseles } from "@/lib/carrusel";
import { hrefNota } from "@/lib/ruta-nota";
import { formatDate } from "@/lib/utils";
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
  // Esmeralda: las filas del inicio que son solo carruseles (p. ej. TV y fotos de Fedegán) suben al hueco bajo las destacadas, de a dos, en vez de
  // salir donde se pusieron en el constructor.
  const esFilaDeCarruseles = (f: ContenidoPagina["filas"][number]) => {
    const els = f.celdas.flat();
    return els.length > 0 && els.every((e) => e.tipo === "carrusel");
  };
  const enHuecoCarruseles = !["revista", "compacto", "vanguardia", "clasico", "gremial"].includes(body);
  const filasCarrusel = enHuecoCarruseles ? (inicioPropio?.filas ?? []).filter(esFilaDeCarruseles) : [];
  const filasInicio = (lugar: "arriba" | "tras-principal" | "abajo") => (inicioPropio?.filas ?? []).filter((f) => (f.lugar ?? "arriba") === lugar && !filasCarrusel.includes(f));
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
    // Esmeralda los pone de a dos en el hueco bajo las destacadas: una diapositiva a la vez, título sobre la foto y proporción 3:2 (más altos que anchos de banda).
    const enHueco = !["revista", "compacto", "vanguardia", "clasico", "gremial"].includes(body);
    const config = enHueco ? { ...car, visiblesEscritorio: 1, visiblesTableta: 1, visiblesCelular: 1, estilo: "superpuesta" as const, aspecto: "3:2" as const, ancho: 1800 } : car;
    return notasCar.length ? <CarruselPortada key={clave} config={config} notas={notasCar} /> : null;
  };
  const nodosCarrusel = await Promise.all(carruseles.map((c, i) => construirCarrusel(c, i)));
  const car = carruseles[0];
  const carruselPropio = nodosCarrusel[0];
  const esEsmeraldaTema = !["revista", "compacto", "vanguardia", "clasico", "gremial"].includes(body);
  // Los carruseles adicionales, agrupados por el lugar de la portada que cada uno eligió.
  const extrasEn = (pos: string) => esEsmeraldaTema ? [] : carruseles.map((c, i) => (i > 0 && c.posicion === pos ? nodosCarrusel[i] : null)).filter(Boolean);
  // En el celular la columna del Dr. Lafaurie sube justo debajo del carrusel (en computador sigue en la barra lateral).
  // Sin carrusel, la columna baja justo debajo de la nota principal de la plantilla (las de cuadrícula la reciben después del bloque).
  // Esmeralda sin carrusel: la columna va arriba de la columna derecha («Lo último») también en el computador, y la barra lateral ya no la repite.
  const esEsmeralda = !["revista", "compacto", "vanguardia", "clasico", "gremial"].includes(body);
  // Esmeralda: todos los carruseles activos van en el hueco que queda bajo las dos destacadas, de a dos y compactos (en vez de a todo el ancho).
  // Si el inicio propio trae filas de carruseles, esas van al hueco (otras noticias, no las del banner); si no, el carrusel de notas de la portada.
  const hueco = !esEsmeralda ? [] : filasCarrusel.length ? [<PaginaVista key="car" contenido={{ filas: filasCarrusel }} notas={notasInicioPropio} />] : nodosCarrusel.filter(Boolean);
  const carrusel = esEsmeralda ? null : carruselPropio;
  // ¿Hay columna que mostrar? (lectura cacheada; la misma que hace la tarjeta). Esmeralda reparte distinto la apertura según haya o no.
  const hayColumna = Boolean(await getUltimaColumnaLafaurie().catch(() => null));
  const masLeidas = esEsmeralda ? await getMostReadArticles(3).catch(() => []) : [];
  const columnaArriba = !carrusel && !["revista", "compacto", "vanguardia", "clasico", "gremial"].includes(body);
  const columnaMovil = (
    <div className={columnaArriba ? undefined : "lg:hidden"}>
      <ColumnaLafaurieSuelta locale={locale} tarjeta={esEsmeralda} />
    </div>
  );
  const carruselConColumna = carrusel ? (
    <>
      {carrusel}
      <div className="mb-10">{columnaMovil}</div>
    </>
  ) : null;
  const sinSlot = body === "compacto" || body === "vanguardia";
  const trasPrincipal = carrusel || sinSlot ? undefined : columnaMovil;

  return (
    <SiteShell
      theme={site.theme}
      style={site.style}
      locale={locale} variant="portada"
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
      <AdsBanner zone="home_top" className="mx-auto mb-4" />

      {/* La portada propia del inicio, armada en Páginas con el constructor: va arriba de las notas. En la vista previa manda el borrador. */}
      {filasInicio("arriba").length > 0 && (
        <article className="mb-4 flex flex-col gap-8">
          <PaginaVista contenido={{ filas: filasInicio("arriba") }} notas={notasInicioPropio} />
        </article>
      )}

      {/* La cinta de destacados es parte de la identidad "diario"; el resto de
          plantillas ya destaca con su propio hero o cuadrícula. */}
      {body === "clasico" && (
        <div className="mb-6">
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
        <div className={esEsmeralda ? "min-w-0" : "lx-bleed-off min-w-0"}>
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
            <EsmeraldaTemplate {...props} trasPrincipal={trasPrincipal} conColumna={hayColumna} hueco={hueco.length ? hueco : undefined} masLeidas={masLeidas} lateral={<SiteSidebar locale={locale} columnaEnMovil={false} sinColumna={columnaArriba} />} />
          )}
          {!carrusel && sinSlot && <div className="mt-8">{columnaMovil}</div>}

          {car.posicion === "tras-principal" && carruselConColumna && <div className="mt-12">{carruselConColumna}</div>}
          {bloqueInicio("tras-principal", "mt-12")}
          {!esEsmeralda && extrasEn("tras-principal").map((n, i) => <div key={`tp${i}`} className="mt-12">{n}</div>)}

          {/* Billboard entre el bloque destacado y el resto (§9.1). */}
          <AdsBanner zone="home_billboard" className="mx-auto mt-14" />
        </div>

        {!esEsmeralda && <SiteSidebar locale={locale} columnaEnMovil={false} />}
      </div>
      </CardSlugsProvider>

      <SeccionesPorBandas bandas={bandas} locale={locale} primeraEnTema={esEsmeralda} />

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
