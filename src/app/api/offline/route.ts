import { NextResponse } from "next/server";
import { getRecentArticles } from "@/lib/content";

/**
 * Qué descarga el Service Worker para leer sin conexión (public/sw.js):
 * la portada y las últimas notas con su foto de portada. Solo URLs públicas
 * de lectura; nada del panel ni de la IA.
 */
export const revalidate = 300;

const LIMIT = 25;

export async function GET() {
  let items: Awaited<ReturnType<typeof getRecentArticles>> = [];
  try {
    items = await getRecentArticles(LIMIT);
  } catch {
    /* sin base de datos: solo la portada */
  }
  return NextResponse.json({
    pages: ["/", ...items.map((a) => `/articulo/${a.slug}`)],
    images: items.map((a) => a.coverImageUrl).filter((u): u is string => !!u),
    articles: items.map((a) => ({ slug: a.slug, title: a.title })),
  });
}
