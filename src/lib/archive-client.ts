import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { archiveIndex } from "@/db/schema";
import { embed } from "./embeddings";

/**
 * Cliente de SOLO LECTURA de la API del sistema actual (contextoganadero.com).
 *
 * Principio de arquitectura #1: los ~41.000 artículos existentes permanecen en el
 * sistema actual con sus URLs intactas. Aquí solo se construye un espejo de
 * metadatos + embeddings en `archive_index`. NUNCA se escribe de vuelta.
 */

const BASE = process.env.ARCHIVE_API_BASE_URL;
// Clave de acceso a la API del archivo histórico (opcional).
const KEY = process.env.ARCHIVE_API_KEY;

// Artículo tal como lo entrega la API del archivo histórico.
export type ArchiveApiItem = {
  id: string;
  url: string;
  title: string;
  summary: string;
  category?: string | null;
  publishedAt?: string | null;
  // Texto plano para calcular el embedding y el hash de cambio. No se persiste.
  contentText?: string | null;
};

// Página de resultados de la API: artículos y cursor de la página siguiente.
type ListResponse = { items: ArchiveApiItem[]; nextCursor: string | null };

// Pide una página de 100 artículos a la API (solo lectura), opcionalmente solo los actualizados desde una fecha.
async function fetchPage(cursor: string | null, since: string | null): Promise<ListResponse> {
  if (!BASE) throw new Error("ARCHIVE_API_BASE_URL no configurada");
  const url = new URL("/articles", BASE);
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);
  if (since) url.searchParams.set("updatedSince", since);

  const res = await fetch(url, {
    headers: KEY ? { Authorization: `Bearer ${KEY}` } : {},
    // El archivo cambia poco; cachear no es crítico y el job corre en background.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`archive API ${res.status}: ${await res.text()}`);
  return (await res.json()) as ListResponse;
}

// Huella SHA-256 del contenido origen: sirve para saber si un artículo cambió sin volver a calcular su embedding.
function hashOf(item: ArchiveApiItem): string {
  return createHash("sha256")
    .update(`${item.title}\n${item.summary}\n${item.contentText ?? ""}`)
    .digest("hex");
}

// Resumen de una sincronización: artículos vistos, guardados y omitidos por no haber cambiado.
export type SyncResult = { scanned: number; upserted: number; skipped: number };

/**
 * Sincroniza el índice. `since` = ISO date para incremental; null = full scan.
 * Idempotente: solo re-embebe cuando cambia el hash del contenido origen.
 */
export async function syncArchiveIndex(since: string | null = null): Promise<SyncResult> {
  const result: SyncResult = { scanned: 0, upserted: 0, skipped: 0 };
  let cursor: string | null = null;

  // Hashes actuales para detectar sin cambios.
  const existing = new Map<string, string>();
  for (const row of await db
    .select({ id: archiveIndex.externalId, hash: archiveIndex.sourceHash })
    .from(archiveIndex)) {
    existing.set(row.id, row.hash);
  }

  do {
    const page: ListResponse = await fetchPage(cursor, since);
    for (const item of page.items) {
      result.scanned++;
      const hash = hashOf(item);
      if (existing.get(item.id) === hash) {
        result.skipped++;
        continue;
      }

      const vec = await embed(`${item.title}\n\n${item.summary}\n\n${item.contentText ?? ""}`);
      const common = {
        canonicalUrl: item.url,
        title: item.title,
        summary: item.summary,
        legacyCategory: item.category ?? null,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        sourceHash: hash,
        ...(vec ? { embedding: vec } : {}),
      };

      await db
        .insert(archiveIndex)
        .values({ externalId: item.id, ...common })
        .onConflictDoUpdate({
          target: archiveIndex.externalId,
          set: { ...common, syncedAt: new Date() },
        });
      result.upserted++;
    }
    cursor = page.nextCursor;
  } while (cursor);

  return result;
}
