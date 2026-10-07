/**
 * Validación de lo que manda el navegador al medir una lectura (`/api/lectura`). Nada de lo recibido se guarda sin pasar
 * por aquí: códigos con forma de UUID, números acotados y textos recortados. Pura y probada.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const t = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const entero = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
};

/** ¿Tiene forma de UUID? (los códigos del visitante y del suscriptor lo son). */
export const esUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export type EntradaInicio = { visitante: string; slug: string; recurrente: boolean; utm: { utmSource: string; utmMedium: string; utmCampaign: string; referrer: string } };
export type EntradaProgreso = { visitante: string; lectura: string; scroll: number; segundos: number };
export type EntradaVinculo = { visitante: string; suscriptor: string; firma: string };

/** Inicio de una lectura: `null` si falta el código del visitante o la nota. */
export function validarInicio(b: unknown): EntradaInicio | null {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const visitante = t(o.vid, 40);
  const slug = t(o.slug, 200);
  if (!UUID.test(visitante) || !slug) return null;
  return { visitante: visitante.toLowerCase(), slug, recurrente: o.ret === true, utm: { utmSource: t(o.us, 60), utmMedium: t(o.um, 60), utmCampaign: t(o.uc, 80), referrer: t(o.ref, 300) } };
}

/** Avance de una lectura: hasta dónde bajó (0 a 100) y los segundos con la pestaña a la vista (tope de una hora). */
export function validarProgreso(b: unknown): EntradaProgreso | null {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const visitante = t(o.vid, 40);
  const lectura = t(o.id, 40);
  if (!UUID.test(visitante) || !UUID.test(lectura)) return null;
  return { visitante: visitante.toLowerCase(), lectura: lectura.toLowerCase(), scroll: entero(o.sc, 0, 100), segundos: entero(o.s, 0, 3600) };
}

/** Una lectura cuenta como «completa» cuando la persona llegó casi al final de la nota. */
export const LECTURA_COMPLETA = 85;

/** Vínculo de un navegador con un suscriptor, por el enlace del correo (`cgs` = suscriptor, `cgt` = firma). */
export function validarVinculo(b: unknown): EntradaVinculo | null {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const visitante = t(o.vid, 40);
  const suscriptor = t(o.s, 40);
  const firma = t(o.t, 64);
  if (!UUID.test(visitante) || !UUID.test(suscriptor) || firma.length < 16) return null;
  return { visitante: visitante.toLowerCase(), suscriptor: suscriptor.toLowerCase(), firma };
}
