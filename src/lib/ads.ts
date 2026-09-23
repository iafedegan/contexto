import "server-only";
import { and, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adsZones } from "@/db/schema";

/**
 * Tamaños de creatividad por zona (§9 del Anexo comercial). Cada `key` debe
 * coincidir con una fila sembrada en `ads_zones` (ver src/db/seed-data.ts).
 * El esquema no modela ancho/alto por fila: el tamaño es una propiedad fija
 * de la zona, no de la creatividad, así que vive aquí como constante.
 */
export const AD_ZONE_SPECS = {
  /** Leaderboard bajo el menú principal. */
  home_top: { width: 728, height: 90 },
  /** Billboard entre la noticia destacada y la grilla. */
  home_billboard: { width: 970, height: 250 },
  /** Rectángulo insertado dentro de la grilla, cada 6-8 noticias. */
  home_grid: { width: 300, height: 250 },
  /** Barra lateral, parte superior (above the fold). */
  sidebar_top: { width: 300, height: 250 },
  /** Barra lateral, media página con comportamiento fijo al hacer scroll. */
  sidebar_sticky: { width: 300, height: 600 },
  /** Rectángulo del artículo (plantilla de una sola columna). */
  article_sidebar: { width: 300, height: 250 },
  /** Leaderboard antes del pie. */
  footer: { width: 728, height: 90 },
} as const;

export type AdZoneKey = keyof typeof AD_ZONE_SPECS;

export type AdsZoneContent = {
  html: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
};

const activeNow = and(
  eq(adsZones.active, true),
  or(isNull(adsZones.startsAt), sql`${adsZones.startsAt} <= now()`),
  or(isNull(adsZones.endsAt), gte(adsZones.endsAt, sql`now()`)),
);

/** Creatividad activa de una zona, o null si está vacía/inactiva/fuera de vigencia. */
export async function getAdsZone(key: AdZoneKey): Promise<AdsZoneContent | null> {
  const [row] = await db
    .select({ html: adsZones.html, imageUrl: adsZones.imageUrl, clickUrl: adsZones.clickUrl })
    .from(adsZones)
    .where(and(eq(adsZones.key, key), activeNow))
    .limit(1);
  if (!row || (!row.html && !row.imageUrl)) return null;
  return row;
}
