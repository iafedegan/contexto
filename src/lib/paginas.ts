import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, paginas } from "@/db/schema";
import { cachear } from "@/lib/data-cache";
import { getArticlesByCategory } from "@/lib/content";
import { rutaDeNota } from "@/lib/ruta-nota";
import { sanearPagina, type ContenidoPagina } from "@/lib/paginas-bloques";
import type { NotaMini } from "@/components/pagina-vista";

/** Etiqueta de caché de las páginas del constructor: la borran las acciones del panel al guardar o publicar. */
export const TAG_PAGINAS = "paginas";

export type PaginaPublica = { id: string; slug: string; titulo: string; descripcion: string | null; contenido: ContenidoPagina };

/** Página publicada por su dirección (null si no existe o está en borrador). */
export const getPaginaPublicada = cachear(
  "pagina-publicada",
  async (slug: string): Promise<PaginaPublica | null> => {
    const [p] = await db
      .select({ id: paginas.id, slug: paginas.slug, titulo: paginas.titulo, descripcion: paginas.descripcion, contenido: paginas.contenido, publicada: paginas.publicada })
      .from(paginas)
      .where(eq(paginas.slug, slug))
      .limit(1);
    if (!p || !p.publicada) return null;
    return { id: p.id, slug: p.slug, titulo: p.titulo, descripcion: p.descripcion, contenido: sanearPagina(p.contenido) };
  },
  { tags: [TAG_PAGINAS], segundos: 300 },
);

export type PaginaDeSeccion = { slug: string; titulo: string; descripcion: string | null };

/** Páginas publicadas que cuelgan de una sección (por la dirección de la sección), por título: así el lector llega a ellas desde la propia sección. */
export const getPaginasDeSeccion = cachear(
  "paginas-de-seccion",
  async (seccionSlug: string): Promise<PaginaDeSeccion[]> => {
    const filas = await db
      .select({ slug: paginas.slug, titulo: paginas.titulo, descripcion: paginas.descripcion })
      .from(paginas)
      .innerJoin(categories, eq(paginas.seccionId, categories.id))
      .where(and(eq(categories.slug, seccionSlug), eq(paginas.publicada, true)))
      .orderBy(asc(paginas.titulo))
      .limit(24);
    return filas;
  },
  { tags: [TAG_PAGINAS], segundos: 300 },
);

/** Las notas que piden los elementos «notas» de una página, por sección. */
export async function notasDeLaPagina(c: ContenidoPagina): Promise<Record<string, NotaMini[]>> {
  const pedidas = new Map<string, number>();
  for (const f of c.filas) for (const celda of f.celdas) for (const e of celda) if (e.tipo === "notas" && e.seccion) pedidas.set(e.seccion, Math.max(pedidas.get(e.seccion) ?? 0, e.cantidad));
  const out: Record<string, NotaMini[]> = {};
  await Promise.all(
    [...pedidas.keys()].map(async (slug) => {
      try {
        const l = await getArticlesByCategory(slug);
        out[slug] = l.items.slice(0, pedidas.get(slug)).map((a) => ({ slug: a.slug, href: rutaDeNota(a), title: a.title, excerpt: a.excerpt, coverImageUrl: a.coverImageUrl }));
      } catch {
        out[slug] = [];
      }
    }),
  );
  return out;
}
