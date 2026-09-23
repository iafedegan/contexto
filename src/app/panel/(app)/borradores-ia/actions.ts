"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentDrafts, articles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { generateDraft } from "@/agents/draft-generator";
import { getDemoSource } from "@/agents/sources";

/**
 * Aprobar un borrador de agente NO lo publica. Crea un artículo en estado
 * "borrador", atribuido al editor que aprueba (nunca al sistema), y lo abre en
 * el editor para que el editor haga la publicación como acción explícita aparte.
 */
export async function approveDraft(draftId: string) {
  const user = await requireRole("editor");

  const [d] = await db.select().from(agentDrafts).where(eq(agentDrafts.id, draftId)).limit(1);
  if (!d || d.status !== "pendiente") throw new Error("Borrador no disponible.");

  const [article] = await db
    .insert(articles)
    .values({
      slug: slugify(d.title) || slugify(`nota-${Date.now()}`),
      title: d.title,
      excerpt: d.excerpt,
      body: d.body,
      categoryId: d.suggestedCategoryId,
      status: "borrador",
      createdBy: user.id, // atribución al editor humano
      originDraftId: d.id,
    })
    .returning({ id: articles.id });

  await db
    .update(agentDrafts)
    .set({
      status: "aprobado",
      approvedBy: user.id,
      approvedAt: sql`now()`,
      publishedArticleId: article.id,
    })
    .where(eq(agentDrafts.id, draftId));

  revalidatePath("/panel/borradores-ia");
  redirect(`/panel/articulos/${article.id}?desde_borrador=1`);
}

/**
 * Ejecuta el AGENTE de producción editorial sobre una fuente estructurada de
 * demostración: genera un borrador, lo verifica y lo deja en la cola. Nunca
 * publica. Muestra el flujo completo aunque no haya proveedor de IA configurado.
 */
export async function runAgentOnDemoSource(formData: FormData) {
  await requireRole("editor");
  const key = String(formData.get("sourceKey") ?? "");
  const source = getDemoSource(key);
  if (!source) throw new Error("Fuente de demostración desconocida.");

  const result = await generateDraft(source);
  revalidatePath("/panel/borradores-ia");
  revalidatePath("/panel");
  if ("skipped" in result) throw new Error(result.skipped);
}

export async function rejectDraft(formData: FormData) {
  const user = await requireRole("editor");
  const draftId = String(formData.get("draftId"));
  const reason = String(formData.get("reason") ?? "").trim();

  await db
    .update(agentDrafts)
    .set({
      status: "rechazado",
      approvedBy: user.id,
      approvedAt: sql`now()`,
      rejectionReason: reason || "Sin motivo especificado",
    })
    .where(eq(agentDrafts.id, draftId));

  revalidatePath("/panel/borradores-ia");
}
