import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { guardApi, json, CORS_HEADERS } from "@/lib/api/guard";

export const dynamic = "force-dynamic";

/** GET /api/v1/categorias — la taxonomía completa del sitio. */
export async function GET(req: Request) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.res;

  const rows = await db
    .select({ slug: categories.slug, nombre: categories.name, descripcion: categories.description, categoriaPadre: categories.parentId })
    .from(categories)
    .orderBy(asc(categories.sortOrder));
  return json({ items: rows });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
