import { NextResponse } from "next/server";
import { getAnunciosVigentes } from "@/lib/ads";
import { TAG_CDN_PORTAL } from "@/lib/data-cache";

/**
 * Anuncios propios activos y vigentes, para las páginas estáticas (notas, autores, pie del sitio): se pintan en el navegador con esto,
 * así cargar, cambiar o apagar un anuncio no regenera ninguna nota. La red de Vercel guarda la respuesta 30 s y la sirve mientras la
 * renueva; lleva la etiqueta `portal`, que el panel borra al guardar un anuncio (`invalidarCache`).
 */
export const dynamic = "force-dynamic";

// GET /api/anuncios → { anuncios: [{ key, html, imageUrl, clickUrl }] } (todas las posiciones; cada espacio toma los suyos)
export async function GET() {
  try {
    const anuncios = await getAnunciosVigentes();
    return NextResponse.json(
      { anuncios },
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
    return NextResponse.json({ anuncios: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
