"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterEditions, newsletterSubscribers, siteSettings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import { hit } from "@/lib/rate-limit";
import { buildMessage, nextIssueNumber, prepareRender, type EditionContent } from "@/lib/newsletter/edition";
import { sendMany } from "@/lib/newsletter/send";
import { NEWSLETTER_KEY, NEWSLETTER_SECRET_KEY, getNewsletterSettings, getProviderStatus } from "@/lib/newsletter/settings";
import { sanitizeNewsletterSettings, type NewsletterSettings } from "@/lib/newsletter/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REVALIDATE = () => revalidatePath("/panel/newsletter");

/** Valida lo que llega del editor: el correo se genera a partir de estos textos. */
function cleanContent(input: Partial<EditionContent>): { ok: true; content: EditionContent } | { ok: false; message: string } {
  const subject = String(input.subject ?? "").trim().slice(0, 150);
  const preheader = String(input.preheader ?? "").trim().slice(0, 200);
  const intro = String(input.intro ?? "").trim().slice(0, 3000);
  const slugs = Array.isArray(input.articleSlugs)
    ? [...new Set(input.articleSlugs.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 200)))].slice(0, 12)
    : [];
  if (subject.length < 3) return { ok: false, message: "Escribe un asunto (mínimo 3 caracteres)." };
  return { ok: true, content: { subject, preheader, intro, articleSlugs: slugs } };
}

// --- Ediciones -----------------------------------------------------------

export async function createEdition() {
  const user = await requireRole("editor");
  const fecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(new Date());
  const [row] = await db
    .insert(newsletterEditions)
    .values({ subject: `Lo más importante del sector · ${fecha}`, createdBy: user.id })
    .returning({ id: newsletterEditions.id });
  REVALIDATE();
  redirect(`/panel/newsletter/${row.id}`);
}

export async function saveEdition(id: string, input: Partial<EditionContent>): Promise<{ ok: boolean; message: string }> {
  await requireRole("editor");
  const c = cleanContent(input);
  if (!c.ok) return { ok: false, message: c.message };
  const res = await db
    .update(newsletterEditions)
    .set({ ...c.content, updatedAt: sql`now()` })
    .where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "borrador")))
    .returning({ id: newsletterEditions.id });
  if (res.length === 0) return { ok: false, message: "Esta edición ya se envió y no se puede modificar." };
  REVALIDATE();
  return { ok: true, message: "Borrador guardado" };
}

export async function deleteEdition(id: string): Promise<void> {
  await requireRole("editor");
  await db.delete(newsletterEditions).where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "borrador")));
  REVALIDATE();
}

/** El correo tal como lo verá el lector, para la vista previa del editor. */
export async function previewEdition(input: Partial<EditionContent>): Promise<{ ok: boolean; html?: string; message?: string }> {
  await requireRole("redactor");
  const c = cleanContent({ ...input, subject: input.subject?.trim() ? input.subject : "Asunto del boletín" });
  if (!c.ok) return { ok: false, message: c.message };
  const p = await prepareRender(c.content, await nextIssueNumber());
  return { ok: true, html: buildMessage(p, "lector@ejemplo.com", null, false).html };
}

/** Envía UN correo de prueba, marcado como tal, a la dirección indicada. */
export async function sendTestEmail(input: Partial<EditionContent>, to: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireRole("editor");
  const email = to.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Escribe un correo válido para la prueba." };
  const c = cleanContent(input);
  if (!c.ok) return { ok: false, message: c.message };
  if (!(await hit(`newsletter:test:${user.id}`, 10, 10 * 60)).allowed) {
    return { ok: false, message: "Demasiadas pruebas seguidas. Espera unos minutos." };
  }

  const provider = await getProviderStatus();
  if (!provider.configured) return { ok: false, message: "Conecta el proveedor de correo en Ajustes antes de enviar." };
  const settings = await getNewsletterSettings();
  if (!provider.dryRun && !settings.fromEmail) return { ok: false, message: "Falta el correo remitente en Ajustes." };

  const p = await prepareRender(c.content, await nextIssueNumber());
  const res = await sendMany([buildMessage(p, email, null, true)], {
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyTo: settings.replyTo || undefined,
  });
  if (res.failed > 0) return { ok: false, message: res.error ?? "No se pudo enviar la prueba." };
  return {
    ok: true,
    message: provider.dryRun
      ? `Simulado (modo desarrollo): no se envió nada real a ${email}.`
      : `Prueba enviada a ${email}. Revisa también la carpeta de spam.`,
  };
}

