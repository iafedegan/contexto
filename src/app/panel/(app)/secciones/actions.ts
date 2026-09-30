"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireRole } from "@/lib/auth";

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

  const [row] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, id));
  if (!row) return { ok: false, message: "Esa sección ya no existe." };

  await db
    .update(categories)
    .set({ name, description: description || null, sortOrder })
    .where(eq(categories.id, id));

  revalidatePath(`/categoria/${row.slug}`);
  revalidatePath(`/en/categoria/${row.slug}`);
  // El menú principal y el pie leen las categorías en cada página.
  revalidatePath("/", "layout");

  return { ok: true, message: "Guardado ✓" };
}
