import { buildFeed, RSS_HEADERS } from "@/lib/rss";

/** Feed RSS general: las últimas notas de todas las secciones, con texto completo. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const feed = await buildFeed();
    return new Response(feed!.xml, { headers: RSS_HEADERS });
  } catch {
    return new Response("Feed no disponible", { status: 503 });
  }
}
