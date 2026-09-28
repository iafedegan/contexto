import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dataPoints, dataSeries } from "@/db/schema";
import { MARKET_SERIES_KEYS } from "@/lib/market-data";

/**
 * Trae TRM (COP/USD) y petróleo Brent para la franja económica de la
 * cabecera (H-06) y los guarda en `data_points`, fecha de hoy.
 *
 * En el plan Hobby de Vercel solo hay 2 cron jobs disponibles y ya están
 * ocupados (`publish-scheduled`, `sync-archive`) — no se puede agregar un
 * tercero cada 6 h. Por eso esta función la llama `publish-scheduled` de
 * paso (corre a diario, que ya es una cadencia razonable para estos
 * indicadores) en vez de tener su propio cron. El endpoint
 * `/api/cron/sync-market-data` sigue existiendo para disparar una
 * actualización manual o si el plan sube a Pro.
 *
 * El precio del ganado (`precio_novillo_gordo_medellin`) NO se toca aquí:
 * sigue siendo un boletín editorial, cargado desde el panel.
 */
const TODAY = () => new Date().toISOString().slice(0, 10);

async function fetchTrm(): Promise<number | null> {
  try {
    // Banco de la República, vía el portal de datos abiertos del Estado.
    // Dataset público "Tasa Representativa del Mercado (TRM)": sin clave.
    const res = await fetch(
      "https://www.datos.gov.co/resource/mcec-87by.json?$order=vigenciadesde%20DESC&$limit=1",
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const [row] = (await res.json()) as Array<{ valor?: string }>;
    const value = row?.valor ? Number(row.valor) : null;
    return value && Number.isFinite(value) ? value : null;
  } catch (e) {
    console.error("sync-market-data: falló TRM", e);
    return null;
  }
}

async function fetchBrent(): Promise<number | null> {
  const apiKey = process.env.OILPRICEAPI_KEY;
  try {
    const res = apiKey
      ? await fetch("https://api.oilpriceapi.com/v1/prices/latest?by_code=BRENT_CRUDE_USD", {
          headers: { Authorization: `Token ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        })
      : // Sin clave configurada: endpoint de demostración público del mismo
        // proveedor (sin autenticación, con límites propios pero suficientes
        // para una franja informativa, no financiera).
        await fetch("https://api.oilpriceapi.com/v1/demo/prices", { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = await res.json();
    const price = apiKey
      ? (body?.data?.price as number | undefined)
      : ((body?.data?.prices as Array<{ code: string; price: number }> | undefined)?.find(
          (p) => p.code === "BRENT_CRUDE_USD",
        )?.price);
    return typeof price === "number" && Number.isFinite(price) ? price : null;
  } catch (e) {
    console.error("sync-market-data: falló petróleo", e);
    return null;
  }
}

async function upsertPoint(key: string, name: string, unit: string, source: string, value: number) {
  const [series] = await db
    .insert(dataSeries)
    .values({ key, name, unit, source })
    .onConflictDoUpdate({ target: dataSeries.key, set: { name, unit, source } })
    .returning({ id: dataSeries.id });

  await db
    .insert(dataPoints)
    .values({ seriesId: series.id, observedOn: TODAY(), value: String(value) })
    .onConflictDoUpdate({
      target: [dataPoints.seriesId, dataPoints.observedOn],
      set: { value: sql`excluded.value` },
    });
}

export async function syncMarketData(): Promise<{ updated: string[]; trm: number | null; brent: number | null }> {
  const [trm, brent] = await Promise.all([fetchTrm(), fetchBrent()]);
  const updated: string[] = [];

  if (trm != null) {
    await upsertPoint(MARKET_SERIES_KEYS.trm, "TRM (COP/USD)", "COP", "datos.gov.co — Banco de la República", trm);
    updated.push("trm");
  }
  if (brent != null) {
    await upsertPoint(MARKET_SERIES_KEYS.oil, "Petróleo Brent", "USD/barril", "OilPriceAPI", brent);
    updated.push("oil");
  }

  return { updated, trm, brent };
}
