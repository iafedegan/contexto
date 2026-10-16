import "server-only";

/**
 * Ejecución del consejo de redacción: cada casilla de un plan ACTIVO se redacta a tiempo, `antelacionHoras` antes de su hora, con la misma
 * tubería verificada del asistente (sin inventar cifras ni citas) y a nombre de quien activó el plan (con su estilo y su cuota de IA).
 *
 *  - Casilla «manual»: el borrador queda EN REVISIÓN esperando que un editor lo apruebe (desde el consejo o desde Artículos).
 *  - Casilla «auto»: solo si quien activó el plan puede publicar Y el borrador pasa un control de calidad se PROGRAMA para su hora; el
 *    cron de notas programadas la publica. Si no pasa el control, queda en revisión. Nunca se publica algo que no pasó el control.
 */
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, editorialPlans, editorialSlots, users } from "@/db/schema";
import { generateArticleDraftCore } from "@/lib/ai/borrador";
import { generateCoverImageCore } from "@/lib/ai/portada";
import { canPublish } from "@/lib/auth";
import { autorDeUsuario } from "@/lib/user-authors";
import { tienePermiso } from "@/lib/permisos-server";
import { enviarARevisionCore, guardarBorradorCore, programarCore, publicarCore } from "@/lib/article-ops";
import { completarFichaCore } from "@/lib/ai/consejo-ia";
import { briefParaPrompt, evaluarFicha, fichaParaPrompt, sanearConfig, sanearFicha, tocaRedactar, type EstadoCasilla } from "@/lib/consejo/plan";

/** Controles mínimos para que una nota se programe sola: redactada por la IA con fuentes, de longitud suficiente y con título y resumen reales. */
export function pasaControl(d: { title: string; excerpt: string; body: string }): { ok: boolean; motivo?: string } {
  const palabras = d.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (palabras < 300) return { ok: false, motivo: `el cuerpo tiene solo ${palabras} palabras (mínimo 300)` };
  if (!/<details>\s*<summary>Fuentes consultadas/i.test(d.body)) return { ok: false, motivo: "no trae fuentes consultadas" };
  if (/\{\{|\}\}/.test(d.body)) return { ok: false, motivo: "quedaron marcadores sin resolver" };
  if (d.title.trim().length < 15 || d.excerpt.trim().length < 40) return { ok: false, motivo: "título o resumen demasiado cortos" };
  return { ok: true };
}

type Casilla = typeof editorialSlots.$inferSelect;
type Plan = typeof editorialPlans.$inferSelect;

const poner = (id: string, estado: EstadoCasilla, extra: Partial<typeof editorialSlots.$inferInsert> = {}) =>
  db.update(editorialSlots).set({ status: estado, updatedAt: sql`now()`, ...extra }).where(eq(editorialSlots.id, id));

