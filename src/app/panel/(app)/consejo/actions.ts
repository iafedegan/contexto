"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, editorialPlans, editorialSlots } from "@/db/schema";
import { canPublish, requirePermiso } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos-server";
import { armarPautaCore, autollenarPreguntasCore, completarFichaCore, proponerTemasConsejoCore } from "@/lib/ai/consejo-ia";
import { bloqueDeEscritor, escritoresParaElegir } from "@/lib/ai/estilo";
import { aprobarCasilla, procesarConsejo, sincronizarCasillas } from "@/lib/ai/consejo-ejecucion";
import { CONFIG_BASE, briefParaPrompt, respondidas, sanearBrief, construirParrilla, lunesDe, sanearConfig, sanearFicha, type BriefSeccion, type ConfigConsejo, type FichaPauta, type TemaConsejo } from "@/lib/consejo/plan";

/**
 * Acciones del consejo de redacción. Todo exige el permiso de redacción; activar un plan con casillas «automáticas» y aprobar piezas
 * exigen además poder publicar. La IA nunca publica por su cuenta: una casilla sale sola solo si un editor con permiso activó el plan
 * con esa casilla en «automática» (y la nota pasó el control de calidad).
 */
type Res<T = object> = ({ ok: true; message?: string } & T) | { ok: false; message: string };
const rev = (id?: string) => {
  revalidatePath("/panel/consejo");
  if (id) revalidatePath(`/panel/consejo/${id}`);
};

async function puedePublicar(user: { id: string; role: Parameters<typeof canPublish>[0] }) {
  return canPublish(user.role) && (await tienePermiso(user.id, user.role, "publicar"));
}

/** Crea un plan en borrador para la semana de una fecha. */
export async function crearPlan(input: { fecha: string; titulo?: string; escritorId?: string }): Promise<Res<{ id: string }>> {
  const user = await requirePermiso("articulos");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return { ok: false, message: "Elige una fecha válida." };
  const lunes = lunesDe(input.fecha);
  // Solo se acepta un escritor que esta persona pueda elegir.
  const escritorId = input.escritorId && (await escritoresParaElegir(user)).some((e) => e.id === input.escritorId) ? input.escritorId : undefined;
  const [row] = await db
    .insert(editorialPlans)
    .values({ title: input.titulo?.trim().slice(0, 120) || `Consejo de redacción · semana del ${new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(new Date(`${lunes}T12:00:00-05:00`))}`, weekStart: lunes, config: sanearConfig({ ...CONFIG_BASE, ...(escritorId ? { escritorId } : {}) }), createdBy: user.id })
    .returning({ id: editorialPlans.id });
  rev();
  return { ok: true, id: row.id };
}

/** Guarda la configuración y los temas del plan (solo en borrador o activo). */
export async function guardarPlan(id: string, input: { titulo?: string; config: ConfigConsejo; temas: TemaConsejo[] }): Promise<Res> {
  const user = await requirePermiso("articulos");
  const temas = (Array.isArray(input.temas) ? input.temas : [])
    .map((t) => ({ id: typeof t.id === "string" && t.id ? t.id.slice(0, 60) : randomUUID(), texto: String(t.texto ?? "").trim().slice(0, 200), seccion: t.seccion && /^[\w-]{1,80}$/.test(t.seccion) ? t.seccion : undefined, prioridad: (t.prioridad === 1 || t.prioridad === 3 ? t.prioridad : 2) as 1 | 2 | 3, origen: t.origen === "ia" ? ("ia" as const) : ("manual" as const), angulo: t.angulo ? String(t.angulo).slice(0, 400) : undefined, brief: t.brief && respondidas(sanearBrief(t.brief)) ? sanearBrief(t.brief) : undefined }))
    .filter((t) => t.texto.length >= 4)
    .slice(0, 60);
  const cfgGuardada = sanearConfig(input.config);
  if (cfgGuardada.escritorId && !(await escritoresParaElegir(user)).some((e) => e.id === cfgGuardada.escritorId)) delete cfgGuardada.escritorId;
  await db.update(editorialPlans).set({ ...(input.titulo?.trim() ? { title: input.titulo.trim().slice(0, 120) } : {}), config: cfgGuardada, temas, updatedAt: new Date() }).where(eq(editorialPlans.id, id));
  rev(id);
  return { ok: true };
}

