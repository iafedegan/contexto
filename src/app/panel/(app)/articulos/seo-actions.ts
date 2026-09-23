"use server";

/**
 * Análisis externo de una nota antes de publicarla.
 *
 * Se audita la vista previa firmada (no la URL pública, que para un borrador
 * todavía no existe), de modo que Lighthouse ve exactamente el HTML que servirá
 * el portal: mismos metadatos, mismo JSON-LD, mismas imágenes.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { signPreviewToken } from "@/lib/preview-token";
import { publicBase, runPageSpeed, type PsiResult } from "@/lib/psi";

export async function analizarConGoogle(
  articleId: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<PsiResult> {
  await requireRole("redactor");

  const [row] = await db
    .select({ id: articles.id, slug: articles.slug, status: articles.status })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!row) return { ok: false, error: "El artículo ya no existe." };

  const base = await publicBase();
  if (!base) {
    return {
      ok: false,
      error:
        "No hay una dirección pública que Google pueda abrir. Indica el dominio en Configuración › Sitio, o una base pública (túnel) en Analítica y SEO.",
    };
  }

  // Publicado: se audita la URL real. Borrador: la vista previa con su token.
  const url =
    row.status === "publicado" && row.slug
      ? `${base}/articulo/${row.slug}`
      : `${base}/vista-previa/${row.id}?t=${signPreviewToken(row.id)}`;

  return runPageSpeed(url, strategy);
}
