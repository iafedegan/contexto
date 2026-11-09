import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, paginas } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { sanearPagina } from "@/lib/paginas-bloques";
import { ConstructorPagina } from "@/components/panel/constructor-pagina";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diseñar página" };

// El constructor de una página: filas, columnas y elementos que se arrastran.
export default async function DisenarPagina({ params }: { params: Promise<{ id: string }> }) {
  await requirePermiso("portada");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [[p], secciones] = await Promise.all([
    db.select().from(paginas).where(eq(paginas.id, id)).limit(1),
    db.select({ slug: categories.slug, name: categories.name }).from(categories).orderBy(categories.sortOrder, categories.name),
  ]);
  if (!p) notFound();
  return (
    <ConstructorPagina
      pagina={{ id: p.id, titulo: p.titulo, slug: p.slug, descripcion: p.descripcion ?? "", publicada: p.publicada, contenido: sanearPagina(p.contenido) }}
      secciones={secciones}
    />
  );
}
