import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, pushSubscriptions, siteSettings } from "@/db/schema";
import { getSiteIdentity } from "@/lib/site-identity";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/utils";

/**
 * Notificaciones push (FM-01) mediante Web Push con claves VAPID.
 *
 * Se eligió Web Push estándar y no un servicio externo (OneSignal, Firebase)
 * por tres razones: no añade un tercero que vea la audiencia del medio, no
 * cuesta nada por suscriptor y funciona con la PWA que ya existe.
 *
 * Las claves se generan una vez con `npx web-push generate-vapid-keys` y se
 * ponen en el entorno. Sin ellas, la función queda inactiva y lo dice.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

export function pushConfigurado(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

async function configurar() {
  const { name } = await getSiteIdentity().catch(() => ({ name: "CONtexto Ganadero" }));
  webpush.setVapidDetails(
    env(process.env.VAPID_SUBJECT, "mailto:contexto@fedegan.org.co"),
    PUBLIC_KEY,
    PRIVATE_KEY,
  );
  return name;
}

export type EnvioPush = { enviados: number; caducados: number; fallidos: number };

/**
 * Envía un aviso a todos los suscriptores. Las suscripciones que el navegador
 * da por muertas (404/410) se borran en el momento: conservarlas solo hace
 * más lento cada envío posterior.
 */
export async function enviarAviso(input: {
  titulo: string;
  cuerpo: string;
  url: string;
  /** Foto grande de la notificación (portada de la nota). */
  imagen?: string | null;
  /** Una misma etiqueta reemplaza el aviso anterior de esa nota en vez de apilarlo. */
  tag?: string;
  /** Última hora: entrega con máxima prioridad aunque el teléfono esté en reposo. */
  urgente?: boolean;
}): Promise<EnvioPush> {
  if (!pushConfigurado()) return { enviados: 0, caducados: 0, fallidos: 0 };
  const nombre = await configurar();

  const subs = await db.select().from(pushSubscriptions);
  const payload = JSON.stringify({
    title: input.titulo.slice(0, 120),
    body: input.cuerpo.slice(0, 220),
    url: input.url,
    tag: input.tag ?? "cg-noticia",
    badge: "/api/pwa-icon?size=96",
    icon: "/api/pwa-icon?size=192",
    ...(input.imagen ? { image: input.imagen } : {}),
    origen: nombre,
  });

  const caducadas: string[] = [];
  let enviados = 0;
  let fallidos = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 6, urgency: input.urgente ? "high" : "normal" },
        );
        enviados += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) caducadas.push(s.endpoint);
        else fallidos += 1;
      }
    }),
  );

  if (caducadas.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, caducadas));
  }

  return { enviados, caducados: caducadas.length, fallidos };
}

/** Número de navegadores suscritos, para el panel. */
export async function contarSuscriptores(): Promise<number> {
  const filas = await db.select({ e: pushSubscriptions.endpoint }).from(pushSubscriptions);
  return filas.length;
}

/** Alta o renovación de una suscripción. */
export async function guardarSuscripcion(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, lastSeenAt: new Date() },
    });
}

/** Baja de una suscripción (el lector desactiva los avisos). */
export async function borrarSuscripcion(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}


/* ------------------------------------------------------------------------------------------------------------
 * Aviso de una nota publicada
 * ------------------------------------------------------------------------------------------------------------ */

const ENVIADOS_KEY = "push_enviados";
type Enviado = { id: string; at: string };

export async function notaYaAvisada(id: string): Promise<boolean> {
  const [row] = await db.select({ v: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, ENVIADOS_KEY)).limit(1);
  return ((row?.v as Enviado[] | undefined) ?? []).some((x) => x.id === id);
}
async function marcarEnviado(id: string) {
  const [row] = await db.select({ v: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, ENVIADOS_KEY)).limit(1);
  const lista = [{ id, at: new Date().toISOString() }, ...(((row?.v as Enviado[] | undefined) ?? []).filter((x) => x.id !== id))].slice(0, 200);
  await db.insert(siteSettings).values({ key: ENVIADOS_KEY, value: lista as never }).onConflictDoUpdate({ target: siteSettings.key, set: { value: lista as never, updatedAt: new Date() } });
}

export type AvisoNota = { ok: true; enviados: number; caducados: number; fallidos: number } | { ok: false; motivo: string };

/**
 * Notifica a los suscriptores una nota ya publicada: titular, entradilla, portada y enlace a la nota.
 * Cada nota se avisa UNA sola vez (se registra), salvo que quien la manda a mano confirme repetirla (`repetir`).
 */
export async function avisarNota(articleId: string, opts: { repetir?: boolean; urgente?: boolean } = {}): Promise<AvisoNota> {
  if (!pushConfigurado()) return { ok: false, motivo: "Las notificaciones no están configuradas (faltan las claves VAPID)." };
  const [nota] = await db
    .select({ id: articles.id, slug: articles.slug, title: articles.title, excerpt: articles.excerpt, cover: articles.coverImageUrl, breaking: articles.isBreaking })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.status, "publicado")))
    .limit(1);
  if (!nota) return { ok: false, motivo: "La nota no está publicada todavía." };
  if (!opts.repetir && (await notaYaAvisada(articleId))) return { ok: false, motivo: "Esta nota ya se avisó a los lectores." };

  const res = await enviarAviso({
    titulo: nota.title,
    cuerpo: nota.excerpt,
    url: `${siteUrl(`/articulo/${nota.slug}`)}?utm_source=push&utm_medium=notificacion&utm_campaign=${nota.breaking || opts.urgente ? "ultima-hora" : "noticia"}`,
    imagen: nota.cover && /^https?:\/\//i.test(nota.cover) ? nota.cover : null,
    tag: `nota-${nota.id.slice(0, 8)}`,
    urgente: nota.breaking || opts.urgente,
  });
  await marcarEnviado(articleId).catch(() => {});
  return { ok: true, ...res };
}

/**
 * Se llama al publicar: si la nota lleva el distintivo «Última hora», avisa a los lectores de inmediato (una vez).
 * Corre después de responder (`after`), así que nunca retrasa la publicación; un fallo se registra y no la afecta.
 */
export function avisarSiUltimaHora(articleId: string | string[]) {
  const ids = Array.isArray(articleId) ? articleId : [articleId];
  if (!ids.length || !pushConfigurado()) return;
  const tarea = async () => {
    for (const id of ids) {
      try {
        const [n] = await db.select({ b: articles.isBreaking }).from(articles).where(eq(articles.id, id)).limit(1);
        if (n?.b) await avisarNota(id, { urgente: true });
      } catch (err) {
        console.error("avisarSiUltimaHora:", err);
      }
    }
  };
  try {
    after(tarea);
  } catch {
    void tarea(); // fuera de una petición (scripts, pruebas)
  }
}
