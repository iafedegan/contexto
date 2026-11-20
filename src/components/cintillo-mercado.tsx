import { duracionDelCintillo, piezasDelCintillo, sanitizeTicker } from "@/lib/cintillo";
import { getHomeLayoutConfig } from "@/lib/content";
import { formatMarketValue, getMarketTicker } from "@/lib/market-data";
import { t, type Locale } from "@/lib/i18n";
import { BotonPausaCss } from "@/components/ui/boton-pausa";
import { CintilloTira, type PiezaTira } from "@/components/cintillo-tira";

/**
 * Cintillo de cotizaciones (economía) en lo más alto de la página: fondo verde oscuro, nombre en negrita, valor y la variación con flecha
 * verde o roja. Se configura en /panel/portada (activo, velocidad, color). Va en TODAS las páginas públicas (lo pone `SiteShell`), no solo en la portada.
 * Debajo, la cinta de seis colores de la marca. Si no hay datos de mercado o está apagado, no pinta nada.
 */
export async function CintilloMercado({ locale }: { locale: Locale }) {
  const [layout, market] = await Promise.all([getHomeLayoutConfig().catch(() => null), getMarketTicker().catch(() => [])]);
  const ticker = sanitizeTicker(layout?.ticker);
  if (!ticker.activo) return null;
  const piezas = piezasDelCintillo(ticker, {
    mercado: market.map((m) => ({ key: m.key, texto: `${t(locale, `market.${m.key}`)} ${formatMarketValue(m)}`, etiqueta: t(locale, `market.${m.key}`), valor: formatMarketValue(m), cambio: m.previousValue ? ((m.value - m.previousValue) / m.previousValue) * 100 : null })),
    notas: [],
  }).filter((p) => p.tipo === "mercado");
  if (piezas.length === 0) return null;
  return (
  <div role="region" aria-label={locale === "en" ? "Market prices" : "Cotizaciones del mercado"} data-pausable data-region="cintillo" data-el="h-cintillo" className="cg-cintillo-arriba bg-[#003e41] pt-[env(safe-area-inset-top)] text-white [--fg:#ffffff]">
    <div className="relative overflow-hidden py-2">
      {/* WCAG 2.2.2: lo que se mueve solo se puede detener. */}
      <BotonPausaCss className="absolute right-1 top-1/2 z-10 !size-6 -translate-y-1/2 bg-[#003e41] ring-1 ring-white/30" />
      {(() => {
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
        return <CintilloTira piezas={tira} veces={veces} segundos={duracionDelCintillo(vuelta, ticker.velocidad)} color={ticker.color || undefined} />;
      })()}
    </div>
    <div aria-hidden className="flex h-[2px] w-full">
      {["#d9a41a", "#f7eea1", "#138984", "#003e41", "#138984", "#d9a41a"].map((c, i) => (
        <span key={`${c}-${i}`} className="cg-cinta-tramo h-full flex-1" style={{ "--c": c } as React.CSSProperties} />
      ))}
    </div>
  </div>

  );
}
