import { cantidadDeMapasDeNotas, xmlDeIndice } from "@/lib/sitemap-notas";
import { siteUrl } from "@/lib/utils";

/**
 * Índice de mapas del sitio (`/sitemap.xml`): las páginas generales, una tanda de notas por archivo y el mapa de Google Noticias.
 * Es la misma dirección que usaba el sitio anterior, así lo que ya está enviado en Search Console sigue valiendo.
 */
export const dynamic = "force-dynamic";

// Índice con las páginas generales, las tandas de notas y el mapa de Noticias.
export async function GET() {
  let tandas = 1;
  try {
    tandas = Math.max(1, await cantidadDeMapasDeNotas());
  } catch {
    /* sin base: el índice sale con la primera tanda para no devolver un error a los buscadores */
  }
  const mapas = [
    { url: siteUrl("/sitemaps/paginas.xml") },
    ...Array.from({ length: tandas }, (_, i) => ({ url: siteUrl(`/sitemaps/notas-${i + 1}.xml`) })),
    { url: siteUrl("/news-sitemap.xml") },
  ];
  return new Response(xmlDeIndice(mapas), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600" },
  });
}