/** Redacta una casilla ya reclamada (estado «redactando») y la deja en revisión o programada. */
async function redactar(c: Casilla, plan: Plan): Promise<void> {
  const inicio = Date.now();
  const cfgPlan = sanearConfig(plan.config);
  // La nota sale firmada por el escritor elegido cuando es una persona del panel (un escritor externo no tiene cuenta: firma quien activó el plan).
  // Quién escribe: el elegido para ESTA pieza (en su ficha) o, si no, el del consejo.
  const escritorId = sanearFicha(c.ficha).escritorId ?? cfgPlan.escritorId;
  const autorId = escritorId ? await autorDeUsuario(escritorId).catch(() => null) : null;
  const userId = plan.activatedBy ?? plan.createdBy;
  if (!userId) return void (await poner(c.id, "fallida", { error: "El plan no tiene una persona responsable." }));
  const [cat] = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.slug, c.sectionSlug)).limit(1);
  const encargo = [c.brief, c.angle && `Enfoque: ${c.angle}`].filter(Boolean).join("\n");

  // Antes de redactar, la ficha de pauta debe estar lista (foco, por qué ahora, audiencia, fuentes y preguntas). Si falta algo, el «editor jefe»
  // la completa con investigación real; si aun así faltan los datos obligatorios, NO se redacta: sin ficha la IA inventaría.
  let ficha = sanearFicha(c.ficha);
  if (!evaluarFicha(ficha).lista) {
    const f = await completarFichaCore(userId, { tema: c.topic, angulo: c.angle, encargo: c.brief, seccion: cat?.name, existente: ficha });
    if (f.ok) {
      ficha = f.ficha;
      await db.update(editorialSlots).set({ ficha, updatedAt: sql`now()` }).where(eq(editorialSlots.id, c.id));
    }
  }
  const ev = evaluarFicha(ficha);
  if (!ev.lista) return void (await poner(c.id, "fallida", { error: `Falta la ficha de pauta, así que no se redactó (sería inventar): ${ev.faltanObligatorias.join("; ")}. Complétala en la casilla y se reintenta.`.slice(0, 400) }));
  // Las fuentes con enlace de la ficha se citan como referencias de la nota.
  const referencias = (ficha.fuentes ?? []).filter((x) => x.url).map((x) => ({ title: x.nombre, outlet: (() => { try { return new URL(x.url!).hostname.replace(/^www\./, ""); } catch { return ""; } })(), url: x.url! }));

  const r = await generateArticleDraftCore(userId, {
    title: c.topic,
    prompt: encargo.length >= 20 ? encargo : `${c.topic}. ${encargo}`.slice(0, 600).padEnd(20, "."),
    ficha: fichaParaPrompt(ficha),
    estiloDe: escritorId,
    references: referencias.length ? referencias : undefined,
    section: cat?.name,
    instrucciones: [`Es una pieza del plan semanal del consejo de redacción (prioridad ${c.priority === 1 ? "alta" : c.priority === 3 ? "de apoyo" : "normal"}). Respeta el enfoque indicado.`, briefParaPrompt(cat?.name ?? c.sectionSlug, cfgPlan.briefs?.[c.sectionSlug])].filter(Boolean).join("\n"),
  });
  if (!r.ok) return void (await poner(c.id, "fallida", { error: r.error.slice(0, 400) }));
  if (r.mode !== "ia") return void (await poner(c.id, "fallida", { error: "No hay modelo de IA conectado: no se redacta (sería inventar)." }));
  const d = r.draft;
  // Transparencia con el lector (como piden AP o The Guardian): la nota dice que se elaboró con asistencia de IA. Se puede apagar en el consejo.
  if (sanearConfig(plan.config).divulgarIA) d.body = `${d.body}<p><em>Nota elaborada con asistencia de inteligencia artificial a partir de las fuentes citadas.</em></p>`;

  // Portada generada (si falla, la nota sigue sin ella: el editor puede ponerla).
  // Si la redacción ya gastó casi todo el tiempo de la ruta, se omite la portada: es mejor la nota sin imagen que perderla por un corte.
  const img = Date.now() - inicio > 170_000 ? null : await generateCoverImageCore(userId, { title: d.title, excerpt: d.excerpt, section: cat?.name, body: d.body }).catch(() => null);
  const g = await guardarBorradorCore(userId, {
    title: d.title,
    excerpt: d.excerpt,
    body: d.body,
    tags: d.tags,
    categoryId: cat?.id ?? null,
    metaTitle: d.metaTitle,
    metaDescription: d.metaDescription,
    authorId: autorId,
    coverImageUrl: img?.ok ? img.url : null,
    coverImageAlt: img?.ok ? img.alt : null,
  });
  if (!g.ok) return void (await poner(c.id, "fallida", { error: g.error ?? "No se pudo guardar el borrador." }));

  if (c.approval === "auto") {
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    const puede = !!u && canPublish(u.role) && (await tienePermiso(userId, u.role, "publicar"));
    const control = pasaControl(d);
    if (puede && control.ok) {
      // Si la hora ya pasó (el plan se activó tarde), sale en un par de minutos.
      const cuando = c.publishAt.getTime() > Date.now() + 60_000 ? c.publishAt : new Date(Date.now() + 120_000);
      await programarCore(g.id, cuando.toISOString());
      return void (await poner(c.id, "programada", { articleId: g.id, error: null }));
    }
    await enviarARevisionCore(g.id);
    return void (await poner(c.id, "revision", { articleId: g.id, error: puede ? `No se programó sola: ${control.motivo}.` : "Quien activó el plan no puede publicar: queda para aprobación." }));
  }
  await enviarARevisionCore(g.id);
  await poner(c.id, "revision", { articleId: g.id, error: null });
}

