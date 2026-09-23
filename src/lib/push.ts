import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSiteIdentity } from "@/lib/site-identity";
import { env } from "@/lib/env";

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
}): Promise<EnvioPush> {
  if (!pushConfigurado()) return { enviados: 0, caducados: 0, fallidos: 0 };
  const nombre = await configurar();

  const subs = await db.select().from(pushSubscriptions);
  const payload = JSON.stringify({
    title: input.titulo.slice(0, 120),
    body: input.cuerpo.slice(0, 220),
    url: input.url,
    tag: "cg-noticia",
    badge: "/icon?size=96",
    icon: "/icon?size=192",
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
          { TTL: 60 * 60 * 6 },
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
