import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { clasificarFuente } from "@/lib/fuente-lectura";

/**
 * «¿Desde dónde los leen?»: origen de cada lectura (UTM de campañas y boletín, o el sitio de
 * procedencia), agregado por artículo y mes en `site_settings` (clave `view_sources_YYYY-MM`),
 * así no hace falta migrar la base. No se guarda IP ni identificador del visitante: solo un contador.
 */
const claveMes = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Bogota" }).format(d).slice(0, 7);
// Clave mensual donde se cuentan las fuentes de lectura.
const key = (mes: string) => `view_sources_${mes}`;

// Origen de cada lectura: la clasificación (pura) vive en fuente-lectura.ts para poder probarla sin base de datos.
export { clasificarFuente };

// Suma una lectura a la fuente indicada del mes actual; si falla, no afecta la lectura.
export async function registrarFuente(articleId: string, etiqueta: string): Promise<void> {
  try {
    await db.execute(sql`
      insert into site_settings (key, value, updated_at)
      values (${key(claveMes())}, jsonb_build_object(${articleId}::text, jsonb_build_object(${etiqueta}::text, 1)), now())
      on conflict (key) do update set
        value = jsonb_set(
          site_settings.value,
          array[${articleId}::text],
          coalesce(site_settings.value -> ${articleId}::text, '{}'::jsonb)
            || jsonb_build_object(${etiqueta}::text, coalesce((site_settings.value -> ${articleId}::text ->> ${etiqueta}::text)::int, 0) + 1)
        ),
        updated_at = now()
    `);
  } catch (err) {
    console.warn("[view-sources]", err);
  }
}

// Origen de lecturas de una nota y cuántas aportó.
export type FuenteLectura = { fuente: string; lecturas: number };

/** Orígenes de un artículo en el mes actual y el anterior (≈ últimos 30-60 días), de mayor a menor. */
export async function getFuentes(articleId: string): Promise<FuenteLectura[]> {
  try {
    const hoy = new Date();
    const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15);
    const rows = await db.select({ value: siteSettings.value }).from(siteSettings).where(inArray(siteSettings.key, [key(claveMes(hoy)), key(claveMes(prev))]));
    const suma = new Map<string, number>();
    for (const r of rows) {
      const por = (r.value as Record<string, Record<string, number>>)?.[articleId] ?? {};
      for (const [f, n] of Object.entries(por)) suma.set(f, (suma.get(f) ?? 0) + Number(n));
    }
    return [...suma.entries()].map(([fuente, lecturas]) => ({ fuente, lecturas })).sort((a, b) => b.lecturas - a.lecturas).slice(0, 12);
  } catch {
    return [];
  }
}