/** La IA propone los temas de UNA sección (hasta `cantidad`, con búsqueda y fuentes). Son sugerencias: no entran al plan hasta que se añadan. */
export async function proponerTemas(id: string, opciones: { seccion?: string; cantidad?: number; enfoque?: string } = {}): Promise<Res<{ temas: TemaConsejo[]; fuentes: { title: string; url: string }[] }>> {
  const user = await requirePermiso("articulos");
  const [plan] = await db.select().from(editorialPlans).where(eq(editorialPlans.id, id)).limit(1);
  if (!plan) return { ok: false, message: "El plan ya no existe." };
  let seccion: { slug: string; name: string } | undefined;
  if (opciones.seccion) {
    const [c] = await db.select({ slug: categories.slug, name: categories.name }).from(categories).where(eq(categories.slug, opciones.seccion)).limit(1);
    if (!c) return { ok: false, message: "Esa sección ya no existe." };
    seccion = c;
  }
  const actuales = plan.temas ?? [];
  // Las respuestas del consejo a las preguntas de esa sección (temas de interés, audiencia, alcance, fuentes…) orientan la búsqueda.
  const briefTxt = seccion ? briefParaPrompt(seccion.name, sanearConfig(plan.config).briefs?.[seccion.slug]) : "";
  const enfoque = [opciones.enfoque?.trim(), briefTxt].filter(Boolean).join("\n") || undefined;
  const cfgP = sanearConfig(plan.config);
  const estilo = await bloqueDeEscritor(seccion ? cfgP.briefs?.[seccion.slug]?.escritorId ?? cfgP.escritorId : cfgP.escritorId);
  const r = await proponerTemasConsejoCore(user.id, { lunes: plan.weekStart, enfoque, estilo: estilo || undefined, seccion, cantidad: opciones.cantidad, yaTiene: actuales.map((t) => t.texto) });
  if (!r.ok) return { ok: false, message: r.error };
  return { ok: true, temas: r.temas, fuentes: r.fuentes, message: `La IA propuso ${r.temas.length} tema(s)${seccion ? ` para ${seccion.name}` : ""}: añade los que quieras.` };
}

/** La IA contesta las preguntas de un tema a partir de su descripción (con el estilo del escritor de esa sección si hay). */
export async function autollenarTema(planId: string, seccion: string, tema: string): Promise<Res<{ brief: BriefSeccion }>> {
  const user = await requirePermiso("articulos");
  if (tema.trim().length < 4) return { ok: false, message: "Describe primero el tema." };
  const [plan] = await db.select({ config: editorialPlans.config }).from(editorialPlans).where(eq(editorialPlans.id, planId)).limit(1);
  if (!plan) return { ok: false, message: "El plan ya no existe." };
  const cfg = sanearConfig(plan.config);
  const [cat] = await db.select({ name: categories.name }).from(categories).where(eq(categories.slug, seccion)).limit(1);
  const estilo = await bloqueDeEscritor(cfg.briefs?.[seccion]?.escritorId ?? cfg.escritorId);
  const r = await autollenarPreguntasCore(user.id, { tema, seccion: cat?.name ?? seccion, estilo: estilo || undefined });
  if (!r.ok) return { ok: false, message: r.error };
  return { ok: true, brief: r.brief, message: "Listo: revisa y corrige lo que quieras." };
}

