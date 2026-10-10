import { notFound, permanentRedirect, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, redirects } from "@/db/schema";
import { slugDeNotaAntigua } from "@/lib/nota-antigua";
import { resolveLegacyTaxonomy } from "@/lib/redirects";

/**
 * Catch-all de baja prioridad. Resuelve las redirecciones 301 uno-a-uno de la
 * tabla `redirects` (las de taxonomía completa las hace el proxy, src/proxy.ts).
 * Si no hay coincidencia -> 404.
 *
 * NOTA: los artículos del archivo histórico NO llegan aquí: viven en el dominio
 * legado con sus rutas originales y nunca se enrutan por el portal nuevo.
 */
export const dynamic = "force-dynamic";

// Rutas que no existen: aplica las redirecciones antiguas (taxonomía legada y tabla redirects) o responde 404.
export default async function CatchAll({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const fromPath = "/" + path.join("/");

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
    // Direcciones del sitio anterior (`/seccion/titulo`): el título final se conservó al migrar, así que se busca la nota por él
    // y se manda con un 301 permanente a su dirección nueva. Solo notas publicadas; si no existe, 404 como siempre.
    const slug = slugDeNotaAntigua(path);
    if (slug) {
      let nota: { slug: string } | undefined;
      try {
        [nota] = await db
          .select({ slug: articles.slug })
          .from(articles)
          .where(and(eq(articles.slug, slug), eq(articles.status, "publicado")))
          .limit(1);
      } catch {
        nota = undefined;
      }
      if (nota) permanentRedirect(`/articulo/${nota.slug}`);
      // Nota que no se migró: si el sitio anterior sigue vivo en otra dirección (variable SITIO_ANTIGUO_URL, p. ej.
      // https://antiguo.contextoganadero.com), se manda allí con una redirección temporal (302: mañana puede estar migrada).
      const antiguo = (process.env.SITIO_ANTIGUO_URL ?? "").trim().replace(/\/+$/, "");
      if (antiguo && /^https:\/\//.test(antiguo)) redirect(`${antiguo}${fromPath}`);
    }
    // Sin nota con ese título: la sección antigua sigue llevando a su categoría nueva, como antes.
    const categoria = resolveLegacyTaxonomy(fromPath);
    if (categoria) permanentRedirect(categoria);
    notFound();
  }

  // Métrica de seguimiento para Search Console / analítica interna.
  db.update(redirects)
    .set({ hits: sql`${redirects.hits} + 1` })
    .where(eq(redirects.fromPath, fromPath))
    .catch(() => {});

  if (row.statusCode === 301) permanentRedirect(row.toPath);
  redirect(row.toPath);
}
