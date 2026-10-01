/**
 * Reglas de una zona de publicidad antes de guardarla. Las comparten el
 * formulario de una zona (`saveAdsZone`) y la publicación del borrador del
 * editor de portada, para que un anuncio no pueda entrar por un camino con
 * reglas distintas al otro. Sin "server-only": son funciones puras.
 */
export type AdInput = {
  html: string | null;
  imageUrl: string | null;
  clickUrl: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** Mensaje de error (en español) o null si el anuncio es válido. */
export function validateAd(a: AdInput): string | null {
  if (a.html && a.imageUrl) {
    return "Usa HTML o imagen, no ambos: si hay HTML, la imagen se ignora y confunde.";
  }
  if (a.active && !a.html && !a.imageUrl) {
    return "No se puede activar una zona sin creatividad (HTML o imagen).";
  }
  if (a.clickUrl && !/^https?:\/\//i.test(a.clickUrl)) {
    return "El enlace de destino debe empezar por http:// o https://";
  }
  if (a.imageUrl && !/^https?:\/\//i.test(a.imageUrl)) {
    return "La URL de la imagen debe empezar por http:// o https://";
  }
  if (a.startsAt && a.endsAt && a.startsAt > a.endsAt) {
    return "La fecha de inicio es posterior a la de fin.";
  }
  return null;
}

/** Fecha de un <input type="datetime-local"> (vacío o inválido = sin fecha). */
export function parseAdDate(v: unknown): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
