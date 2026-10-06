"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentDrafts } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { aprobarBorradorCore } from "@/lib/article-ops";
import { generateDraft } from "@/agents/draft-generator";
import { getDemoSource } from "@/agents/sources";

/**
 * Aprobar un borrador de agente NO lo publica. Crea un artículo en estado
 * "borrador", atribuido al editor que aprueba (nunca al sistema), y lo abre en
 * el editor para que el editor haga la publicación como acción explícita aparte.
 */
export async function approveDraft(draftId: string) {
  const user = await requirePermiso("borradores_ia");
  // Un solo sitio y una sola transacción (ver `aprobarBorradorCore`): aprobar dos veces no crea dos notas.
  const articleId = await aprobarBorradorCore(user.id, draftId);

  revalidatePath("/panel/borradores-ia");
  redirect(`/panel/articulos/${articleId}?desde_borrador=1`);
}

/**
 * Ejecuta el AGENTE de producción editorial sobre una fuente estructurada de
 * demostración: genera un borrador, lo verifica y lo deja en la cola. Nunca
 * publica. Muestra el flujo completo aunque no haya proveedor de IA configurado.
 */
export async function runAgentOnDemoSource(formData: FormData) {
  await requirePermiso("borradores_ia");
  const key = String(formData.get("sourceKey") ?? "");
  const source = getDemoSource(key);
  if (!source) throw new Error("Fuente de demostración desconocida.");

  const result = await generateDraft(source);
  revalidatePath("/panel/borradores-ia");
  revalidatePath("/panel");
  if ("skipped" in result) throw new Error(result.skipped);
}

// Rechaza un borrador de IA y guarda quién lo hizo y el motivo.
export async function rejectDraft(formData: FormData) {
  const user = await requirePermiso("borradores_ia");
  const draftId = String(formData.get("draftId"));
  const reason = String(formData.get("reason") ?? "").trim();

  // Solo se rechaza lo que sigue pendiente: sin esta condición, rechazar un borrador ya aprobado dejaba su nota huérfana.
  await db
    .update(agentDrafts)
    .set({
      status: "rechazado",
      approvedBy: user.id,
      approvedAt: sql`now()`,
      rejectionReason: reason || "Sin motivo especificado",
    })
    .where(and(eq(agentDrafts.id, draftId), eq(agentDrafts.status, "pendiente")));

  revalidatePath("/panel/borradores-ia");
}
