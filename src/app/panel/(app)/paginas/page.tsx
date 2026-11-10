import { desc, eq } from "drizzle-orm";
import { ChevronDown } from "lucide-react";
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
  await requirePermiso("portada");
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
          Crea y arma páginas para tu sitio. Pulsa <strong>Editar</strong> para abrir el constructor; una página nueva queda en borrador hasta que la publiques.
        </p>
      </header>

      <ListaPaginas
        paginas={lista.map((p) => ({ id: p.id, titulo: p.titulo, slug: p.slug, publicada: p.publicada, actualizada: p.updatedAt.toISOString(), seccion: p.seccion, seccionId: p.seccionId }))}
        secciones={secciones}
      />

      {/* El mapa de secciones sigue disponible para ordenar el menú, pero ya no estorba para trabajar con las páginas. */}
      <details className="group rounded-2xl border border-[var(--border)] bg-white/70">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
          <span>
            Mapa del sitio y secciones
            <span className="ml-2 text-xs font-normal text-[var(--fg-muted)]">Ordena el menú, crea o renombra secciones</span>
          </span>
          <ChevronDown size={16} aria-hidden className="transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-[var(--border)] p-4">
          <ArbolPaginas sections={arbol} paginas={lista.map(({ id, titulo, slug, publicada, seccionId }) => ({ id, titulo, slug, publicada, seccionId }))} />
        </div>
      </details>
    </div>
  );
}
