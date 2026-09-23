import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { requireRole } from "@/lib/auth";

/**
 * Activa Draft Mode y redirige a /articulo/[slug] para que el editor pueda ver
 * un artículo en cualquier estado (borrador, en_revision, programado), no solo
 * "publicado". Exige sesión de panel (mínimo rol redactor); el enlace "Vista
 * previa" del editor apunta aquí en vez de a la ruta pública directamente.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireRole("redactor");
  } catch {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  void user;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

  const [row] = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "artículo no encontrado" }, { status: 404 });

  (await draftMode()).enable();
  redirect(`/articulo/${row.slug}`);
}
