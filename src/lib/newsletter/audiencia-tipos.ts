/**
 * A quién va una edición del boletín. Sin `server-only`: lo usan el servidor (al contar y enviar) y el panel (al elegir).
 *
 * `{}` (sin filtros) = todos los suscriptores confirmados y sin baja. Con filtros, cada TIPO de filtro tiene que cumplirse
 * (ciudad Y tema Y país Y antigüedad) y, dentro de un mismo tipo, basta con una opción (Bogotá O Medellín).
 */

/** Temas de interés que se ofrecen al suscribirse. Lista cerrada y estable: son los que sirven para segmentar. */
export const TEMAS_INTERES = [
  { id: "precios", es: "Precios y mercado", en: "Prices and market" },
  { id: "sanidad", es: "Sanidad animal", en: "Animal health" },
  { id: "genetica", es: "Genética y razas", en: "Genetics and breeds" },
  { id: "pastos", es: "Pastos y nutrición", en: "Pastures and nutrition" },
  { id: "sostenibilidad", es: "Sostenibilidad y clima", en: "Sustainability and climate" },
  { id: "leche", es: "Leche y lácteos", en: "Milk and dairy" },
  { id: "carne", es: "Carne y exportaciones", en: "Beef and exports" },
  { id: "gremio", es: "Gremio y política sectorial", en: "Industry and policy" },
  { id: "eventos", es: "Eventos, ferias y remates", en: "Events, fairs and auctions" },
  { id: "tecnologia", es: "Tecnología y gestión de la finca", en: "Technology and farm management" },
] as const;

const IDS_TEMAS: ReadonlySet<string> = new Set(TEMAS_INTERES.map((t) => t.id));

/** Filtros de destinatarios. */
export type Audiencia = {
  /** Ciudades (en minúsculas y sin tildes: la clave con que se agrupan). */
  ciudades: string[];
  /** Países (código de dos letras, p. ej. «CO»). */
  paises: string[];
  /** Temas de interés (`TEMAS_INTERES`): basta con que le interese uno. */
  temas: string[];
  /** Solo quienes se suscribieron en los últimos N días; `null` = sin límite. */
  nuevosDias: number | null;
};

export const AUDIENCIA_VACIA: Audiencia = { ciudades: [], paises: [], temas: [], nuevosDias: null };

/** Clave con que se agrupan las ciudades: minúsculas, sin tildes ni espacios sobrantes («  Bogotá » → «bogota»). */
export const claveCiudad = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

const lista = (v: unknown, max: number, ok: (s: string) => boolean, norm: (s: string) => string = (s) => s): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => norm(x.trim())).filter((x) => x && x.length <= 80 && ok(x)))].slice(0, max) : [];

/** Deja solo lo válido (listas acotadas, temas conocidos, países de dos letras, días entre 1 y 3650). Lo que llega de la red nunca se usa sin pasar por aquí. */
export function sanitizarAudiencia(v: unknown): Audiencia {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const dias = typeof o.nuevosDias === "number" && Number.isFinite(o.nuevosDias) ? Math.round(o.nuevosDias) : null;
  return {
    ciudades: lista(o.ciudades, 30, () => true, claveCiudad),
    paises: lista(o.paises, 10, (s) => /^[A-Za-z]{2}$/.test(s), (s) => s.toUpperCase()),
    temas: lista(o.temas, TEMAS_INTERES.length, (s) => IDS_TEMAS.has(s)),
    nuevosDias: dias !== null && dias >= 1 && dias <= 3650 ? dias : null,
  };
}

/** ¿Hay algún filtro? Sin filtros, la edición va a todos. */
export const esSegmento = (a: Audiencia) => a.ciudades.length > 0 || a.paises.length > 0 || a.temas.length > 0 || a.nuevosDias !== null;

/** Frase corta con a quién va («Bogotá y Medellín · interesados en Precios y mercado · nuevos de los últimos 30 días»). */
export function describirAudiencia(a: Audiencia, nombreCiudad: (clave: string) => string = (c) => c, nombrePais: (c: string) => string = (c) => c): string {
  if (!esSegmento(a)) return "Todos los suscriptores";
  const unir = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  const partes: string[] = [];
  if (a.ciudades.length) partes.push(unir(a.ciudades.map(nombreCiudad)));
  if (a.paises.length) partes.push(unir(a.paises.map(nombrePais)));
  if (a.temas.length) partes.push(`interesados en ${unir(a.temas.map((t) => TEMAS_INTERES.find((x) => x.id === t)?.es ?? t))}`);
  if (a.nuevosDias !== null) partes.push(`suscritos en los últimos ${a.nuevosDias} días`);
  return partes.join(" · ");
}
