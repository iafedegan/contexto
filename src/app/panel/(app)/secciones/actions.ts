"use server";

import { revalidatePath } from "next/cache";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export type SeccionState = { ok: boolean; message: string } | null;

/**
 * Edita el nombre/descripción/orden de una sección (categoría). No toca el
 * `slug`: cambiarlo rompería la URL pública y las redirecciones ya
 * publicadas — eso queda fuera de este formulario a propósito.
 */
export async function actualizarSeccion(_prev: SeccionState, formData: FormData): Promise<SeccionState> {
  await requireRole("editor");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!id) return { ok: false, message: "Falta la sección." };
  if (!name) return { ok: false, message: "Falta el nombre." };
  if (!Number.isFinite(sortOrder)) return { ok: false, message: "Orden inválido." };

  const [row] = await db.select({ slug: categories.slug, parentId: categories.parentId }).from(categories).where(eq(categories.id, id));
  if (!row) return { ok: false, message: "Esa sección ya no existe." };

  await db.update(categories).set({ name, description: description || null }).where(eq(categories.id, id));

  // La posición elegida es la que ocupará en su nivel (1 = la primera): se
  // saca de la fila y se inserta ahí, y las demás se corren y se renumeran
  // 1, 2, 3… sin empates ni huecos.
  const sibs = await db
    .select({ id: categories.id, name: categories.name, sortOrder: categories.sortOrder })
    .from(categories)
    .where(row.parentId ? eq(categories.parentId, row.parentId) : isNull(categories.parentId));
  const otras = sibs
    .filter((x) => x.id !== id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"));
  const destino = Math.min(Math.max(Math.round(sortOrder), 1), sibs.length);
  const orden = [...otras.slice(0, destino - 1).map((x) => x.id), id, ...otras.slice(destino - 1).map((x) => x.id)];
  for (let k = 0; k < orden.length; k++) {
    const actual = sibs.find((x) => x.id === orden[k])!.sortOrder;
    if (actual !== k + 1) await db.update(categories).set({ sortOrder: k + 1 }).where(eq(categories.id, orden[k]));
  }

  revalidatePath(`/categoria/${row.slug}`);
  revalidatePath(`/en/categoria/${row.slug}`);
  // El menú principal y el pie leen las categorías en cada página.
  revalidatePath("/", "layout");

  return { ok: true, message: "Guardado ✓" };
}

// --- Estructura del árbol (padre, orden, altas y bajas) -----------------------

export type EstructuraResult = { ok: boolean; message: string };

async function refrescarMenu(slugs: (string | null | undefined)[] = []) {
  for (const s of slugs) {
    if (!s) continue;
    revalidatePath(`/categoria/${s}`);
    revalidatePath(`/en/categoria/${s}`);
  }
  // El menú y el pie leen las categorías en todas las páginas.
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/panel/portada");
}

/** Hermanas de un nivel, en el orden en que se muestran. */
async function hermanas(parentId: string | null) {
  const rows = await db
    .select({ id: categories.id, name: categories.name, sortOrder: categories.sortOrder })
    .from(categories)
    .where(parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId));
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"));
}

/**
 * Cambia de qué sección depende otra (o la vuelve principal con `null`). El
 * sitio maneja DOS niveles, así que solo se puede colgar de una sección
 * principal y una sección con subsecciones no puede colgar de otra.
 */
