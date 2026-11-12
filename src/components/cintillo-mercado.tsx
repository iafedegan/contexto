import { duracionDelCintillo, piezasDelCintillo, sanitizeTicker } from "@/lib/cintillo";
import { getHomeLayoutConfig } from "@/lib/content";
import { formatMarketValue, getMarketTicker } from "@/lib/market-data";
import { t, type Locale } from "@/lib/i18n";

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

  );
}
