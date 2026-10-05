import { buildFeed, RSS_HEADERS } from "@/lib/rss";

/** Feed RSS de una sección (incluye sus subsecciones). */
export const dynamic = "force-dynamic";

// Feed RSS de una sección y sus subsecciones.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const feed = await buildFeed(slug);
    if (!feed) return new Response("Sección no encontrada", { status: 404 });
    return new Response(feed.xml, { headers: RSS_HEADERS });
  } catch {
    return new Response("Feed no disponible", { status: 503 });
  }
}
