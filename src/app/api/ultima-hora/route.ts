import { NextResponse } from "next/server";
import { getBreakingArticle, getBreakingSlugs } from "@/lib/content";
import { TAG_CDN_PORTAL } from "@/lib/data-cache";

/**
 * «Última hora» para las páginas estáticas (notas, autores): sus insignias se pintan en el navegador con esto, así activar o quitar
 * la marca no regenera ninguna nota. La red de Vercel guarda la respuesta 30 s y la sirve mientras la renueva; además lleva la etiqueta
 * `portal`, que el panel borra al cambiar la marca (`invalidarCache`), así el cambio se ve casi al instante.
 */
export const dynamic = "force-dynamic";

// Dirección válida de una nota (las insignias se pintan con CSS a partir de ella).
const SLUG = /^[a-z0-9-]+$/;

// GET /api/ultima-hora → { slugs: las notas marcadas a la vista, nota: la más reciente (la que lleva la insignia en su portada) }
export async function GET() {
  try {
    const [slugs, nota] = await Promise.all([getBreakingSlugs(), getBreakingArticle()]);
    return NextResponse.json(
      { slugs: slugs.filter((s) => SLUG.test(s)), nota: nota && SLUG.test(nota.slug) ? { slug: nota.slug } : null },
      {
        headers: {
          "Cache-Control": "public, max-age=0, must-revalidate",
          "Vercel-CDN-Cache-Control": "s-maxage=30, stale-while-revalidate=300",
          "Vercel-Cache-Tag": TAG_CDN_PORTAL,
        },
      },
    );
  } catch {
    // Si la base falla no se guarda nada en la red: la siguiente visita lo vuelve a intentar.
    return NextResponse.json({ slugs: [], nota: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
