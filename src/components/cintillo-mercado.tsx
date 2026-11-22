import { duracionDelCintillo, piezasDelCintillo, sanitizeTicker } from "@/lib/cintillo";
import { getHomeLayoutConfig } from "@/lib/content";
import { formatMarketValue, getMarketTicker } from "@/lib/market-data";
import { t, type Locale } from "@/lib/i18n";
import type { PiezaTira } from "@/components/cintillo-tira";
import { CintilloMercadoCliente, type DatosCintillo } from "@/components/cintillo-mercado-cliente";

/**
 * Cintillo de cotizaciones (economía) en lo más alto de la página. Se configura en /panel/portada (activo, velocidad, color). Va en TODAS
 * las páginas públicas (lo pone `SiteShell`), no solo en la portada. Con `enServidor` (portada, secciones: dinámicas) las cotizaciones
 * se pintan aquí; sin él (notas, autores: estáticas) solo sale el marco y el navegador las pide a `/api/cintillo`, porque leer las
 * cotizaciones (10 min en caché) le bajaría a la nota guardada su `revalidate` y la haría regenerarse sola. Apagado, no pinta nada.
 */
export async function CintilloMercado({ locale, enServidor = true }: { locale: Locale; enServidor?: boolean }) {
  const layout = await getHomeLayoutConfig().catch(() => null);
  if (!sanitizeTicker(layout?.ticker).activo) return null;
  if (!enServidor) return <CintilloMercadoCliente locale={locale} />;
  const datos = await datosDelCintillo(locale);
  return datos.piezas.length ? <CintilloMercadoCliente locale={locale} datos={datos} /> : null;
}

/** Las piezas de la tira (cotizaciones ya formateadas), cuántas veces se repiten y la duración de una vuelta. La usan el cintillo y `/api/cintillo`. */
export async function datosDelCintillo(locale: Locale): Promise<DatosCintillo> {
  const [layout, market] = await Promise.all([getHomeLayoutConfig().catch(() => null), getMarketTicker().catch(() => [])]);
  const ticker = sanitizeTicker(layout?.ticker);
  if (!ticker.activo) return { piezas: [], veces: 1, segundos: 0 };
  const piezas = piezasDelCintillo(ticker, {
    mercado: market.map((m) => ({ key: m.key, texto: `${t(locale, `market.${m.key}`)} ${formatMarketValue(m)}`, etiqueta: t(locale, `market.${m.key}`), valor: formatMarketValue(m), cambio: m.previousValue ? ((m.value - m.previousValue) / m.previousValue) * 100 : null })),
    notas: [],
  }).filter((p) => p.tipo === "mercado");
  if (piezas.length === 0) return { piezas: [], veces: 1, segundos: 0 };
  // Una vuelta lo bastante larga para llenar pantallas anchas: si hay pocos datos, se repiten seguidos (la repetición la hace CintilloTira).
  const largo = piezas.reduce((n, p) => n + (p.etiqueta ? p.etiqueta.length + (p.valor?.length ?? 0) + 8 : p.texto.length), 0) || 1;
  const veces = Math.max(1, Math.ceil(320 / largo));
  const vuelta = Array.from({ length: veces }, () => piezas).flat();
  const tira: PiezaTira[] = piezas.map((p) => {
    const conCambio = typeof p.cambio === "number" && Number.isFinite(p.cambio);
    return {
      clave: p.clave,
      tipo: p.tipo,
      texto: p.texto,
      etiqueta: p.etiqueta,
      valor: p.valor,
      sube: conCambio ? (p.cambio as number) >= 0 : null,
      cambioTexto: conCambio ? Math.abs(p.cambio as number).toLocaleString(locale === "en" ? "en-US" : "es-CO", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : undefined,
    };
  });
  return { piezas: tira, veces, segundos: duracionDelCintillo(vuelta, ticker.velocidad), ...(ticker.color ? { color: ticker.color } : {}) };
}
