import { escapeHtml } from "@/lib/escape";

/** Una imagen dentro del cuerpo de la nota: la dirección, su texto alternativo, el pie (opcional) y el crédito (siempre). */
export type DatosFigura = { url: string; alt: string; pie: string; credito: string };

/** ¿Es una dirección de imagen que se puede poner en la nota? Solo https (el sitio no carga imágenes inseguras). */
export const urlImagenValida = (u: string) => /^https:\/\/\S+$/i.test(u.trim()) && u.trim().length <= 2000;

/** Pie que se ve bajo la imagen: el texto que escribió la persona y, después, el crédito. */
export function pieConCredito(pie: string, credito: string): string {
  const p = pie.replace(/\s+/g, " ").trim();
  const c = credito.replace(/\s+/g, " ").trim();
  if (!p) return c;
  return `${/[.!?…»”)]$/.test(p) ? p : `${p}.`} ${c}`;
}

/** HTML de la imagen tal como se guarda en el cuerpo (el sanitizador del sitio deja pasar figure, img y figcaption). */
export function figuraImagen(d: DatosFigura): string {
  const alt = d.alt.replace(/\s+/g, " ").trim().slice(0, 300) || d.pie.trim().slice(0, 300) || "Imagen de la nota";
  return `<figure><img src="${escapeHtml(d.url.trim())}" alt="${escapeHtml(alt)}" loading="lazy"><figcaption>${escapeHtml(pieConCredito(d.pie, d.credito))}</figcaption></figure>`;
}
