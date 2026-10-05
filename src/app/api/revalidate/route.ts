import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { invalidarCache } from "@/lib/data-cache";

/**
 * Revalidación ISR *on-demand*. La dispara el panel editorial al publicar,
 * despublicar o editar un artículo. Resuelve directamente el bug de caché del
 * diagnóstico (home sirviendo contenido viejo).
 *
 * Se usa como respaldo/externo; dentro del mismo proceso el panel llama a
 * `revalidatePath` directamente desde la Server Action.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const { paths = [], slug, categorySlug, authorSlug } = (await req.json()) as {
    paths?: string[];
    slug?: string;
    categorySlug?: string;
    authorSlug?: string;
  };

  const targets = new Set<string>(["/", "/sitemap.xml", "/feed.xml", ...paths]);
  if (slug) targets.add(`/articulo/${slug}`);
  if (categorySlug) targets.add(`/categoria/${categorySlug}`);
  if (authorSlug) targets.add(`/autor/${authorSlug}`);

  // Además de las rutas, se descarta la caché de datos de las lecturas del portal.
  invalidarCache();
  for (const t of targets) revalidatePath(t);

  return NextResponse.json({ revalidated: [...targets], at: Date.now() });
}
