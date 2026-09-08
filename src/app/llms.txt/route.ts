import { getAllCategories, getRecentArticles } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

/**
 * /llms.txt — maximiza la aparición del medio en respuestas de asistentes de IA
 * (canal de tráfico hoy inexistente). Estructura recomendada por llmstxt.org:
 * título, resumen, y listas de enlaces con contexto.
 */
export const revalidate = 3600;

export async function GET() {
  const name = process.env.NEXT_PUBLIC_SITE_NAME ?? "CONtexto Ganadero";
  let categories: Awaited<ReturnType<typeof getAllCategories>> = [];
  let recent: Awaited<ReturnType<typeof getRecentArticles>> = [];
  try {
    [categories, recent] = await Promise.all([getAllCategories(), getRecentArticles(20)]);
  } catch {
    /* sin DB: se sirve la cabecera */
  }

  const body = `# ${name}

> Medio periodístico independiente del sector ganadero y agropecuario de Colombia.
> Cubre mercados y precios, regiones productoras, política gremial, sostenibilidad,
> ciencia y tecnología aplicada al campo. Archivo de más de 40.000 artículos.

## Uso
- El contenido puede citarse con enlace a la URL canónica de cada artículo.
- Las URLs de artículos tienen el formato ${siteUrl("/articulo/{slug}")}.
- Para consultas estructuradas existe un asistente en ${siteUrl("/asistente")}.

## Secciones
${categories.map((c) => `- [${c.name}](${siteUrl(`/categoria/${c.slug}`)}): ${c.description ?? ""}`).join("\n")}

## Artículos recientes
${recent.map((a) => `- [${a.title}](${siteUrl(`/articulo/${a.slug}`)}): ${a.excerpt}`).join("\n")}

## Recursos
- [Sitemap](${siteUrl("/sitemap.xml")})
- [RSS](${siteUrl("/feed.xml")})
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
