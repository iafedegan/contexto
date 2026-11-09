"use server";

/**
 * Páginas del constructor: crear, guardar el diseño, publicar/ocultar y borrar. Solo quien tiene el permiso «portada»
 * (administrador y diseñadora). Lo que llega del navegador pasa siempre por `sanearPagina`.
 */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, paginas } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { invalidarCache } from "@/lib/data-cache";
import { resolveLegacyTaxonomy } from "@/lib/redirects";
import { sanearPagina, slugPagina } from "@/lib/paginas-bloques";
import { TAG_PAGINAS } from "@/lib/paginas";

export type ResultadoPagina = { ok: true; id?: string } | { ok: false; error: string };

// Direcciones del sitio que una página no puede tomar.
const RESERVADAS = new Set([
  "articulo", "asistente", "autor", "boletin", "buscar", "categoria", "contacto", "derechos-de-autor", "en", "en-vivo", "feeds", "observatorio",
  "paute-con-nosotros", "politica-de-cookies", "politica-de-ia", "politica-de-privacidad", "politica-editorial", "preguntas-frecuentes",
  "quienes-somos", "terminos-y-condiciones", "panel", "api", "columna", "sitemap", "manifest", "robots",
]);

async function slugLibre(slug: string, excepto?: string): Promise<string | null> {
  if (!slug) return "Escriba una dirección (letras, números y guiones).";
  if (RESERVADAS.has(slug) || resolveLegacyTaxonomy(`/${slug}`)) return `La dirección «/${slug}» ya la usa el sitio. Elija otra.`;
  const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
  if (cat) return `«/${slug}» es el nombre de una sección. Elija otra dirección.`;
  const [otra] = await db.select({ id: paginas.id }).from(paginas).where(eq(paginas.slug, slug)).limit(1);
  if (otra && otra.id !== excepto) return `Ya hay una página en «/${slug}».`;
  return null;
}

function refrescar(slug?: string) {
  invalidarCache(TAG_PAGINAS);
  if (slug) revalidatePath(`/${slug}`);
  revalidatePath("/panel/paginas");
}

/** Crea una página en blanco (en borrador) y devuelve su id para abrir el constructor. */
export async function crearPagina(titulo: string, seccionId: string | null): Promise<ResultadoPagina> {
  const yo = await requirePermiso("portada");
  const t = titulo.trim().slice(0, 160);
  if (!t) return { ok: false, error: "Escriba el nombre de la página." };
  let slug = slugPagina(t);
  // Si la dirección está tomada, se le añade un número.
  for (let n = 2; (await slugLibre(slug)) && n < 50; n++) slug = `${slugPagina(t).slice(0, 74)}-${n}`;
  const error = await slugLibre(slug);
  if (error) return { ok: false, error };
  const [p] = await db
    .insert(paginas)
    .values({ titulo: t, slug, seccionId: seccionId || null, updatedBy: yo.id })
    .returning({ id: paginas.id });
  refrescar();
  return { ok: true, id: p.id };
}

/** Guarda título, dirección, descripción y el diseño. Si la página está publicada, el cambio se ve en el sitio. */
export async function guardarPagina(
  id: string,
  datos: { titulo: string; slug: string; descripcion: string; contenido: unknown },
): Promise<ResultadoPagina> {
  const yo = await requirePermiso("portada");
  const titulo = datos.titulo.trim().slice(0, 160);
  if (!titulo) return { ok: false, error: "La página necesita un título." };
  const slug = slugPagina(datos.slug);
  const error = await slugLibre(slug, id);
  if (error) return { ok: false, error };
  const [antes] = await db.select({ slug: paginas.slug }).from(paginas).where(eq(paginas.id, id)).limit(1);
  if (!antes) return { ok: false, error: "La página ya no existe." };
  await db
    .update(paginas)
    .set({ titulo, slug, descripcion: datos.descripcion.trim().slice(0, 400) || null, contenido: sanearPagina(datos.contenido), updatedBy: yo.id, updatedAt: new Date() })
    .where(eq(paginas.id, id));
  refrescar(slug);
  if (antes.slug !== slug) revalidatePath(`/${antes.slug}`);
  return { ok: true };
}

/** Publica u oculta la página. */
export async function publicarPagina(id: string, publicada: boolean): Promise<ResultadoPagina> {
  const yo = await requirePermiso("portada");
  const [p] = await db.update(paginas).set({ publicada, updatedBy: yo.id, updatedAt: new Date() }).where(eq(paginas.id, id)).returning({ slug: paginas.slug });
  if (!p) return { ok: false, error: "La página ya no existe." };
  refrescar(p.slug);
  return { ok: true };
}

/** Borra la página. */
export async function borrarPagina(id: string): Promise<ResultadoPagina> {
  await requirePermiso("portada");
  const [p] = await db.delete(paginas).where(eq(paginas.id, id)).returning({ slug: paginas.slug });
  refrescar(p?.slug);
  return { ok: true };
}
