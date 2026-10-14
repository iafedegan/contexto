"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterEditions, newsletterSubscribers, siteSettings } from "@/db/schema";
import { requirePermiso, requireRole } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import { hit } from "@/lib/rate-limit";
import { buildMessage, nextIssueNumber, prepareRender, type EditionContent } from "@/lib/newsletter/edition";
import { contarAudiencia } from "@/lib/newsletter/audiencia";
import { esSegmento, sanitizarAudiencia } from "@/lib/newsletter/audiencia-tipos";
import { limpiarContenido } from "@/lib/newsletter/contenido";
import { MAX_ANTICIPO_MS, MIN_ANTICIPO_MS, describirCuando, fechaBogota } from "@/lib/newsletter/programacion";
import { sendMany } from "@/lib/newsletter/send";
import { enviarTanda, type SendProgress } from "@/lib/newsletter/envio";
import { NEWSLETTER_KEY, NEWSLETTER_SECRET_KEY, getNewsletterSettings, getProviderStatus } from "@/lib/newsletter/settings";
import { sanitizeNewsletterDesign, sanitizeNewsletterSettings, type NewsletterSettings } from "@/lib/newsletter/types";
import { EMAIL_RE, HEX6 } from "@/lib/validate";

// Refresca la pantalla del boletín.
const REVALIDATE = () => revalidatePath("/panel/newsletter");

// --- Ediciones -----------------------------------------------------------

export async function createEdition() {
  const user = await requirePermiso("newsletter");
  const fecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(new Date());
  const [row] = await db
    .insert(newsletterEditions)
    .values({ subject: `Lo más importante del sector · ${fecha}`, createdBy: user.id })
    .returning({ id: newsletterEditions.id });
  REVALIDATE();
  redirect(`/panel/newsletter/${row.id}`);
}

// Guarda el contenido de una edición del boletín.
export async function saveEdition(id: string, input: Partial<EditionContent>): Promise<{ ok: boolean; message: string }> {
  await requirePermiso("newsletter");
  const c = limpiarContenido(input);
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

// Borra una edición del boletín.
export async function deleteEdition(id: string): Promise<void> {
  await requirePermiso("newsletter");
  await db.delete(newsletterEditions).where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "borrador")));
  REVALIDATE();
}

/**
 * Programa el envío para una fecha y hora (de Colombia, `2026-10-15T07:00`). Guarda el contenido tal como está en pantalla y deja la edición
 * «programada»: ya no se edita (se cancela la programación para volver a editarla) y sale a su hora a su público (todos o los filtros elegidos).
 */
export async function programarEdicion(id: string, input: Partial<EditionContent>, cuando: string): Promise<{ ok: boolean; message: string }> {
  await requirePermiso("newsletter");
  const fecha = fechaBogota(String(cuando ?? ""));
  if (!fecha) return { ok: false, message: "Elige una fecha y una hora válidas." };
  const faltan = fecha.getTime() - Date.now();
  if (faltan < MIN_ANTICIPO_MS) return { ok: false, message: "La hora tiene que ser al menos dentro de dos minutos." };
  if (faltan > MAX_ANTICIPO_MS) return { ok: false, message: "Solo se puede programar hasta con un año de anticipación." };
  const c = limpiarContenido(input);
  if (!c.ok) return { ok: false, message: c.message };
  if (c.content.articleSlugs.length === 0) return { ok: false, message: "Elige al menos una nota antes de programar." };

  const provider = await getProviderStatus();
  if (!provider.configured) return { ok: false, message: "Conecta el proveedor de correo en Ajustes antes de programar." };
  if (!provider.dryRun && !(await getNewsletterSettings()).fromEmail) return { ok: false, message: "Falta el correo remitente en Ajustes." };

  const [actual] = await db.select({ status: newsletterEditions.status, audience: newsletterEditions.audience }).from(newsletterEditions).where(eq(newsletterEditions.id, id)).limit(1);
  if (!actual) return { ok: false, message: "La edición no existe." };
  if (actual.status !== "borrador") return { ok: false, message: "Esta edición ya no es un borrador." };
  const audiencia = sanitizarAudiencia(actual.audience);
  if ((await contarAudiencia(audiencia)) === 0) return { ok: false, message: esSegmento(audiencia) ? "Nadie cumple esos filtros: cambia el público de la edición." : "Todavía no hay suscriptores confirmados." };

  const res = await db
    .update(newsletterEditions)
    .set({ ...c.content, status: "programada", scheduledFor: fecha, updatedAt: sql`now()` })
    .where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "borrador")))
    .returning({ id: newsletterEditions.id });
  if (res.length === 0) return { ok: false, message: "Esta edición ya no es un borrador." };
  REVALIDATE();
  return { ok: true, message: `Programada para el ${describirCuando(fecha)} (hora de Colombia).` };
}

/** Quita la programación: la edición vuelve a ser un borrador editable. */
export async function cancelarProgramacion(id: string): Promise<{ ok: boolean; message: string }> {
  await requirePermiso("newsletter");
  const res = await db
    .update(newsletterEditions)
    .set({ status: "borrador", scheduledFor: null, updatedAt: sql`now()` })
    .where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "programada")))
    .returning({ id: newsletterEditions.id });
  REVALIDATE();
  return res.length ? { ok: true, message: "Programación cancelada: vuelve a ser un borrador." } : { ok: false, message: "Esta edición ya no está programada (puede que ya haya empezado a enviarse)." };
}