/** Arma la pauta: construye la parrilla con las cuotas y la IA llena el tema, enfoque y encargo de cada casilla. Reemplaza las casillas aún sin redactar. */
export async function armarPauta(id: string, enfoque?: string): Promise<Res<{ casillas: number }>> {
  const user = await requirePermiso("articulos");
  const [plan] = await db.select().from(editorialPlans).where(eq(editorialPlans.id, id)).limit(1);
  if (!plan) return { ok: false, message: "El plan ya no existe." };
  const cfg = sanearConfig(plan.config);
  if (!cfg.cuotas.length) return { ok: false, message: "Indica cuántas notas por día quieres en al menos una sección." };
  const parrilla = construirParrilla(plan.weekStart, cfg);
  if (!parrilla.length) return { ok: false, message: "Esa semana ya pasó: crea el consejo para una semana que no haya terminado." };
  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
  const estilos: Record<string, string> = {};
  for (const [slug, b] of Object.entries(cfg.briefs ?? {})) { const t = await bloqueDeEscritor(b.escritorId ?? cfg.escritorId); if (t) estilos[slug] = t; }
  const r = await armarPautaCore(user.id, {
    estilos,
    lunes: plan.weekStart,
    enfoque,
    temas: plan.temas ?? [],
    briefs: Object.fromEntries(Object.entries(cfg.briefs ?? {}).map(([slug, b]) => [slug, briefParaPrompt(slug, b)]).filter(([, txt]) => txt)),
    casillas: parrilla.map((c, i) => ({ i, cuando: fmt.format(c.publicaEn), seccion: c.seccion, prioridad: c.prioridad })),
  });
  if (!r.ok) return { ok: false, message: r.error };
  const pauta = new Map(r.pauta.map((p) => [p.i, p]));
  // Se conservan las casillas ya redactadas (o en curso); las demás se reemplazan por la parrilla nueva.
  await db.delete(editorialSlots).where(and(eq(editorialSlots.planId, id), inArray(editorialSlots.status, ["planificada", "fallida", "omitida"])));
  await db.insert(editorialSlots).values(
    parrilla.map((c, i) => {
      const p = pauta.get(i);
      // Lo que el consejo contestó para la sección manda: la extensión elegida y, si el género de la IA no es de los pedidos, uno de los pedidos.
      const b = cfg.briefs?.[c.seccion];
      const ficha = { ...(p?.ficha ?? {}), ...(b?.palabras ? { palabras: b.palabras } : {}) };
      if (b?.generos?.length && (!ficha.genero || !b.generos.includes(ficha.genero))) ficha.genero = b.generos[i % b.generos.length];
      return { planId: id, publishAt: c.publicaEn, sectionSlug: c.seccion, topic: p?.tema ?? "", angle: p?.angulo ?? "", brief: p?.encargo ?? "", priority: p?.prioridad ?? c.prioridad, approval: c.aprobacion, ficha };
    }),
  );
  rev(id);
  return { ok: true, casillas: parrilla.length, message: `Pauta lista: ${parrilla.length} casillas, ${r.pauta.length} con tema.` };
}

/** Edita una casilla (tema, enfoque, encargo, hora, sección, prioridad, aprobación). Solo si aún no se redactó. */
export async function guardarCasilla(slotId: string, d: { topic: string; angle: string; brief: string; sectionSlug: string; publishAt: string; priority: number; approval: "manual" | "auto"; ficha?: FichaPauta }): Promise<Res> {
  const user = await requirePermiso("articulos");
  const [c] = await db.select().from(editorialSlots).where(eq(editorialSlots.id, slotId)).limit(1);
  if (!c) return { ok: false, message: "La casilla ya no existe." };
  if (c.status !== "planificada" && c.status !== "fallida") return { ok: false, message: "Esta pieza ya se redactó: edítala desde Artículos." };
  const cuando = new Date(d.publishAt);
  if (Number.isNaN(cuando.getTime())) return { ok: false, message: "La fecha y hora no son válidas." };
  if (d.approval === "auto" && !(await puedePublicar(user))) return { ok: false, message: "Para dejar una pieza en publicación automática tu cuenta debe poder publicar." };
  // El escritor de la pieza debe ser uno que esta persona pueda elegir.
  const fichaLimpia = d.ficha ? sanearFicha(d.ficha) : undefined;
  if (fichaLimpia?.escritorId && !(await escritoresParaElegir(user)).some((e) => e.id === fichaLimpia.escritorId)) delete fichaLimpia.escritorId;
  await db.update(editorialSlots).set({
    topic: d.topic.trim().slice(0, 160), angle: d.angle.trim().slice(0, 400), brief: d.brief.trim().slice(0, 1200),
    sectionSlug: /^[\w-]{1,80}$/.test(d.sectionSlug) ? d.sectionSlug : c.sectionSlug, publishAt: cuando,
    priority: d.priority === 1 || d.priority === 3 ? d.priority : 2, approval: d.approval === "auto" ? "auto" : "manual",
    ...(fichaLimpia ? { ficha: fichaLimpia } : {}),
    status: "planificada", error: null, updatedAt: new Date(),
  }).where(eq(editorialSlots.id, slotId));
  rev(c.planId);
  return { ok: true };
}

