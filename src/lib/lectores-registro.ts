import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, readerSessions } from "@/db/schema";
import { clasificarFuente } from "@/lib/fuente-lectura";
import { perfilDeUa } from "@/lib/lectores-ua";
import type { EntradaInicio, EntradaProgreso } from "@/lib/lectores-entrada";

/**
 * Escritura de las lecturas por visitante (solo de quien aceptó la medición). El navegador avisa dos veces: al empezar a
 * leer (`iniciarLectura`, devuelve el código de la lectura) y mientras avanza (`registrarProgreso`, que solo sube el
 * avance: nunca lo baja ni lo pisa un mensaje atrasado). El `User-Agent` solo se usa para clasificar y no se guarda;
 * la IP no se lee aquí.
 */
export type Contexto = { userAgent: string | null; pais: string | null; region: string | null; ciudad: string | null; host: string };

/** Empieza una lectura. Devuelve su código, o `null` si la nota no existe o no está publicada. */
export async function iniciarLectura(e: EntradaInicio, c: Contexto): Promise<string | null> {
  const [nota] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.slug, e.slug), eq(articles.status, "publicado")))
    .limit(1);
  if (!nota) return null;
  const perfil = perfilDeUa(c.userAgent);
  // Un robot no es un lector: no entra a la medición.
  if (perfil.browser === "Robot") return null;
  const fuente = clasificarFuente({ ...e.utm, host: c.host });
  const [fila] = await db
    .insert(readerSessions)
    .values({
      visitorId: e.visitante,
      articleId: nota.id,
      device: perfil.device,
      browser: perfil.browser,
      os: perfil.os,
      country: c.pais?.slice(0, 2).toUpperCase() ?? null,
      region: c.region?.slice(0, 8).toUpperCase() ?? null,
      city: c.ciudad ? safeDecode(c.ciudad).slice(0, 80) : null,
      source: fuente.slice(0, 80),
      campaign: e.utm.utmCampaign ? e.utm.utmCampaign.slice(0, 80) : null,
      returning: e.recurrente,
    })
    .returning({ id: readerSessions.id });
  return fila?.id ?? null;
}

// Las cabeceras de ciudad de Vercel llegan codificadas («Bogot%C3%A1»).
function safeDecode(t: string) {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}

/** Sube el avance de una lectura. Solo la persona que la empezó (mismo visitante) puede actualizarla. */
export async function registrarProgreso(e: EntradaProgreso): Promise<boolean> {
  const r = await db
    .update(readerSessions)
    .set({
      maxScroll: sql`greatest(${readerSessions.maxScroll}, ${e.scroll})`,
      seconds: sql`greatest(${readerSessions.seconds}, ${e.segundos})`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(readerSessions.id, e.lectura), eq(readerSessions.visitorId, e.visitante)))
    .returning({ id: readerSessions.id });
  return r.length > 0;
}

/** Borra las lecturas más viejas que `dias` (retención). Devuelve cuántas. */
export async function purgarLecturas(dias: number): Promise<number> {
  const r = await db.execute(sql`delete from reader_sessions where created_at < now() - (${dias}::int * interval '1 day') returning 1`);
  return Array.isArray(r) ? r.length : ((r as { rows?: unknown[] }).rows?.length ?? 0);
}
