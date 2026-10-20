import "server-only";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, editorialPlans, editorialSlots } from "@/db/schema";
import { listarEscritores } from "@/lib/ai/estilo";
import { rutaDeNota } from "@/lib/ruta-nota";

export type TareaEquipo = {
  id: string;
  planId: string;
  plan: string;
  tema: string;
  seccion: string;
  publicaEn: Date;
  estado: string;
  error: string | null;
  editorId: string;
  editor: string;
  articleId: string | null;
  /** Dirección pública, solo si la nota ya está publicada. */
  enlacePublico: string | null;
};

// El estado de la pieza puede ir un paso atrás del de su nota (se sincroniza por pasadas): lo que se ve sigue a la nota.
function estadoReal(estadoPieza: string, estadoNota: string | null): string {
  if (estadoNota === "publicado") return "publicada";
  if (estadoNota === "programado") return "programada";
  if (estadoNota === "en_revision" && estadoPieza === "redactando") return "revision";
  return estadoPieza;
}

/** Las piezas de los consejos activos o cerrados con quién las tiene a cargo (el escritor de la pieza o, si no, el del consejo) y el enlace de su nota. */
export async function tareasDelEquipo(): Promise<TareaEquipo[]> {
  const [filas, escritores] = await Promise.all([
    db
      .select({
        id: editorialSlots.id,
        planId: editorialSlots.planId,
        plan: editorialPlans.title,
        tema: editorialSlots.topic,
        slug: editorialSlots.sectionSlug,
        seccion: categories.name,
        publicaEn: editorialSlots.publishAt,
        estado: editorialSlots.status,
        error: editorialSlots.error,
        editorId: sql<string>`coalesce(${editorialSlots.ficha}->>'escritorId', ${editorialPlans.config}->>'escritorId', '')`,
        articleId: editorialSlots.articleId,
        articuloSlug: articles.slug,
        articuloRuta: articles.legacyPath,
        articuloEstado: articles.status,
      })
      .from(editorialSlots)
      .innerJoin(editorialPlans, eq(editorialPlans.id, editorialSlots.planId))
      .leftJoin(categories, eq(categories.slug, editorialSlots.sectionSlug))
      .leftJoin(articles, eq(articles.id, editorialSlots.articleId))
      .where(and(inArray(editorialPlans.status, ["activo", "cerrado"]), ne(editorialSlots.status, "omitida")))
      .orderBy(desc(editorialSlots.publishAt))
      .limit(400),
    listarEscritores().catch(() => []),
  ]);
  const nombre = new Map(escritores.map((e) => [e.id, e.nombre]));
  return filas.map((f) => ({
    id: f.id, planId: f.planId, plan: f.plan, tema: f.tema, seccion: f.seccion ?? f.slug, publicaEn: f.publicaEn, estado: estadoReal(f.estado, f.articuloEstado), error: f.error,
    editorId: f.editorId, editor: f.editorId ? nombre.get(f.editorId) ?? "Sin identificar" : "Sin asignar", articleId: f.articleId,
    enlacePublico: f.articuloEstado === "publicado" && f.articuloSlug ? rutaDeNota({ slug: f.articuloSlug, legacyPath: f.articuloRuta }) : null,
  }));
}
