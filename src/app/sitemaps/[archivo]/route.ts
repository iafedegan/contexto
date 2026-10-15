import { notFound } from "next/navigation";
import { notasDelMapa, paginasDelMapa, xmlDeDirecciones } from "@/lib/sitemap-notas";
import { siteUrl } from "@/lib/utils";
import { rutaDeNota } from "@/lib/ruta-nota";

/**
 * Cada archivo del mapa del sitio: `/sitemaps/paginas.xml` (portada, secciones, autores) y `/sitemaps/notas-N.xml` (una tanda de notas).
 * Se arman al pedirlos (nunca en el despliegue: consultaría decenas de miles de filas) y la red de Vercel los guarda unos minutos.
 */
export const dynamic = "force-dynamic";

// Un archivo del mapa del sitio, según su nombre.
export async function GET(_req: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params;
  const cabeceras = { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600" };
  if (archivo === "paginas.xml") {
    const paginas = await paginasDelMapa().catch(() => []);
    return new Response(xmlDeDirecciones(paginas.map((p) => ({ url: p.url, cambio: p.cambio, prioridad: p.prioridad }))), { headers: cabeceras });
  }
  const m = archivo.match(/^notas-(\d{1,3})\.xml$/);
  if (!m || Number(m[1]) < 1) notFound();
  const notas = await notasDelMapa(Number(m[1]));
  return new Response(xmlDeDirecciones(notas.map((n) => ({ url: siteUrl(rutaDeNota(n)), fecha: n.updatedAt, cambio: "weekly", prioridad: 0.8 }))), { headers: cabeceras });
}