export async function moverSeccion(id: string, nuevoPadreId: string | null): Promise<EstructuraResult> {
  await requireRole("editor");
  const [s] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!s) return { ok: false, message: "Esa sección ya no existe." };
  if ((s.parentId ?? null) === nuevoPadreId) return { ok: true, message: "Sin cambios." };

  if (nuevoPadreId) {
    if (nuevoPadreId === id) return { ok: false, message: "Una sección no puede depender de sí misma." };
    const [p] = await db.select().from(categories).where(eq(categories.id, nuevoPadreId)).limit(1);
    if (!p) return { ok: false, message: "La sección elegida ya no existe." };
    if (p.parentId) return { ok: false, message: "Solo se puede colgar de una sección principal (el menú tiene dos niveles)." };
    const [hijo] = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).limit(1);
    if (hijo) return { ok: false, message: "Esta sección tiene subsecciones: muévelas primero para poder colgarla de otra." };
  }

  const dest = await hermanas(nuevoPadreId);
  await db
    .update(categories)
    .set({ parentId: nuevoPadreId, sortOrder: dest.length ? Math.max(...dest.map((d) => d.sortOrder)) + 1 : 1 })
    .where(eq(categories.id, id));
  await refrescarMenu([s.slug]);
  return { ok: true, message: nuevoPadreId ? "Sección movida." : "Ahora es una sección principal." };
}

/** Sube o baja una sección dentro de su nivel (renumera a las hermanas). */
export async function ordenarSeccion(id: string, dir: "arriba" | "abajo"): Promise<EstructuraResult> {
  await requireRole("editor");
  const [s] = await db.select({ parentId: categories.parentId, slug: categories.slug }).from(categories).where(eq(categories.id, id)).limit(1);
  if (!s) return { ok: false, message: "Esa sección ya no existe." };
  const list = await hermanas(s.parentId ?? null);
  const i = list.findIndex((x) => x.id === id);
  const j = dir === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: false, message: dir === "arriba" ? "Ya es la primera." : "Ya es la última." };
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    await db.update(categories).set({ sortOrder: k + 1 }).where(eq(categories.id, list[k].id));
  }
  await refrescarMenu([s.slug]);
  return { ok: true, message: "Orden actualizado." };
}

/** Crea una sección principal o una subsección (con `padreId`). */
export async function crearSeccion(nombre: string, padreId: string | null): Promise<EstructuraResult> {
  await requireRole("editor");
  const name = String(nombre ?? "").trim().slice(0, 80);
  if (name.length < 2) return { ok: false, message: "Escribe un nombre de al menos 2 caracteres." };

  if (padreId) {
    const [p] = await db.select({ parentId: categories.parentId }).from(categories).where(eq(categories.id, padreId)).limit(1);
    if (!p) return { ok: false, message: "La sección padre ya no existe." };
    if (p.parentId) return { ok: false, message: "Solo se pueden crear subsecciones bajo una sección principal." };
  }

  const base = slugify(name) || "seccion";
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const [dup] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
    if (!dup) break;
    slug = `${base}-${n}`;
  }
  const sibs = await hermanas(padreId);
  await db.insert(categories).values({
    name,
    slug,
    parentId: padreId,
    sortOrder: sibs.length ? Math.max(...sibs.map((x) => x.sortOrder)) + 1 : 1,
  });
  await refrescarMenu([slug]);
  return { ok: true, message: `Sección «${name}» creada.` };
}

/** Borra una sección vacía: sin notas ni subsecciones. */
export async function eliminarSeccion(id: string): Promise<EstructuraResult> {
  await requireRole("editor");
  const [s] = await db.select({ slug: categories.slug, name: categories.name }).from(categories).where(eq(categories.id, id)).limit(1);
  if (!s) return { ok: false, message: "Esa sección ya no existe." };
  const [nota] = await db.select({ id: articles.id }).from(articles).where(eq(articles.categoryId, id)).limit(1);
  if (nota) return { ok: false, message: "Tiene notas: muévelas a otra sección antes de borrarla." };
  const [hijo] = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).limit(1);
  if (hijo) return { ok: false, message: "Tiene subsecciones: muévelas o bórralas primero." };
  try {
    await db.delete(categories).where(eq(categories.id, id));
  } catch {
    return { ok: false, message: "Está en uso por otros registros (borradores, redirecciones…) y no se puede borrar." };
  }
  await refrescarMenu([s.slug]);
  return { ok: true, message: `Sección «${s.name}» eliminada.` };
}
