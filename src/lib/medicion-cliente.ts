/**
 * Permiso de medición del lector (navegador). La decisión vive en la cookie `cg_med` («si» / «no») y, solo si dijo que sí,
 * el código anónimo del visitante vive en la cookie `cg_vid` (un UUID aleatorio: no lleva nombre, correo ni IP). Si dice que
 * no —o lo cambia después—, el código se borra y no se vuelve a crear. Todo es del propio sitio (cookies propias).
 */
export const MED_COOKIE = "cg_med";
export const VID_COOKIE = "cg_vid";
/** Evento del navegador que avisa de que la persona decidió (o cambió su decisión). */
export const MED_EVENT = "cg-med";
const DIAS_PERMISO = 365;
const DIAS_CODIGO = 400; // el máximo que los navegadores dejan guardar una cookie

const leer = (n: string) => document.cookie.match(new RegExp(`(?:^|; )${n}=([^;]*)`))?.[1] ?? null;
const escribir = (n: string, v: string, dias: number) => {
  document.cookie = `${n}=${encodeURIComponent(v)}; Max-Age=${dias * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
};
const borrar = (n: string) => {
  document.cookie = `${n}=; Max-Age=0; Path=/; SameSite=Lax`;
};

/** La decisión guardada, o `null` si todavía no la tomó. */
export function decisionMedicion(): "si" | "no" | null {
  const v = leer(MED_COOKIE);
  return v === "si" || v === "no" ? v : null;
}

/** Guarda la decisión; si es «no», borra el código del visitante. Avisa a quien escuche. */
export function decidirMedicion(acepta: boolean) {
  escribir(MED_COOKIE, acepta ? "si" : "no", acepta ? DIAS_PERMISO : 90);
  if (!acepta) borrar(VID_COOKIE);
  window.dispatchEvent(new Event(MED_EVENT));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** El código anónimo del visitante (lo crea la primera vez) y si ya había leído antes. `null` si no aceptó la medición. */
export function visitante(): { id: string; recurrente: boolean } | null {
  if (decisionMedicion() !== "si") return null;
  const actual = leer(VID_COOKIE);
  if (actual && UUID.test(actual)) {
    escribir(VID_COOKIE, actual, DIAS_CODIGO); // renueva la vigencia en cada visita
    return { id: actual, recurrente: true };
  }
  const id = crypto.randomUUID();
  escribir(VID_COOKIE, id, DIAS_CODIGO);
  return { id, recurrente: false };
}
