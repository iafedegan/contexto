import { notFound, permanentRedirect, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, redirects } from "@/db/schema";
import { slugDeNotaAntigua } from "@/lib/nota-antigua";
import { resolveLegacyTaxonomy } from "@/lib/redirects";
import { rutaDeNota } from "@/lib/ruta-nota";

/**
 * Qué hacer con una dirección del sitio anterior que no es la de una nota migrada (esas se sirven directamente, ver
 * `app/(public)/[seccion]/[slug]`): aplica las redirecciones de la tabla `redirects` (la copia repetida de una nota, columnistas…), busca por
 * título las notas publicadas después de la última carga, manda las secciones antiguas a su categoría nueva y, si nada coincide, 404.
 * Nunca vuelve: redirige o responde 404.
 */
export async function resolverRutaAntigua(path: string[]): Promise<never> {
  const completa = "/" + path.join("/");
  // `/SearchColumnista/<id>/<página>`: la página de un columnista del sitio anterior. Se busca sin el número de página.
  const fromPath = /^\/SearchColumnista\/[^/]+\/\d*$/i.test(completa) ? completa.split("/").slice(0, 3).join("/") : completa;

  let row: { toPath: string; statusCode: number } | undefined;
  try {
    [row] = await db
      .select({ toPath: redirects.toPath, statusCode: redirects.statusCode })
      .from(redirects)
      .where(eq(redirects.fromPath, fromPath))
      .limit(1);
  } catch {
    row = undefined;
  }

  if (!row) {
    // `/seccion/titulo` de una nota publicada después de la última carga: se busca por el título y se manda a su dirección.
    const slug = slugDeNotaAntigua(path);
    if (slug) {
      let nota: { slug: string; legacyPath: string | null } | undefined;
      try {
        [nota] = await db
          .select({ slug: articles.slug, legacyPath: articles.legacyPath })
          .from(articles)
          .where(and(eq(articles.slug, slug), eq(articles.status, "publicado")))
          .limit(1);
      } catch {
        nota = undefined;
      }
      if (nota) {
        const destino = rutaDeNota(nota);
        if (destino !== fromPath) permanentRedirect(destino);
      }
      // Nota que no se migró: si el sitio anterior sigue vivo en otra dirección (variable SITIO_ANTIGUO_URL), se manda allí con una
      // redirección temporal (302: mañana puede estar migrada).
      const antiguo = (process.env.SITIO_ANTIGUO_URL ?? "").trim().replace(/\/+$/, "");
      if (antiguo && /^https:\/\//.test(antiguo)) redirect(`${antiguo}${fromPath}`);
    }
    // Sin nota con ese título: la sección antigua sigue llevando a su categoría nueva.
    const categoria = resolveLegacyTaxonomy(fromPath);
    if (categoria) permanentRedirect(categoria);
    notFound();
  }

  // Métrica de seguimiento para Search Console / analítica interna.
  db.update(redirects)
    .set({ hits: sql`${redirects.hits} + 1` })
    .where(eq(redirects.fromPath, fromPath))
    .catch(() => {});

  if (row.toPath === fromPath) notFound(); // protección contra un bucle
  if (row.statusCode === 301) permanentRedirect(row.toPath);
  redirect(row.toPath);
}
