import "server-only";
import { asc, sql } from "drizzle-orm";
import { db, rowsOf } from "@/db";
import { categories } from "@/db/schema";
import { cachear, TAG_CONTENIDO } from "@/lib/data-cache";

/**
 * Las secciones con cuántas notas tiene cada una, para el árbol de secciones y el editor de portada. Se cuenta IGUAL que la página de la
 * sección (`leerCategoria` en content.ts): notas publicadas de la sección y de sus subsecciones directas, por su sección principal
 * (`category_id`) o porque la llevan como sección secundaria (`secciones`), cada nota una sola vez. Antes solo se contaba `category_id`
 * de la propia sección, y México, Mundo o Colombia salían en 0 aunque su página tuviera notas.
 * Recorre las 51 mil notas en una sola pasada: se guarda un minuto y se renueva al instante al editar secciones o publicar.
 */
export const seccionesConConteo = cachear(
  "panel-secciones-conteo-v2",
  async () => {
    const [lista, conteo] = await Promise.all([
      db
        .select({
          id: categories.id,
          slug: categories.slug,
          name: categories.name,
          description: categories.description,
          sortOrder: categories.sortOrder,
          parentId: categories.parentId,
        })
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db.execute(sql`
        with pub as (
          select id, category_id, secciones from articles where status = 'publicado' and published_at <= now()
        ),
        art as (
          select id, category_id as cat from pub where category_id is not null
          union
          select p.id, c.id from pub p
            cross join lateral jsonb_array_elements_text(case when jsonb_typeof(p.secciones) = 'array' then p.secciones else '[]'::jsonb end) s(slug)
            join categories c on c.slug = s.slug
        ),
        destino as (
          select art.id, art.cat from art
          union
          select art.id, c.parent_id from art join categories c on c.id = art.cat where c.parent_id is not null
        )
        select cat as id, count(distinct id)::int as n from destino group by cat
      `),
    ]);
    const filas = rowsOf<{ id: string; n: number }>(conteo);
    const n = new Map(filas.map((f) => [f.id, Number(f.n)]));
    return lista.map((c) => ({ ...c, articleCount: n.get(c.id) ?? 0 }));
  },
  { tags: [TAG_CONTENIDO], segundos: 60 },
);
