import "server-only";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterEditions, newsletterSubscribers } from "@/db/schema";
import { destinatariosWhere } from "@/lib/newsletter/audiencia";
import { esSegmento, sanitizarAudiencia } from "@/lib/newsletter/audiencia-tipos";
import { limpiarContenido } from "@/lib/newsletter/contenido";
import { buildMessage, nextIssueNumber, prepareRender, type EditionContent } from "@/lib/newsletter/edition";
import { sanitizarItems } from "@/lib/newsletter/items";
import { sendMany } from "@/lib/newsletter/send";
import { getNewsletterSettings, getProviderStatus } from "@/lib/newsletter/settings";
import { hit } from "@/lib/rate-limit";

/** Avance de un envío por tandas. */
export type SendProgress = { ok: boolean; done: boolean; total: number; delivered: number; message?: string };

/** Quién dispara la tanda: la persona desde el panel (en un bucle del navegador) o la programación (cron, aviso del navegador, programador externo). */
export type OrigenEnvio = "navegador" | "programacion";

/** Segundos sin actividad tras los cuales un envío programado se considera abandonado y otra pasada puede retomarlo. */
const SIN_ACTIVIDAD_S = 90;

// Refresca la pantalla del boletín (no debe romper un envío si no hay contexto de petición).
const refrescar = () => {
  try {
    revalidatePath("/panel/newsletter");
  } catch {
    /* sin contexto de petición: la pantalla se actualizará al recargarla */
  }
};

/**
 * Envía una edición a su público por tandas de 100 durante `tiempoMs`. Es REANUDABLE: guarda el último suscriptor procesado, así que si
 * una llamada agota su tiempo (o el proveedor falla) se continúa desde ahí sin repetir correos.
 *
 * - `navegador`: la persona pulsó «Enviar»; el panel la vuelve a llamar hasta que devuelve `done`.
 * - `programacion`: la edición está «programada»; sale cuando llega su hora. Un envío ya en curso solo se retoma si lleva más de
 *   `SIN_ACTIVIDAD_S` segundos sin avanzar (si no, otra pasada lo está enviando y no se duplica nada).
 *
 * El público (los filtros de la edición) queda fijado al empezar y se respeta al reanudar.
 */
export async function enviarTanda(id: string, { origen, tiempoMs }: { origen: OrigenEnvio; tiempoMs: number }): Promise<SendProgress> {
  const t0 = Date.now();
  const falla = (message: string, total = 0, delivered = 0): SendProgress => ({ ok: false, done: false, total, delivered, message });

  const provider = await getProviderStatus();
  if (!provider.configured) return falla("Conecta el proveedor de correo en Ajustes antes de enviar.");
  const settings = await getNewsletterSettings();
  if (!provider.dryRun && !settings.fromEmail) return falla("Falta el correo remitente en Ajustes.");

  let [edition] = await db.select().from(newsletterEditions).where(eq(newsletterEditions.id, id)).limit(1);
  if (!edition) return falla("La edición no existe.");
  if (edition.status === "enviada") return { ok: true, done: true, total: edition.total, delivered: edition.delivered };
  if (origen === "navegador" && edition.status === "programada") return falla("Esta edición está programada: cancela la programación si quieres enviarla ahora.");
  if (origen === "navegador" && edition.status === "enviando" && edition.scheduledFor) return falla("La programación ya está enviando esta edición; se completa sola.", edition.total, edition.delivered);
  if (origen === "programacion" && edition.status === "borrador") return falla("La edición no está programada.");

  // Primera tanda: se cierra la edición (ya no se puede editar) y se cuentan los destinatarios.
  if (edition.status === "borrador" || edition.status === "programada") {
    const programada = edition.status === "programada";
    if (programada && (!edition.scheduledFor || edition.scheduledFor.getTime() > Date.now())) return falla("Todavía no es la hora de esta edición.");
    // Una programada que ya no se puede enviar vuelve a borrador, para que no quede atascada sin que nadie lo note.
    const devolver = () => (programada ? db.update(newsletterEditions).set({ status: "borrador", scheduledFor: null, updatedAt: sql`now()` }).where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "programada"))) : Promise.resolve());

    const c = limpiarContenido({ subject: edition.subject, preheader: edition.preheader, intro: edition.intro, articleSlugs: edition.articleSlugs, items: edition.items as never });
    if (!c.ok || c.content.articleSlugs.length === 0) {
      await devolver();
      return falla("Elige al menos una nota antes de enviar.");
    }
    const startedAt = new Date();
    const audiencia = sanitizarAudiencia(edition.audience);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(newsletterSubscribers).where(destinatariosWhere(audiencia, startedAt));
    if (n === 0) {
      await devolver();
      return falla(esSegmento(audiencia) ? "Nadie cumple esos filtros: cambia el público de la edición." : "Todavía no hay suscriptores confirmados.");
    }
    const issue = await nextIssueNumber();
    // Atómico: si dos disparadores coinciden, solo uno arranca el envío.
    const claimed = await db
      .update(newsletterEditions)
      .set({ status: "enviando", startedAt, issue, total: n, delivered: 0, failed: 0, cursor: null, updatedAt: sql`now()` })
      .where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, edition.status), ...(programada ? [lte(newsletterEditions.scheduledFor, sql`now()`)] : [])))
      .returning();
    if (claimed.length === 0) return falla("Esta edición ya se está enviando.", n);
    edition = claimed[0];
  } else if (origen === "programacion") {
    // Retomar un envío programado: solo si nadie lo ha movido en un rato. Quien gana este UPDATE es la única pasada que sigue.
    const turno = await db
      .update(newsletterEditions)
      .set({ updatedAt: sql`now()` })
      .where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "enviando"), isNotNull(newsletterEditions.scheduledFor), sql`${newsletterEditions.updatedAt} < now() - make_interval(secs => ${SIN_ACTIVIDAD_S})`))
      .returning({ id: newsletterEditions.id });
    if (turno.length === 0) return { ok: true, done: false, total: edition.total, delivered: edition.delivered, message: "Otra pasada ya la está enviando." };
  }

  const content: EditionContent = { subject: edition.subject, preheader: edition.preheader, intro: edition.intro, articleSlugs: edition.articleSlugs, items: sanitizarItems(edition.items) };
  const prepared = await prepareRender(content, edition.issue);
  const audiencia = sanitizarAudiencia(edition.audience);

  let cursor = edition.cursor;
  let delivered = edition.delivered;

  while (Date.now() - t0 < tiempoMs) {
    const batch = await db
      .select({ id: newsletterSubscribers.id, email: newsletterSubscribers.email, autorizo: sql<boolean>`${newsletterSubscribers.readingAuthorizedAt} is not null` })
      .from(newsletterSubscribers)
      .where(and(destinatariosWhere(audiencia, edition.startedAt), ...(cursor ? [gt(newsletterSubscribers.id, cursor)] : [])))
      .orderBy(asc(newsletterSubscribers.id))
      .limit(100);

    if (batch.length === 0) {
      await db.update(newsletterEditions).set({ status: "enviada", sentAt: new Date(), cursor, delivered, updatedAt: sql`now()` }).where(eq(newsletterEditions.id, id));
      refrescar();
      return { ok: true, done: true, total: edition.total, delivered };
    }

    const res = await sendMany(
      batch.map((s) => buildMessage(prepared, s.email, s.id, false, s.autorizo)),
      { fromName: settings.fromName, fromEmail: settings.fromEmail, replyTo: settings.replyTo || undefined },
    );

    if (res.failed > 0) {
      // No se avanza el cursor: al reintentar se repite exactamente esta tanda.
      await db.update(newsletterEditions).set({ failed: sql`${newsletterEditions.failed} + ${res.failed}`, updatedAt: sql`now()` }).where(eq(newsletterEditions.id, id));
      refrescar();
      return falla(`${res.error ?? "El proveedor rechazó la tanda."} Se continúa desde donde quedó.`, edition.total, delivered);
    }

    delivered += res.delivered;
    cursor = batch[batch.length - 1].id;
    await db.update(newsletterEditions).set({ cursor, delivered, updatedAt: sql`now()` }).where(eq(newsletterEditions.id, id));
  }

  refrescar();
  return { ok: true, done: false, total: edition.total, delivered };
}

