import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, paginas } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { MAX_OCULTAS, sanearPagina, SLUG_INICIO_SITIO } from "@/lib/paginas-bloques";
import { ConstructorPagina } from "@/components/panel/constructor-pagina";
import { getArticlesByCategory } from "@/lib/content";
import { getSiteTheme } from "@/lib/site-theme";

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
  // La portada propia de una sección («{seccion}/inicio») se arma viendo la sección real: su encabezado arriba y sus notas debajo.
  const m = p.slug.match(/^([a-z0-9-]+)\/inicio$/);
  const [cat] = m
    ? await db.select({ slug: categories.slug, name: categories.name, description: categories.description }).from(categories).where(eq(categories.slug, m[1])).limit(1)
    : [];
  const contenido = sanearPagina(p.contenido);
  const ocultas = contenido.ocultas ?? [];
  // Las notas de la sección y la plantilla del sitio: debajo de la portada se ven con la composición real de la sección. Se traen de más
  // (sin quitar las ocultas) para que, al quitar o volver a mostrar una nota en el lienzo, la lista se complete sin recargar.
  const [listado, site] = cat
    ? await Promise.all([getArticlesByCategory(cat.slug, { limit: 9 + ocultas.length + 12 }).catch(() => null), getSiteTheme().catch(() => null)])
    : [null, null];
  // El id (para abrir la nota en el editor) y el título de cada nota que se ve o que se quitó.
  const slugsNotas = [...new Set([...(listado?.items.map((a) => a.slug) ?? []), ...ocultas])].slice(0, 30 + MAX_OCULTAS);
  const fichas = slugsNotas.length
    ? await db.select({ id: articles.id, slug: articles.slug, titulo: articles.title }).from(articles).where(inArray(articles.slug, slugsNotas)).catch(() => [])
    : [];
  return (
    <div className="flex flex-col gap-3">
      <Link href="/panel/paginas" className="inline-flex items-center gap-1.5 self-start rounded-full px-1 py-1 text-sm font-semibold text-[var(--accent)] hover:underline">
        <ArrowLeft size={15} aria-hidden /> Todas las páginas
      </Link>
      <ConstructorPagina
        pagina={{ id: p.id, titulo: p.titulo, slug: p.slug, descripcion: p.descripcion ?? "", publicada: p.publicada, contenido }}
        secciones={secciones}
        esInicio={p.slug === SLUG_INICIO_SITIO}
        seccionPortada={
          cat
            ? {
                slug: cat.slug,
                nombre: cat.name,
                descripcion: cat.description,
                total: listado?.total ?? 0,
                notas: listado?.items ?? [],
                fichas: Object.fromEntries(fichas.map((f) => [f.slug, { id: f.id, titulo: f.titulo }])),
                tema: site?.parts.body ?? "esmeralda",
              }
            : null
        }
      />
    </div>
  );
}
