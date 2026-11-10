import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div className="flex flex-col gap-3">
      <Link href="/panel/paginas" className="inline-flex items-center gap-1.5 self-start rounded-full px-1 py-1 text-sm font-semibold text-[var(--accent)] hover:underline">
        <ArrowLeft size={15} aria-hidden /> Todas las páginas
      </Link>
      <ConstructorPagina
        pagina={{ id: p.id, titulo: p.titulo, slug: p.slug, descripcion: p.descripcion ?? "", publicada: p.publicada, contenido: sanearPagina(p.contenido) }}
        secciones={secciones}
      />
    </div>
  );
}