/** Quita una casilla que aún no se redactó. */
export async function quitarCasilla(slotId: string): Promise<Res> {
  await requirePermiso("articulos");
  const [c] = await db.select().from(editorialSlots).where(eq(editorialSlots.id, slotId)).limit(1);
  if (!c) return { ok: true };
  if (c.status === "redactando" || c.status === "programada" || c.status === "publicada") return { ok: false, message: "Esta pieza ya está en marcha." };
  await db.update(editorialSlots).set({ status: "omitida", updatedAt: new Date() }).where(eq(editorialSlots.id, slotId));
  rev(c.planId);
  return { ok: true };
}

/** Activa el plan: desde ahora se redacta cada casilla a su tiempo. Con piezas automáticas exige poder publicar. */
export async function activarPlan(id: string): Promise<Res> {
  const user = await requirePermiso("articulos");
  const casillas = await db.select().from(editorialSlots).where(and(eq(editorialSlots.planId, id), eq(editorialSlots.status, "planificada")));
  const conTema = casillas.filter((c) => c.topic.trim().length >= 8);
  if (!conTema.length) return { ok: false, message: "Arma la pauta primero: no hay casillas con tema." };
  if (conTema.some((c) => c.approval === "auto") && !(await puedePublicar(user))) {
    return { ok: false, message: "Hay piezas en publicación automática y tu cuenta no puede publicar. Pásalas a «con aprobación» o pide a un editor que active el plan." };
  }
  await db.update(editorialPlans).set({ status: "activo", activatedBy: user.id, updatedAt: new Date() }).where(eq(editorialPlans.id, id));
  rev(id);
  return { ok: true, message: `Plan activo: ${conTema.length} piezas se redactarán a su tiempo.` };
}

/** Pausa o cierra el plan (no se redacta nada más; lo ya programado sigue su curso). */
export async function cambiarEstadoPlan(id: string, estado: "borrador" | "cerrado"): Promise<Res> {
  await requirePermiso("articulos");
  await db.update(editorialPlans).set({ status: estado, updatedAt: new Date() }).where(eq(editorialPlans.id, id));
  rev(id);
  return { ok: true };
}

/** Redacta ahora las casillas que ya toca (sin esperar al cron). */
export async function redactarAhora(id: string): Promise<Res<{ redactadas: number }>> {
  await requirePermiso("articulos");
  const [plan] = await db.select({ status: editorialPlans.status }).from(editorialPlans).where(eq(editorialPlans.id, id)).limit(1);
  if (plan?.status !== "activo") return { ok: false, message: "Activa el plan primero." };
  const r = await procesarConsejo({ max: 1 });
  rev(id);
  return { ok: true, redactadas: r.redactadas, message: r.redactadas ? "Se redactó una pieza." : "No hay piezas por redactar todavía (se redactan unas horas antes de su hora)." };
}

/** Un editor aprueba una pieza en revisión: se programa para su hora. */
export async function aprobar(slotId: string): Promise<Res> {
  const user = await requirePermiso("publicar");
  if (!canPublish(user.role)) return { ok: false, message: "Tu rol no puede aprobar publicaciones." };
  const r = await aprobarCasilla(slotId);
  revalidatePath("/panel/consejo");
  revalidatePath("/panel/articulos");
  return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.message };
}

