import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

/**
 * La columna que la portada muestra como «Columna destacada». Se anota en `site_settings` (sin migración): `{ articleId }`.
 * Sin una elegida, la portada usa la última columna del Dr. Lafaurie (ver `getUltimaColumnaLafaurie`).
 */
export const COLUMNA_KEY = "columna_destacada";

export async function columnaDestacadaId(): Promise<string | null> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, COLUMNA_KEY)).limit(1);
  const id = (row?.value as { articleId?: unknown } | undefined)?.articleId;
  return typeof id === "string" && id ? id : null;
}

/** Fija la columna destacada (la nueva reemplaza a la anterior), o la quita si `articleId` es null y la elegida era esa. */
export async function fijarColumnaDestacada(articleId: string, activa: boolean): Promise<void> {
  if (activa) {
    await db.insert(siteSettings).values({ key: COLUMNA_KEY, value: { articleId } }).onConflictDoUpdate({ target: siteSettings.key, set: { value: { articleId }, updatedAt: new Date() } });
  } else if ((await columnaDestacadaId()) === articleId) {
    await db.delete(siteSettings).where(eq(siteSettings.key, COLUMNA_KEY));
  }
}
