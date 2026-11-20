import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articleActivity, users } from "@/db/schema";

/**
 * Recorrido de una nota: por quién ha pasado y qué hizo cada persona (la creó, la recibió, la editó y cuántas palabras cambió, la pasó a otra,
 * la devolvió, la publicó), en orden. Sale del registro de actividad (`article_activity`, una fila por nota, persona, acción y día), así que no
 * necesita tabla nueva. Cuando alguien la pasa y otra persona la recibe casi al mismo tiempo, se dice a quién se la pasó.
 */
export type PasoRecorrido = {
  quien: string;
  tipo: string;
  /** Qué hizo, en palabras («editó: 12 palabras cambiadas», «se la pasó a Pedro Fonseca»…). */
  texto: string;
  cuando: string;
  veces: number;
};

const ACCION: Record<string, string> = {
  creo: "creó la nota",
  recibio: "la recibió",
  reviso: "la revisó",
  edito: "la editó",
  envio: "la pasó a otra persona",
  devolvio: "la devolvió",
  publico: "la publicó",
  programo: "la programó",
};

export async function recorridoDe(articleId: string): Promise<PasoRecorrido[]> {
  const filas = await db
    .select({ tipo: articleActivity.tipo, primera: articleActivity.primera, ultima: articleActivity.ultima, veces: articleActivity.veces, palabras: articleActivity.palabras, quien: users.name })
    .from(articleActivity)
    .innerJoin(users, eq(users.id, articleActivity.userId))
    .where(eq(articleActivity.articleId, articleId))
    .orderBy(asc(articleActivity.primera));
  // «Recibió» que llega a menos de 5 minutos de un «pasó»: así se sabe a quién se la pasó.
  const recibidas = filas.filter((f) => f.tipo === "recibio");
  return filas.map((f) => {
    let texto = ACCION[f.tipo] ?? f.tipo;
    if (f.tipo === "edito") texto = f.palabras > 0 ? `la editó · ${f.palabras} ${f.palabras === 1 ? "palabra cambiada" : "palabras cambiadas"}` : "la editó";
    if (f.tipo === "envio" || f.tipo === "devolvio") {
      const destino = recibidas.find((r) => Math.abs(new Date(r.primera).getTime() - new Date(f.ultima).getTime()) < 5 * 60_000 && r.quien !== f.quien);
      if (destino) texto = f.tipo === "envio" ? `se la pasó a ${destino.quien}` : `se la devolvió a ${destino.quien}`;
    }
    return { quien: f.quien, tipo: f.tipo, texto, cuando: new Date(f.ultima).toISOString(), veces: f.veces };
  });
}
