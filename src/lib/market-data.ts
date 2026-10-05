import "server-only";
import { cache } from "react";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { dataPoints, dataSeries } from "@/db/schema";
import { cachear, TAG_AJUSTES } from "@/lib/data-cache";

/**
 * Claves fijas de las series que alimentan la franja económica (H-06). Viven
 * en `data_series`/`data_points` — la misma tabla genérica que ya usan los
 * boletines de precios — para no crear un modelo paralelo. El cron
 * `sync-market-data` es quien las escribe; este módulo solo lee.
 */
export const MARKET_SERIES_KEYS = {
  trm: "trm_cop_usd",
  oil: "petroleo_brent",
  cattle: "precio_novillo_gordo_medellin",
} as const;

export type MarketSeriesKey = keyof typeof MARKET_SERIES_KEYS;

export type MarketTickerEntry = {
  key: MarketSeriesKey;
  name: string;
  unit: string;
  value: number;
  previousValue: number | null;
  observedOn: string;
};

/**
 * Último valor de cada serie de la franja, con el punto anterior para poder
 * pintar la flecha de variación. Se degrada a lista vacía si la serie no
 * existe todavía o si la consulta falla — la franja nunca debe romper la
 * página (mismo criterio que `BreakingBar`).
 */
const leerFranja = cachear("franja-indicadores", async (): Promise<MarketTickerEntry[]> => {
  // Sin try/catch: un fallo pasajero de la base NO debe quedar guardado 10 minutos como «lista vacía».
  const keys = Object.values(MARKET_SERIES_KEYS);
  const series = await db
    .select({ id: dataSeries.id, key: dataSeries.key, name: dataSeries.name, unit: dataSeries.unit })
    .from(dataSeries)
    .where(inArray(dataSeries.key, keys));
  if (!series.length) return [];

  const entries = await Promise.all(
    series.map(async (s) => {
      const points = await db
        .select({ observedOn: dataPoints.observedOn, value: dataPoints.value })
        .from(dataPoints)
        .where(eq(dataPoints.seriesId, s.id))
        .orderBy(desc(dataPoints.observedOn))
        .limit(2);
      const [latest, previous] = points;
      if (!latest) return null;
      const seriesKey = (Object.keys(MARKET_SERIES_KEYS) as MarketSeriesKey[]).find(
        (k) => MARKET_SERIES_KEYS[k] === s.key,
      );
      if (!seriesKey) return null;
      return {
        key: seriesKey,
        name: s.name,
        unit: s.unit,
        value: Number(latest.value),
        previousValue: previous ? Number(previous.value) : null,
        observedOn: latest.observedOn,
      } satisfies MarketTickerEntry;
    }),
  );

  // Orden fijo (dólar, petróleo, ganado) sin importar el orden de la consulta.
  const order: MarketSeriesKey[] = ["trm", "oil", "cattle"];
  return order
    .map((k) => entries.find((e) => e?.key === k))
    .filter((e): e is MarketTickerEntry => e != null);
}, { tags: [TAG_AJUSTES], segundos: 600 });

/** Una consulta por render; el resultado vive 10 minutos entre peticiones (los indicadores cambian una vez al día). */
export const getMarketTicker = cache(async (): Promise<MarketTickerEntry[]> => {
  try {
    return await leerFranja();
  } catch (e) {
    console.error("no se pudo leer la franja de indicadores", e);
    return [];
  }
});

/** Formato de despliegue para cada indicador — un solo lugar para las tres
 * unidades, en vez de repetir el switch donde sea que se muestre la franja. */
export function formatMarketValue(entry: MarketTickerEntry): string {
  switch (entry.key) {
    case "trm":
      return `$${entry.value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
    case "oil":
      return `US$${entry.value.toLocaleString("es-CO", { maximumFractionDigits: 2 })}/bbl`;
    case "cattle":
      return `$${entry.value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}/kg`;
  }
}