/** Qué pasó con cada edición programada en una pasada. */
export type PasadaBoletines = { id: string; ok: boolean; done: boolean; delivered: number; total: number; message?: string }[];

/** Última vez que esta instancia hizo la pasada (el límite de una cada ~50 s). */
let ultimaPasada = 0;

/**
 * Envía las ediciones PROGRAMADAS cuya hora ya llegó (y retoma las que quedaron a medias). Es lo que ejecutan, en este orden de
 * fiabilidad: un programador externo cada pocos minutos (`/api/cron/publish-scheduled?solo=programados`), el cron diario de Vercel y el
 * aviso que mandan los navegadores (`/api/programadas`). Sin `forzar`, se limita a una pasada cada ~50 s en todo el sitio.
 */
export async function procesarBoletinesProgramados(opciones: { forzar?: boolean; tiempoMs?: number } = {}): Promise<PasadaBoletines> {
  if (!opciones.forzar) {
    const ahora = Date.now();
    if (ahora - ultimaPasada < 50_000) return [];
    ultimaPasada = ahora;
    if (!(await hit("boletines:pasada", 1, 50)).allowed) return [];
  }
  const t0 = Date.now();
  const presupuesto = opciones.tiempoMs ?? 50_000;
  let pendientes: { id: string }[];
  try {
    pendientes = await db
      .select({ id: newsletterEditions.id })
      .from(newsletterEditions)
      .where(
        or(
          and(eq(newsletterEditions.status, "programada"), lte(newsletterEditions.scheduledFor, sql`now()`)),
          and(eq(newsletterEditions.status, "enviando"), isNotNull(newsletterEditions.scheduledFor), sql`${newsletterEditions.updatedAt} < now() - make_interval(secs => ${SIN_ACTIVIDAD_S})`),
        ),
      )
      .orderBy(asc(newsletterEditions.scheduledFor))
      .limit(5);
  } catch (e) {
    console.error("procesarBoletinesProgramados: no se pudo consultar", e);
    return [];
  }
  const salida: PasadaBoletines = [];
  for (const { id } of pendientes) {
    const resto = presupuesto - (Date.now() - t0);
    if (resto < 5_000) break;
    try {
      const r = await enviarTanda(id, { origen: "programacion", tiempoMs: resto });
      salida.push({ id, ok: r.ok, done: r.done, delivered: r.delivered, total: r.total, message: r.message });
    } catch (e) {
      console.error("procesarBoletinesProgramados: falló una edición", id, e);
      salida.push({ id, ok: false, done: false, delivered: 0, total: 0, message: "Error inesperado; se reintenta en la próxima pasada." });
    }
  }
  return salida;
}
