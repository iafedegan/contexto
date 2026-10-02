import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { getMarketTicker, type MarketTickerEntry } from "@/lib/market-data";
import { t, type Locale } from "@/lib/i18n";

/**
 * Franja económica (H-06): TRM, petróleo Brent y el precio del novillo gordo
 * de Medellín, en una sola línea sobre la cabecera. TRM/petróleo los trae el
 * cron `sync-market-data` (ver ese módulo); el ganado sigue siendo un
 * boletín editorial. No renderiza nada si todavía no hay ningún dato —
 * mismo criterio de degradación que `BreakingBar`.
 */
export async function MarketTicker({ locale }: { locale: Locale }) {
  const entries = await getMarketTicker().catch(() => []);
  if (!entries.length) return null;

  return (
    <div
      aria-label={t(locale, "market.label")}
      className="border-b border-[var(--border)] bg-[var(--bg-2)] text-[var(--fg-muted)]"
    >
      <div className="flex items-center gap-5 overflow-x-auto px-4 py-1.5 text-xs font-medium sm:px-6">
        {entries.map((entry, i) => (
          <div key={entry.key} className="flex shrink-0 items-center gap-1.5">
            {i > 0 && <span aria-hidden className="mr-3 opacity-40">·</span>}
            <span className="uppercase tracking-[0.06em] opacity-70">{t(locale, `market.${entry.key}`)}</span>
            <span className="font-semibold text-[var(--fg)]">{formatValue(entry)}</span>
            <TrendIcon current={entry.value} previous={entry.previousValue} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendIcon({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null || current === previous) return <Minus size={11} aria-hidden />;
  return current > previous ? (
    <ArrowUp size={11} className="text-[var(--accent-2)]" aria-hidden />
  ) : (
    <ArrowDown size={11} className="text-[var(--danger)]" aria-hidden />
  );
}

function formatValue(entry: MarketTickerEntry): string {
  switch (entry.key) {
    case "trm":
      return `$${entry.value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
    case "oil":
      return `US$${entry.value.toLocaleString("es-CO", { maximumFractionDigits: 2 })}/bbl`;
    case "cattle":
      return `$${entry.value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}/kg`;
  }
}