/** Copia una edición (contenido, secciones y público) como un borrador nuevo: sirve para mandar lo mismo a otras ciudades o a otra hora. */
export async function duplicarEdicion(id: string) {
  const user = await requirePermiso("newsletter");
  const [e] = await db.select().from(newsletterEditions).where(eq(newsletterEditions.id, id)).limit(1);
  if (!e) redirect("/panel/newsletter");
  const [nueva] = await db
    .insert(newsletterEditions)
    .values({ subject: `${e.subject} (copia)`.slice(0, 150), preheader: e.preheader, intro: e.intro, articleSlugs: e.articleSlugs, items: e.items, audience: e.audience, createdBy: user.id })
    .returning({ id: newsletterEditions.id });
  REVALIDATE();
  redirect(`/panel/newsletter/${nueva.id}`);
}

/** El correo tal como lo verá el lector, para la vista previa del editor. */
export async function previewEdition(input: Partial<EditionContent>, diseno?: { design: unknown; acento: string }): Promise<{ ok: boolean; html?: string; message?: string }> {
  await requirePermiso("newsletter");
  const c = limpiarContenido({ ...input, subject: input.subject?.trim() ? input.subject : "Asunto del boletín" });
  if (!c.ok) return { ok: false, message: c.message };
  const p = await prepareRender(c.content, await nextIssueNumber());
  // Con un diseño aún sin guardar, la vista previa lo aplica al vuelo (validado igual que al guardar).
  const q = diseno
    ? { ...p, settings: { ...p.settings, accentColor: HEX6.test(diseno.acento) ? diseno.acento : p.settings.accentColor, design: sanitizeNewsletterDesign(diseno.design) } }
    : p;
  return { ok: true, html: buildMessage(q, "lector@ejemplo.com", null, false).html };
}

/** Guarda el diseño del correo (para todas las ediciones). Lo puede hacer quien tenga el permiso «newsletter». */
export async function guardarDisenoBoletin(input: { design: unknown; acento: string }): Promise<{ ok: boolean; message: string }> {
  await requirePermiso("newsletter");
  const actual = await getNewsletterSettings();
  const settings = sanitizeNewsletterSettings({ ...actual, accentColor: input.acento, design: sanitizeNewsletterDesign(input.design) });
  await db
    .insert(siteSettings)
    .values({ key: NEWSLETTER_KEY, value: settings })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: settings, updatedAt: sql`now()` } });
  REVALIDATE();
  return { ok: true, message: "Diseño guardado para todas las ediciones." };
}

/** Envía UN correo de prueba, marcado como tal, a la dirección indicada. */
export async function sendTestEmail(input: Partial<EditionContent>, to: string): Promise<{ ok: boolean; message: string }> {
  const user = await requirePermiso("newsletter");
  const email = to.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Escribe un correo válido para la prueba." };
  const c = limpiarContenido(input);
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

/**
 * A quién va una edición: los suscriptores confirmados y sin baja que cumplen sus filtros (sin filtros, todos). Se guarda en la
 * edición y se fija al empezar el envío.
 */
export async function guardarAudiencia(id: string, audiencia: unknown): Promise<{ ok: boolean; message: string; n: number }> {
  await requirePermiso("newsletter");
  const a = sanitizarAudiencia(audiencia);
  const res = await db
    .update(newsletterEditions)
    .set({ audience: a, updatedAt: sql`now()` })
    .where(and(eq(newsletterEditions.id, id), eq(newsletterEditions.status, "borrador")))
    .returning({ id: newsletterEditions.id });
  const n = await contarAudiencia(a);
  if (res.length === 0) return { ok: false, message: "Esta edición ya se envió y no se puede cambiar su público.", n };
  REVALIDATE();
  return { ok: true, message: "Público guardado", n };
}

/** Cuántas personas recibirían una edición con estos filtros (para mostrarlo mientras se eligen). */
export async function contarDestinatarios(audiencia: unknown): Promise<number> {
  await requirePermiso("newsletter");
  return contarAudiencia(sanitizarAudiencia(audiencia));
}

/** Envía la edición a su público por tandas (la lógica vive en `enviarTanda`). El panel la vuelve a llamar hasta que devuelve `done`. */
export async function sendEditionChunk(id: string): Promise<SendProgress> {
  await requirePermiso("newsletter");
  return enviarTanda(id, { origen: "navegador", tiempoMs: 40_000 });
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

// Guarda cifrada la clave de Resend (solo administradores).
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

// Borra la clave de Resend guardada (solo administradores).
export async function deleteResendKey(): Promise<void> {
  await requireRole("administrador");
  await db.delete(siteSettings).where(eq(siteSettings.key, NEWSLETTER_SECRET_KEY));
  REVALIDATE();
}

// --- Suscriptores --------------------------------------------------------

export async function unsubscribeSubscriber(id: string): Promise<void> {
  await requirePermiso("newsletter");
  await db.update(newsletterSubscribers).set({ unsubscribedAt: new Date() }).where(eq(newsletterSubscribers.id, id));
  REVALIDATE();
}

/** Borrado definitivo (derecho de supresión de datos). */
export async function deleteSubscriber(id: string): Promise<void> {
  await requireRole("administrador");
  await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id));
  REVALIDATE();
}
