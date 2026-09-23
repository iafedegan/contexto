"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, siteSettings, type HomeLayoutConfig, type HomeStyle } from "@/db/schema";
import { requireRole } from "@/lib/auth";

export type HomeLayoutEntry = {
  id: string;
  homeStyle: HomeStyle | null;
};

/**
 * Persiste el diseño manual de la portada: orden y estilo de cada tarjeta.
 * `entries` va en el orden exacto en que deben aparecer (posición 0 =
 * principal). Cualquier artículo que tuviera algo fijado y ya no esté en la
 * lista vuelve a su comportamiento por defecto.
 */
export async function saveHomeLayout(entries: HomeLayoutEntry[]) {
  await requireRole("editor");

  await Promise.all(
    entries.map((e, i) =>
      db
        .update(articles)
        .set({ homePosition: i, homeStyle: e.homeStyle && Object.keys(e.homeStyle).length > 0 ? e.homeStyle : null })
        .where(eq(articles.id, e.id)),
    ),
  );

  const ids = entries.map((e) => e.id);
  await db
    .update(articles)
    .set({ homePosition: null, homeStyle: null })
    .where(
      ids.length > 0
        ? and(isNotNull(articles.homePosition), notInArray(articles.id, ids))
        : isNotNull(articles.homePosition),
    );

  revalidatePath("/");
  revalidatePath("/panel/portada");
}

/** Quita todo el diseño manual: la portada vuelve a su comportamiento por defecto. */
export async function resetHomeLayout() {
  await requireRole("editor");
  await db.update(articles).set({ homePosition: null, homeStyle: null }).where(isNotNull(articles.homePosition));
  revalidatePath("/");
  revalidatePath("/panel/portada");
}

/**
 * Guarda la disposición de las secciones de la portada (independiente del
 * contenido): si "En breve" es vertical u horizontal, cuántas columnas, y
 * cuántas columnas tiene la cuadrícula "Lo más reciente".
 */
export async function saveHomeSectionLayout(config: HomeLayoutConfig) {
  await requireRole("editor");
  await db
    .insert(siteSettings)
    .values({ key: "home_layout", value: config })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: sql`now()` } });
  // La plantilla tiñe TODO el portal (artículo, sección, buscador…), así que
  // se revalida el árbol entero y no solo la portada.
  revalidatePath("/", "layout");
  revalidatePath("/panel/portada");
}