/**
 * Pasada del consejo: reclama (de forma atómica) las casillas de planes activos que ya toca redactar y las redacta, como mucho `max` por
 * pasada para no pasar del tiempo de la ruta. Después sincroniza el estado de las casillas con el de sus notas.
 */
export async function procesarConsejo(opciones: { max?: number } = {}): Promise<{ redactadas: number }> {
  let redactadas = 0;
  try {
    const horizonte = new Date(Date.now() + 48 * 3600_000);
    const candidatas = await db
      .select({ c: editorialSlots, p: editorialPlans })
      .from(editorialSlots)
      .innerJoin(editorialPlans, eq(editorialSlots.planId, editorialPlans.id))
      .where(and(eq(editorialPlans.status, "activo"), eq(editorialSlots.status, "planificada"), lte(editorialSlots.publishAt, horizonte)))
      .orderBy(asc(editorialSlots.publishAt))
      .limit(40);
    for (const { c, p } of candidatas) {
      if (redactadas >= (opciones.max ?? 2)) break;
      if (c.topic.trim().length < 8) continue; // sin tema no hay qué redactar
      if (!tocaRedactar(c.publishAt, sanearConfig(p.config))) continue;
      // Reclamar: si otra pasada la tomó primero, no devuelve fila y se sigue con la siguiente.
      const [mia] = await db.update(editorialSlots).set({ status: "redactando", updatedAt: sql`now()` }).where(and(eq(editorialSlots.id, c.id), eq(editorialSlots.status, "planificada"))).returning({ id: editorialSlots.id });
      if (!mia) continue;
      try {
        await redactar(c, p);
      } catch (err) {
        console.error("consejo: falló la redacción de una casilla", err);
        await poner(c.id, "fallida", { error: String((err as Error)?.message ?? err).slice(0, 400) });
      }
      redactadas++;
    }
    await sincronizarCasillas();
  } catch (err) {
    console.error("procesarConsejo:", err);
  }
  return { redactadas };
}

/** Pone al día el estado de las casillas según su nota: aprobada y programada, publicada, o devuelta/archivada. También rescata las que quedaron «redactando» por un corte. */
export async function sincronizarCasillas(planId?: string): Promise<void> {
  const filtroPlan = planId ? eq(editorialSlots.planId, planId) : undefined;
  const conNota = await db
    .select({ id: editorialSlots.id, estado: editorialSlots.status, nota: articles.status })
    .from(editorialSlots)
    .innerJoin(articles, eq(editorialSlots.articleId, articles.id))
    .where(and(inArray(editorialSlots.status, ["revision", "programada"]), filtroPlan));
  for (const f of conNota) {
    const nuevo: EstadoCasilla | null = f.nota === "publicado" ? "publicada" : f.nota === "programado" ? "programada" : f.nota === "archivado" ? "omitida" : f.nota === "en_revision" || f.nota === "borrador" ? (f.estado === "programada" ? "revision" : null) : null;
    if (nuevo && nuevo !== f.estado) await poner(f.id, nuevo);
  }
  // «Redactando» hace más de 6 minutos = la pasada se cortó (la ruta dura 5 como máximo): se libera para reintentar.
  await db
    .update(editorialSlots)
    .set({ status: "planificada", updatedAt: sql`now()` })
    .where(and(eq(editorialSlots.status, "redactando"), lte(editorialSlots.updatedAt, new Date(Date.now() - 6 * 60_000)), filtroPlan));
}

/** Aprueba una casilla en revisión: la nota se programa para su hora (o sale ya si la hora pasó). Quien llama debe poder publicar. */
export async function aprobarCasilla(slotId: string): Promise<{ ok: boolean; message: string }> {
  const [c] = await db.select().from(editorialSlots).where(eq(editorialSlots.id, slotId)).limit(1);
  if (!c?.articleId) return { ok: false, message: "Esta casilla todavía no tiene borrador." };
  if (c.publishAt.getTime() > Date.now() + 60_000) {
    await programarCore(c.articleId, c.publishAt.toISOString());
    await poner(c.id, "programada", { error: null });
    return { ok: true, message: "Aprobada: se publicará a su hora." };
  }
  await publicarCore(c.articleId);
  await poner(c.id, "publicada", { error: null });
  return { ok: true, message: "Aprobada: como su hora ya pasó, se publicó ahora." };
}
