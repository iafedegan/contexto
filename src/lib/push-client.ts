/**
 * Utilidades de notificaciones push para el navegador (no importar desde el servidor).
 * Las comparten el interruptor de la barra lateral y el aviso de bienvenida de la PWA instalada.
 */

export const soportaPush = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** La app está abierta como PWA instalada (pantalla de inicio / ventana propia), no como pestaña del navegador. */
export function esPwaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches || nav.standalone === true;
}

/**
 * La clave VAPID viaja en base64url y `subscribe` espera bytes sobre un
 * ArrayBuffer propio (no compartido), de ahí la reserva explícita.
 */
export function base64UrlABytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(normal);
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i += 1) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

// Resultado de pedir la suscripción a notificaciones.
export type ResultadoSuscripcion = "activada" | "bloqueada" | "rechazada" | "error";

/** Pide el permiso (debe llamarse desde un clic) y registra la suscripción en el servidor. */
export async function suscribirPush(publicKey: string): Promise<ResultadoSuscripcion> {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return permiso === "denied" ? "bloqueada" : "rechazada";
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(publicKey) }));
    const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    return r.ok ? "activada" : "error";
  } catch {
    return "error";
  }
}

/** Con el permiso ya concedido, renueva el registro en el servidor (como mucho una vez al día). */
export async function renovarSuscripcion(publicKey: string) {
  try {
    if (Notification.permission !== "granted") return;
    const clave = "cg:push-renovada";
    if (Date.now() - Number(localStorage.getItem(clave) ?? 0) < 24 * 3600_000) return;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(publicKey) });
    await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    localStorage.setItem(clave, String(Date.now()));
  } catch {
    /* mejor esfuerzo */
  }
}
