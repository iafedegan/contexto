"use server";

import { requirePermiso } from "@/lib/auth";
import { getFuentes, type FuenteLectura } from "@/lib/view-sources";

/** Orígenes de las lecturas de una nota (para el panel de Artículos). */
export async function fuentesDeNota(articleId: string): Promise<FuenteLectura[]> {
  await requirePermiso("articulos");
  return getFuentes(articleId);
}
