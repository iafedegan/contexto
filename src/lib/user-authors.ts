import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authors, users } from "@/db/schema";
import { slugify } from "@/lib/utils";

/**
 * Cada persona con cuenta activa del panel debe poder elegirse como autor de una
 * nota. `authors` es una tabla aparte (puede haber firmas sin login), así que aquí
 * se crea, si falta, la ficha de autor vinculada a cada usuario activo.
 */
export async function ensureUserAuthors(): Promise<void> {
  const [activos, existentes] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)),
    db.select({ userId: authors.userId, slug: authors.slug }).from(authors),
  ]);
  const vinculados = new Set(existentes.map((a) => a.userId).filter(Boolean));
  const slugs = new Set(existentes.map((a) => a.slug));
  for (const u of activos) {
    if (vinculados.has(u.id)) continue;
    const base = slugify(u.name) || "autor";
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
    slugs.add(slug);
    await db.insert(authors).values({ slug, name: u.name, userId: u.id }).onConflictDoNothing();
  }
}
