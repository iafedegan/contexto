import "server-only";
import { eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantQueries, siteSettings } from "@/db/schema";
import { estimateCostUsd, getLimites } from "@/lib/budget";
import { getGastos } from "@/lib/ai-cuota";
import { leerRef } from "@/lib/ai-providers";

/**
 * Consumo de IA por MODELO y por mes, sumando a todos los usuarios y al asistente público. Se llena solo: `getModelo` envuelve cada modelo de texto con
 * un middleware que anota los tokens reales de cada llamada (ver `src/lib/ai-provider.ts`). Vive en `site_settings` (sin tablas nuevas):
 *  - `ai_uso_modelos_AAAA-MM` → { "proveedor:modelo": { in, out, n, usd } }
 * El costo es una ESTIMACIÓN con la tarifa de referencia de `estimateCostUsd`; el saldo real está en el panel de cada proveedor.
 */
const mesActual = () => new Date().toISOString().slice(0, 7);
const usoKey = (mes = mesActual()) => `ai_uso_modelos_${mes}`;

export type UsoModelo = { in: number; out: number; n: number; usd: number };

/** Suma una llamada al modelo al consumo del mes. Atómico (UPSERT): varias llamadas a la vez no se pisan. Nunca rompe a quien llama. */
export async function registrarUsoModelo(ref: string, entrada: number, salida: number, usd = estimateCostUsd(entrada, salida), llamadas = 1): Promise<void> {
  try {
    const i = Math.max(0, Math.round(entrada) || 0);
    const o = Math.max(0, Math.round(salida) || 0);
    const costo = Number.isFinite(usd) && usd > 0 ? usd : 0;
    await db.execute(sql`
      insert into site_settings (key, value)
      values (${usoKey()}, jsonb_build_object(${ref}::text, jsonb_build_object('in', ${i}::bigint, 'out', ${o}::bigint, 'n', ${llamadas}::int, 'usd', ${costo}::numeric)))
      on conflict (key) do update set
        value = jsonb_set(
          site_settings.value,
          array[${ref}::text],
          jsonb_build_object(
            'in',  coalesce((site_settings.value->${ref}::text->>'in')::bigint, 0) + ${i}::bigint,
            'out', coalesce((site_settings.value->${ref}::text->>'out')::bigint, 0) + ${o}::bigint,
            'n',   coalesce((site_settings.value->${ref}::text->>'n')::int, 0) + ${llamadas}::int,
            'usd', coalesce((site_settings.value->${ref}::text->>'usd')::numeric, 0) + ${costo}::numeric
          )
        ),
        updated_at = now()
    `);
  } catch (e) {
    console.error("registrarUsoModelo:", e);
  }
}

/** Resumen del mes para la barra del menú: por modelo, total, presupuesto del asistente público y lo gastado por las personas. */
export async function resumenUsoIA() {
  const mes = mesActual();
  const inicio = new Date();
  inicio.setUTCDate(1);
  inicio.setUTCHours(0, 0, 0, 0);

  const [fila, limites, gastos, asistente] = await Promise.all([
    db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, usoKey(mes))).limit(1).then((r) => r[0]),
    getLimites(),
    getGastos(),
    db
      .select({ gasto: sql<string>`coalesce(sum(${assistantQueries.costUsd}), 0)` })
      .from(assistantQueries)
      .where(gte(assistantQueries.createdAt, inicio))
      .then((r) => Number(r[0]?.gasto ?? 0)),
  ]);

  const crudo = (fila?.value && typeof fila.value === "object" && !Array.isArray(fila.value) ? fila.value : {}) as Record<string, Partial<UsoModelo>>;
  const modelos = Object.entries(crudo)
    .map(([ref, u]) => {
      const r = leerRef(ref);
      return {
        ref,
        proveedor: r?.provider ?? "google",
        modelo: r?.model ?? ref,
        entrada: Number(u.in ?? 0),
        salida: Number(u.out ?? 0),
        llamadas: Number(u.n ?? 0),
        usd: Number(u.usd ?? 0),
      };
    })
    .sort((a, b) => b.usd - a.usd);

  return {
    mes,
    modelos,
    totalUsd: modelos.reduce((s, m) => s + m.usd, 0),
    presupuestoAsistenteUsd: limites.presupuestoMensualUsd,
    gastoAsistenteUsd: asistente,
    gastoPersonasUsd: Object.values(gastos).reduce((s, v) => s + (Number(v) || 0), 0),
  };
}

export type ResumenUsoIA = Awaited<ReturnType<typeof resumenUsoIA>>;
