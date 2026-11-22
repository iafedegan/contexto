import { NextResponse } from "next/server";
import { datosDelCintillo } from "@/components/cintillo-mercado";
import { TAG_CDN_PORTAL } from "@/lib/data-cache";

/**
 * Cotizaciones del cintillo de arriba para las páginas estáticas (notas, autores): se pintan en el navegador con esto, así la
 * actualización diaria de los precios no regenera ninguna nota. Llegan ya formateadas (mismo texto que en el servidor). La red de Vercel
 * guarda la respuesta 5 minutos; lleva la etiqueta `portal`, que el panel borra al guardar el diseño.
 */
export const dynamic = "force-dynamic";

// GET /api/cintillo?l=es|en → { piezas, veces, segundos, color } (piezas vacías si el cintillo está apagado o no hay datos)
export async function GET(req: Request) {
  const locale = new URL(req.url).searchParams.get("l") === "en" ? "en" : "es";
  const datos = await datosDelCintillo(locale).catch(() => null);
  return NextResponse.json(datos ?? { piezas: [], veces: 1, segundos: 0 }, {
    headers: datos
      ? {
          "Cache-Control": "public, max-age=0, must-revalidate",
          "Vercel-CDN-Cache-Control": "s-maxage=300, stale-while-revalidate=3600",
          "Vercel-Cache-Tag": TAG_CDN_PORTAL,
        }
      : { "Cache-Control": "no-store" },
  });
}