// --- Envío por tandas ----------------------------------------------------

export type SendProgress = {
  ok: boolean;
  done: boolean;
  total: number;
  delivered: number;
  message?: string;
};

const TIME_BUDGET_MS = 40_000;

/** Suscriptores que deben recibir el boletín: confirmados y sin baja. */
const recipientsWhere = (startedAt: Date | null) =>
  and(
    eq(newsletterSubscribers.confirmed, true),
    isNull(newsletterSubscribers.unsubscribedAt),
    ...(startedAt ? [lte(newsletterSubscribers.createdAt, startedAt)] : []),
  );

/**
 * Envía la edición a los suscriptores confirmados, por tandas de 100. Es
 * REANUDABLE: guarda el último suscriptor procesado, así que si una llamada
 * agota su tiempo (o el proveedor falla) se continúa desde ahí, sin repetir
 * correos. El cliente la vuelve a llamar hasta que devuelve `done`.
 */
export async function sendEditionChunk(id: string): Promise<SendProgress> {
  await requireRole("editor");
  const t0 = Date.now();

  const provider = await getProviderStatus();
  if (!provider.configured) {
    return { ok: false, done: false, total: 0, delivered: 0, message: "Conecta el proveedor de correo en Ajustes antes de enviar." };
  }
  const settings = await getNewsletterSettings();
  if (!provider.dryRun && !settings.fromEmail) {
    return { ok: false, done: false, total: 0, delivered: 0, message: "Falta el correo remitente en Ajustes." };
  }

  let [edition] = await db.select().from(newsletterEditions).where(eq(newsletterEditions.id, id)).limit(1);
  if (!edition) return { ok: false, done: false, total: 0, delivered: 0, message: "La edición no existe." };
  if (edition.status === "enviada") {
    return { ok: true, done: true, total: edition.total, delivered: edition.delivered };
  }

  // Primera llamada: se cierra la edición (ya no se puede editar) y se cuentan destinatarios.
  if (edition.status === "borrador") {
    const c = cleanContent({ subject: edition.subject, preheader: edition.preheader, intro: edition.intro, articleSlugs: edition.articleSlugs });
    if (!c.ok || c.content.articleSlugs.length === 0) {
      return { ok: false, done: false, total: 0, delivered: 0, message: "Elige al menos una nota antes de enviar." };
    }
    const startedAt = new Date();
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(newsletterSubscribers)
      .where(recipientsWhere(startedAt));
    if (n === 0) {
      return { ok: false, done: false, total: 0, delivered: 0, message: "Todavía no hay suscriptores confirmados." };
    }
    const issue = await nextIssueNumber();
    // Atómico: si dos personas pulsan a la vez, solo una arranca el envío.
    const claimed = await db
      .update(newsletterEditions)
      .set({ status: "enviando", startedAt, issue, total: n, delivered: 0, failed: 0, cursor: null, updatedAt: sql`now()` })
      .where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "borrador")))
      .returning();
    if (claimed.length === 0) {
      return { ok: false, done: false, total: n, delivered: 0, message: "Esta edición ya se está enviando." };
    }
    edition = claimed[0];
  }

  const content: EditionContent = {
    subject: edition.subject,
    preheader: edition.preheader,
    intro: edition.intro,
    articleSlugs: edition.articleSlugs,
  };
  const prepared = await prepareRender(content, edition.issue);

  let cursor = edition.cursor;
  let delivered = edition.delivered;

  while (Date.now() - t0 < TIME_BUDGET_MS) {
    const batch = await db
      .select({ id: newsletterSubscribers.id, email: newsletterSubscribers.email })
      .from(newsletterSubscribers)
      .where(and(recipientsWhere(edition.startedAt), ...(cursor ? [gt(newsletterSubscribers.id, cursor)] : [])))
      .orderBy(asc(newsletterSubscribers.id))
      .limit(100);

    if (batch.length === 0) {
      await db
        .update(newsletterEditions)
        .set({ status: "enviada", sentAt: new Date(), cursor, delivered, updatedAt: sql`now()` })
        .where(eq(newsletterEditions.id, id));
      REVALIDATE();
      return { ok: true, done: true, total: edition.total, delivered };
    }

    const res = await sendMany(
      batch.map((s) => buildMessage(prepared, s.email, s.id)),
      { fromName: settings.fromName, fromEmail: settings.fromEmail, replyTo: settings.replyTo || undefined },
    );

    if (res.failed > 0) {
      // No se avanza el cursor: al reintentar se repite exactamente esta tanda.
      await db.update(newsletterEditions).set({ failed: sql`${newsletterEditions.failed} + ${res.failed}`, updatedAt: sql`now()` }).where(eq(newsletterEditions.id, id));
      REVALIDATE();
      return {
        ok: false,
        done: false,
        total: edition.total,
        delivered,
        message: `${res.error ?? "El proveedor rechazó la tanda."} Puedes reintentar: se continúa desde donde quedó.`,
      };
    }

    delivered += res.delivered;
    cursor = batch[batch.length - 1].id;
    await db
      .update(newsletterEditions)
      .set({ cursor, delivered, updatedAt: sql`now()` })
      .where(eq(newsletterEditions.id, id));
  }

  REVALIDATE();
  return { ok: true, done: false, total: edition.total, delivered };
}