/** Estado al día de las casillas de un plan (lo llama la pantalla al abrirse). */
export async function refrescarPlan(id: string): Promise<void> {
  await requirePermiso("articulos");
  await sincronizarCasillas(id);
}

/**
 * Borra un consejo y todas sus casillas. Las notas que ya se redactaron NO se borran: siguen en Artículos (y las ya programadas siguen
 * programadas). Solo lo borra quien lo creó o un editor.
 */
export async function borrarPlan(id: string): Promise<Res> {
  const user = await requirePermiso("articulos");
  const [plan] = await db.select({ createdBy: editorialPlans.createdBy }).from(editorialPlans).where(eq(editorialPlans.id, id)).limit(1);
  if (!plan) return { ok: true, message: "Ya no existe." };
  if (plan.createdBy !== user.id && !canPublish(user.role)) return { ok: false, message: "Solo quien creó el consejo o un editor puede borrarlo." };
  await db.delete(editorialPlans).where(eq(editorialPlans.id, id));
  rev();
  return { ok: true, message: "Consejo borrado." };
}

/** El «editor jefe» completa la ficha de una casilla con investigación real (con fuentes y enlaces). Respeta lo que ya se escribió. */
export async function completarFicha(slotId: string, actual: FichaPauta): Promise<Res<{ ficha: FichaPauta }>> {
  const user = await requirePermiso("articulos");
  const [c] = await db.select().from(editorialSlots).where(eq(editorialSlots.id, slotId)).limit(1);
  if (!c) return { ok: false, message: "La casilla ya no existe." };
  if (c.status !== "planificada" && c.status !== "fallida") return { ok: false, message: "Esta pieza ya se redactó." };
  const [cat] = await db.select({ name: categories.name }).from(categories).where(eq(categories.slug, c.sectionSlug)).limit(1);
  const [pl] = await db.select({ config: editorialPlans.config }).from(editorialPlans).where(eq(editorialPlans.id, c.planId)).limit(1);
  const cfgF = sanearConfig(pl?.config);
  const estilo = await bloqueDeEscritor(sanearFicha(actual).escritorId ?? cfgF.briefs?.[c.sectionSlug]?.escritorId ?? cfgF.escritorId);
  const r = await completarFichaCore(user.id, { estilo: estilo || undefined, tema: c.topic, angulo: c.angle, encargo: c.brief, seccion: cat?.name, existente: sanearFicha(actual) });
  if (!r.ok) return { ok: false, message: r.error };
  await db.update(editorialSlots).set({ ficha: r.ficha, updatedAt: new Date() }).where(eq(editorialSlots.id, slotId));
  rev(c.planId);
  return { ok: true, ficha: r.ficha, message: "Ficha completada con investigación y fuentes: revísala antes de activar el plan." };
}

/** Mueve una pieza a otro día u hora (arrastrándola en el calendario). Solo piezas aún sin redactar y a una hora futura. */
export async function moverCasilla(slotId: string, publishAtIso: string): Promise<Res> {
  await requirePermiso("articulos");
  const cuando = new Date(publishAtIso);
  if (Number.isNaN(cuando.getTime())) return { ok: false, message: "La fecha y hora no son válidas." };
  if (cuando.getTime() <= Date.now()) return { ok: false, message: "Esa hora ya pasó: elige una hora futura." };
  const [c] = await db.select({ planId: editorialSlots.planId, status: editorialSlots.status }).from(editorialSlots).where(eq(editorialSlots.id, slotId)).limit(1);
  if (!c) return { ok: false, message: "La casilla ya no existe." };
  if (c.status !== "planificada" && c.status !== "fallida") return { ok: false, message: "Esta pieza ya se redactó: cambia su hora desde Artículos." };
  await db.update(editorialSlots).set({ publishAt: cuando, status: "planificada", error: null, updatedAt: new Date() }).where(eq(editorialSlots.id, slotId));
  rev(c.planId);
  return { ok: true, message: "Pieza movida." };
}
