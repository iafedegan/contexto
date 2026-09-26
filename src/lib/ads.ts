import "server-only";
import { cache } from "react";
import { and, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adsZones } from "@/db/schema";
import { AD_ZONE_SPECS, positionOf, suffixOf, type AdPosition } from "@/lib/ads-positions";

export * from "@/lib/ads-positions";

/**
 * Publicidad. Cada POSICIÓN del sitio (`home_top`, `sidebar_top`…) admite varios
 * anuncios: el principal usa la clave de la posición y los que se añaden desde
 * el editor usan `<posición>__2`, `__3`… Se pintan apilados, por ese orden. Así
 * se puede poner un segundo anuncio debajo o encima sin tocar el código.
 */

export type AdsZoneContent = {
  key: string;
  html: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
};

const activeNow = and(
  eq(adsZones.active, true),
  or(isNull(adsZones.startsAt), sql`${adsZones.startsAt} <= now()`),
  or(isNull(adsZones.endsAt), gte(adsZones.endsAt, sql`now()`)),
);

export type AdsZoneRow = {
  /** `home_top`, `home_top__2`… */
  key: string;
  position: AdPosition;
  /** true para los anuncios añadidos (no el principal de la posición). */
  extra: boolean;
  name: string;
  html: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  width: number;
  height: number;
};

type Fila = typeof adsZones.$inferSelect;

function toRow(key: string, position: AdPosition, fila?: Fila): AdsZoneRow {
  const spec = AD_ZONE_SPECS[position];
  const n = suffixOf(key);
  return {
    key,
    position,
    extra: key !== position,
    name: fila?.name ?? (n > 1 ? `${spec.label} · anuncio ${n}` : spec.label),
    html: fila?.html ?? null,
    imageUrl: fila?.imageUrl ?? null,
    clickUrl: fila?.clickUrl ?? null,
    active: fila?.active ?? false,
    startsAt: fila?.startsAt ?? null,
    endsAt: fila?.endsAt ?? null,
    width: spec.width,
    height: spec.height,
  };
}

/**
 * Todas las posiciones, en el orden de `AD_ZONE_SPECS`, cada una con su
 * anuncio principal (aunque aún no exista en la base) y los adicionales.
 * Único punto de esta consulta: la usan Configuración y el editor de portada.
 */
export async function getAdsZoneRows(): Promise<AdsZoneRow[]> {
  const filas = await db.select().from(adsZones);
  const rows: AdsZoneRow[] = [];
  for (const position of Object.keys(AD_ZONE_SPECS) as AdPosition[]) {
    const propias = filas
      .filter((f) => positionOf(f.key) === position)
      .sort((a, b) => suffixOf(a.key) - suffixOf(b.key));
    rows.push(toRow(position, position, propias.find((f) => f.key === position)));
    for (const f of propias.filter((f) => f.key !== position)) rows.push(toRow(f.key, position, f));
  }
  return rows;
}

/** Anuncios activos y vigentes: una consulta por petición, no una por posición. */
const activeAds = cache(async (): Promise<AdsZoneContent[]> => {
  const rows = await db
    .select({ key: adsZones.key, html: adsZones.html, imageUrl: adsZones.imageUrl, clickUrl: adsZones.clickUrl })
    .from(adsZones)
    .where(activeNow);
  return rows.filter((r) => r.html || r.imageUrl);
});

/** Anuncios activos de una posición, en orden (principal primero). */
export async function getAdsForPosition(position: AdPosition): Promise<AdsZoneContent[]> {
  const rows = await activeAds();
  return rows
    .filter((r) => positionOf(r.key) === position)
    .sort((a, b) => suffixOf(a.key) - suffixOf(b.key));
}