// --- Ajustes -------------------------------------------------------------

export async function saveNewsletterSettings(input: Partial<NewsletterSettings>): Promise<{ ok: boolean; message: string }> {
  await requireRole("administrador");
  const settings = sanitizeNewsletterSettings(input);
  await db
    .insert(siteSettings)
    .values({ key: NEWSLETTER_KEY, value: settings })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: settings, updatedAt: sql`now()` } });
  REVALIDATE();
  return { ok: true, message: "Ajustes guardados" };
}

export async function saveResendKey(key: string): Promise<{ ok: boolean; message: string }> {
  await requireRole("administrador");
  const k = key.trim();
  if (!/^re_[A-Za-z0-9_\-]{16,}$/.test(k)) {
    return { ok: false, message: "La clave de Resend empieza por «re_». Cópiala completa desde resend.com → API Keys." };
  }
  await db
    .insert(siteSettings)
    .values({ key: NEWSLETTER_SECRET_KEY, value: { resend: encryptSecret(k) } })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: { resend: encryptSecret(k) }, updatedAt: sql`now()` } });
  REVALIDATE();
  return { ok: true, message: "Clave guardada (cifrada)" };
}

export async function deleteResendKey(): Promise<void> {
  await requireRole("administrador");
  await db.delete(siteSettings).where(eq(siteSettings.key, NEWSLETTER_SECRET_KEY));
  REVALIDATE();
}

// --- Suscriptores --------------------------------------------------------

export async function unsubscribeSubscriber(id: string): Promise<void> {
  await requireRole("editor");
  await db.update(newsletterSubscribers).set({ unsubscribedAt: new Date() }).where(eq(newsletterSubscribers.id, id));
  REVALIDATE();
}

/** Borrado definitivo (derecho de supresión de datos). */
export async function deleteSubscriber(id: string): Promise<void> {
  await requireRole("administrador");
  await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id));
  REVALIDATE();
}
