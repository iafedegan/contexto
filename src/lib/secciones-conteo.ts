import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { cachear, TAG_CONTENIDO } from "@/lib/data-cache";

/**
 * Las secciones con cuántas notas tiene cada una, para el editor de portada y su vista previa. Contar recorre las 51 mil notas, y el editor lo
 * pedía en cada cambio (cada ajuste recarga el lienzo): se guarda un minuto y se renueva al instante al editar secciones o publicar.
 */
export const seccionesConConteo = cachear(
  "panel-secciones-conteo",
  () =>
    db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        sortOrder: categories.sortOrder,
        parentId: categories.parentId,
        articleCount: sql<number>`count(${articles.id})::int`,
      })
      .from(categories)
      .leftJoin(articles, eq(articles.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
  { tags: [TAG_CONTENIDO], segundos: 60 },
);
