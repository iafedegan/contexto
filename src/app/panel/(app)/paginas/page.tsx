import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, paginas } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { NuevaPagina } from "@/components/panel/nueva-pagina";
import { BorrarPagina } from "@/components/panel/borrar-pagina";
import { ArbolPaginas } from "@/components/panel/arbol-paginas";
import { seccionesConConteo } from "@/lib/secciones-conteo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Páginas" };

// Lista de las páginas armadas con el constructor y el botón para crear una.
export default async function Paginas() {
  await requirePermiso("portada");
  const [lista, secciones, arbol] = await Promise.all([
    db
      .select({ id: paginas.id, titulo: paginas.titulo, slug: paginas.slug, publicada: paginas.publicada, updatedAt: paginas.updatedAt, seccion: categories.name })
      .from(paginas)
      .leftJoin(categories, eq(categories.id, paginas.seccionId))
      .orderBy(desc(paginas.updatedAt)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.sortOrder, categories.name),
    seccionesConConteo(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Páginas</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--fg-muted)]">
            Cree una página y ármela como en un CMS: divida cada fila en columnas y arrastre títulos, textos, imágenes, botones o notas a cada una.
            Queda en borrador hasta que la publique.
          </p>
        </div>
        <NuevaPagina secciones={secciones} />
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* Árbol del sitio: para ver dónde va a quedar la página. Pulse una sección y use «Página nueva en …». */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">Árbol del sitio</h2>
          <p className="text-xs text-[var(--fg-muted)]">Pulse la sección de la que va a colgar la página y use «Página nueva en …». «Ver árbol completo» lo abre en grande.</p>
          <ArbolPaginas sections={arbol} />
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="text-sm font-bold">Páginas creadas ({lista.length})</h2>
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] p-10 text-center text-sm text-[var(--fg-muted)]">Todavía no hay páginas. Cree la primera con «Nueva página».</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {lista.map((p) => (
            <li key={p.id} className="flex items-center gap-1 pr-3 transition hover:bg-[var(--surface-2)]">
              <Link href={`/panel/paginas/${p.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-5 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.titulo}</span>
                  <span className="block font-mono text-xs text-[var(--fg-muted)]">/{p.slug}{p.seccion ? ` · en ${p.seccion}` : ""}</span>
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.publicada ? "bg-[#16a34a]/15 text-[#15803d]" : "bg-[#f2a900]/20 text-[#8a6200]"}`}>{p.publicada ? "Publicada" : "Borrador"}</span>
                <span className="text-xs text-[var(--fg-muted)]">{p.updatedAt.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}</span>
              </Link>
              <BorrarPagina id={p.id} titulo={p.titulo} />
            </li>
          ))}
        </ul>
      )}
        </section>
      </div>
    </div>
  );
}
