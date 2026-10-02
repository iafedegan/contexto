import "server-only";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { estimateCostUsd } from "@/lib/budget";

/**
 * Cuota mensual de IA por persona, en USD. La fija un administrador: una
 * `predeterminada` para todos y, opcionalmente, una propia por persona
 * (`null` o vacía = usa la predeterminada; sin ninguna = sin tope).
 *
 * Ambos viven en `site_settings` (sin tablas nuevas):
 *  - `ai_quotas`          → { predeterminada, personas: { [userId]: usd } }
 *  - `ai_spend_YYYY-MM`   → { [userId]: usd gastados ese mes }
 * El gasto se suma con un UPSERT atómico, así dos generaciones a la vez no se
 * pisan. El costo es una ESTIMACIÓN por tokens (ver `estimateCostUsd`).
 */
export const CUOTAS_KEY = "ai_quotas";
export type Cuotas = { predeterminada: number | null; personas: Record<string, number> };

const mesActual = () => new Date().toISOString().slice(0, 7);
const spendKey = (mes = mesActual()) => `ai_spend_${mes}`;

export const getCuotas = cache(async (): Promise<Cuotas> => {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, CUOTAS_KEY)).limit(1);
    const v = (row?.value ?? {}) as Partial<Cuotas>;
    return {
      predeterminada: typeof v.predeterminada === "number" ? v.predeterminada : null,
      personas: v.personas && typeof v.personas === "object" ? v.personas : {},
    };
  } catch {
    return { predeterminada: null, personas: {} };
  }
});

export const getGastos = cache(async (): Promise<Record<string, number>> => {
  try {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, spendKey())).limit(1);
    const v = row?.value;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
});

/** Tope de esta persona este mes (null = sin tope). */
export function cuotaDe(c: Cuotas, userId: string): number | null {
  const propia = c.personas[userId];
  return typeof propia === "number" ? propia : c.predeterminada;
}

export const fmtUsd = (n: number) => `US$ ${n.toFixed(n < 10 ? 2 : 0)}`;

/** Se llama ANTES de gastar tokens: corta si la persona ya agotó su cuota. */
export async function verificarCuotaIA(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const [c, gastos] = await Promise.all([getCuotas(), getGastos()]);
  const tope = cuotaDe(c, userId);
  if (tope === null) return { ok: true };
  const gasto = gastos[userId] ?? 0;
  if (gasto >= tope) {
    return {
      ok: false,
      message: `Alcanzaste tu cuota mensual de IA (${fmtUsd(gasto)} de ${fmtUsd(tope)}). Se renueva el primer día del mes; si la necesitas antes, pídele a un administrador que la amplíe.`,
    };
  }
  return { ok: true };
}

type Uso = { inputTokens?: number | { total?: number } | undefined; outputTokens?: number | { total?: number } | undefined } | undefined;
const n = (v: number | { total?: number } | undefined) => (typeof v === "number" ? v : (v?.total ?? 0));

/** Se llama DESPUÉS de cada llamada al modelo con su `usage`. Nunca rompe la acción. */
export async function registrarUsoIA(userId: string, usage: Uso): Promise<void> {
  return registrarCostoIA(userId, estimateCostUsd(n(usage?.inputTokens), n(usage?.outputTokens)));
}

/** Suma un costo ya calculado en USD (p. ej. una imagen generada, que se cobra por unidad y no por tokens). */
export async function registrarCostoIA(userId: string, costo: number): Promise<void> {
  try {
    if (!(costo > 0)) return;
    await db.execute(sql`
      insert into site_settings (key, value) values (${spendKey()}, jsonb_build_object(${userId}::text, ${costo}::numeric))
      on conflict (key) do update set
        value = jsonb_set(site_settings.value, array[${userId}::text], to_jsonb(coalesce((site_settings.value->>${userId}::text)::numeric, 0) + ${costo}::numeric)),
        updated_at = now()
    `);
  } catch (e) {
    console.error("registrarUsoIA:", e);
  }
}
