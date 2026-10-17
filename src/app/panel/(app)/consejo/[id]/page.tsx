import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, editorialPlans, editorialSlots } from "@/db/schema";
import { canPublish, requirePermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos-server";
import { sincronizarCasillas } from "@/lib/ai/consejo-ejecucion";
import { escritoresParaElegir } from "@/lib/ai/estilo";
import { ConsejoEditor, type CasillaVista } from "@/components/panel/consejo-editor";
import { sanearConfig, sanearFicha, type EstadoCasilla, type EstadoPlan } from "@/lib/consejo/plan";

export const metadata = { title: "Consejo de redacción" };
export const dynamic = "force-dynamic";

/** Un consejo de redacción: semana, temas, pauta con calendario y puesta en marcha. */
export default async function ConsejoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paso?: string }> }) {
  const user = await requirePermiso("articulos");
  const { id } = await params;
  const { paso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await sincronizarCasillas(id).catch(() => undefined);
  const [plan] = await db.select().from(editorialPlans).where(eq(editorialPlans.id, id)).limit(1);
  if (!plan) notFound();
  const [filas, todasLasSecciones, puedePublicar, escritoresTodos] = await Promise.all([
    db.select().from(editorialSlots).where(eq(editorialSlots.planId, id)).orderBy(asc(editorialSlots.publishAt)),
    db.select({ id: categories.id, parentId: categories.parentId, slug: categories.slug, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    tienePermiso(user.id, user.role, "publicar").then((p) => p && canPublish(user.role)),
    escritoresParaElegir(user),
  ]);
  // Secciones y subsecciones: cada sección seguida de sus hijas («Padre › Hija»).
  const secciones = todasLasSecciones.filter((c) => !c.parentId).flatMap((p) => [
    { slug: p.slug, name: p.name },
    ...todasLasSecciones.filter((h) => h.parentId === p.id).map((h) => ({ slug: h.slug, name: `${p.name} › ${h.name}` })),
  ]);
  const escritores = escritoresTodos.map((e) => ({ id: e.id, nombre: e.nombre, tipo: e.tipo, conDiagnostico: e.conDiagnostico }));
  const casillas: CasillaVista[] = filas.map((c) => ({
    id: c.id, publishAt: c.publishAt.toISOString(), sectionSlug: c.sectionSlug, topic: c.topic, angle: c.angle, brief: c.brief, priority: c.priority,
    approval: c.approval === "auto" ? "auto" : "manual", status: c.status as EstadoCasilla, articleId: c.articleId, error: c.error, ficha: sanearFicha(c.ficha),
  }));
  return <ConsejoEditor plan={{ id: plan.id, title: plan.title, weekStart: plan.weekStart, status: plan.status as EstadoPlan, config: sanearConfig(plan.config), temas: plan.temas ?? [] }} casillas={casillas} secciones={secciones} puedePublicar={puedePublicar} escritores={escritores} yoId={user.id} pasoInicial={Math.max(0, (Number(paso) || 1) - 1)} />;
}
