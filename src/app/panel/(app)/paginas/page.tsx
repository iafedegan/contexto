import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, paginas } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { ListaPaginas } from "@/components/panel/lista-paginas";
import { ArbolPaginas } from "@/components/panel/arbol-paginas";
import { seccionesConConteo } from "@/lib/secciones-conteo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Páginas" };

// Las páginas armadas con el constructor: crear, editar, publicar, duplicar y eliminar desde una sola lista.
export default async function Paginas() {
  await requirePermiso("paginas");
  const [lista, secciones, arbol] = await Promise.all([
    db
      .select({ id: paginas.id, titulo: paginas.titulo, slug: paginas.slug, publicada: paginas.publicada, updatedAt: paginas.updatedAt, seccion: categories.name, seccionId: paginas.seccionId })
      .from(paginas)
      .leftJoin(categories, eq(categories.id, paginas.seccionId))
      .orderBy(desc(paginas.updatedAt)),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).orderBy(categories.sortOrder, categories.name),
    seccionesConConteo(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Diseño</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Páginas</h1>
        <p className="mt-2 max-w-2xl text-[var(--fg-muted)]">
          Pulsa una sección del mapa para ver sus subsecciones, ordenarlas y diseñar su portada. Debajo están todas las páginas: una nueva queda en borrador hasta que la publiques.
        </p>
      </header>

      {/* El mapa del sitio, en grande y dentro de la página: se pulsa una sección y a la derecha salen sus subsecciones (para ordenarlas),
          su portada y sus páginas. */}
      <ArbolPaginas sections={arbol} paginas={lista.map(({ id, titulo, slug, publicada, seccionId }) => ({ id, titulo, slug, publicada, seccionId }))} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Todas las páginas</h2>
        <ListaPaginas
          paginas={lista.map((p) => ({ id: p.id, titulo: p.titulo, slug: p.slug, publicada: p.publicada, actualizada: p.updatedAt.toISOString(), seccion: p.seccion, seccionId: p.seccionId }))}
          secciones={secciones}
        />
      </section>
    </div>
  );
}
