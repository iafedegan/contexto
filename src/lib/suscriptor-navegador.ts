import "server-only";
import { cookies } from "next/headers";
import { firmar } from "@/lib/claves";

/**
 * Marca de «este navegador es de un suscriptor confirmado del boletín» (cookie `cg_sus`). Solo la pone el sitio cuando hay prueba de que
 * la persona controla el correo: al confirmar la suscripción (doble opt-in) o al llegar desde el enlace firmado de un boletín. Se borra al
 * darse de baja desde el navegador. Sirve solo para no volver a ofrecerle el formulario: no identifica el equipo ni guarda datos del
 * dispositivo (es una cookie necesaria para un servicio que la persona pidió, ver /politica-de-cookies).
 */
export const COOKIE_SUSCRIPTOR = "cg_sus";
const UN_ANO = 365 * 24 * 3600;

/** Valor firmado: no revela el correo ni el id del suscriptor. */
const valor = (subscriberId: string) => firmar("lectura-boletin", `navegador:${subscriberId}`).slice(0, 24);

export async function marcarNavegadorSuscriptor(subscriberId: string): Promise<void> {
  (await cookies()).set(COOKIE_SUSCRIPTOR, valor(subscriberId), { path: "/", maxAge: UN_ANO, sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: false });
}

export async function quitarMarcaSuscriptor(): Promise<void> {
  (await cookies()).delete(COOKIE_SUSCRIPTOR);
}
