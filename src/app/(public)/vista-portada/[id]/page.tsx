import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paginas } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { sanearPagina } from "@/lib/paginas-bloques";
import { VistaPortadaSeccion } from "../../_pages/categoria";

/**
 * Vista previa del constructor para la portada de una sección: la sección REAL (menú, encabezado, filtros, banners, laterales y notas)
 * con la portada guardada en borrador en su lugar. Solo para quien puede editar la portada; nunca se indexa ni se guarda en caché.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista previa de la portada de sección", robots: { index: false, follow: false } };

export default async function VistaPortada({ params }: { params: Promise<{ id: string }> }) {
  await requirePermiso("portada");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [p] = await db.select({ slug: paginas.slug, contenido: paginas.contenido }).from(paginas).where(eq(paginas.id, id)).limit(1);
  const m = p?.slug.match(/^([a-z0-9-]+)\/inicio$/);
  if (!p || !m) notFound();
  return VistaPortadaSeccion({ slug: m[1], contenido: sanearPagina(p.contenido) });
}
