import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { SeccionForm } from "@/components/panel/seccion-form";

export const dynamic = "force-dynamic";

/**
 * Cada categoría del menú principal (Ganadería, Economía…) es una página
 * pública propia (/categoria/[slug]) que hasta ahora solo se podía tocar
 * editando la base de datos a mano — no había ninguna pantalla del panel
 * para su nombre o descripción, a diferencia de la portada.
 */
export default async function SeccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ abrir?: string }>;
}) {
  await requirePermiso("portada");
  const { abrir } = await searchParams;

  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      sortOrder: categories.sortOrder,
      articleCount: sql<number>`count(${articles.id})::int`,
    })
    .from(categories)
    .leftJoin(articles, eq(articles.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Diseño</p>
        <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">Secciones</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--fg-muted)]">
          Nombre, descripción (para buscadores) y orden en el menú de cada categoría. El{" "}
          <Link href="/panel/portada" className="lx-link text-[var(--accent)]">
            diseño de la portada
          </Link>{" "}
          se edita aparte; esto es lo que se ve al entrar a cada sección (p. ej. /categoria/ganaderia).
        </p>
      </header>

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <SeccionForm
            key={r.id}
            id={r.id}
            slug={r.slug}
            name={r.name}
            description={r.description}
            sortOrder={r.sortOrder}
            articleCount={r.articleCount}
            defaultOpen={r.slug === abrir}
          />
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-[var(--fg-muted)]">Todavía no hay secciones creadas.</p>
        )}
      </div>
    </div>
  );
}
