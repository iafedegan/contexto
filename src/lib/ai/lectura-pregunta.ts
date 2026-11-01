/**
 * Qué pide de verdad la pregunta de un lector, sin base de datos ni IA: las palabras del tema (sin «noticias», «recientes» ni verbos de relleno,
 * que como palabras clave traían notas que solo las mencionan), si quiere notas y no cifras, y de qué periodo.
 */
export type LecturaPregunta = {
  claves: string[];
  pideNotas: boolean;
  /** Publicadas desde esta fecha; `null` si no pidió un periodo. */
  desde: Date | null;
  /** El periodo como lo diría el asistente («esta semana»). */
  periodo: string | null;
};

const DIA_MS = 86_400_000;
const sinTilde = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "");

const PERIODOS: Array<{ patron: RegExp; dias: number; nombre: string }> = [
  { patron: /\bhoy\b/, dias: 1, nombre: "hoy" },
  { patron: /\bayer\b/, dias: 2, nombre: "ayer" },
  { patron: /\b(esta|la ultima) semana\b/, dias: 7, nombre: "esta semana" },
  { patron: /\b(este|el ultimo) mes\b/, dias: 31, nombre: "este mes" },
  { patron: /\b(este|el ultimo) ano\b/, dias: 366, nombre: "este año" },
];

const PIDE_NOTAS = /\b(noticias?|notas?|articulos?|titulares?)\b/;

// No describen el tema: la forma de pedir y las palabras vacías, ya sin tildes.
const RELLENO = new Set(
  ("noticia noticias nota notas articulo articulos titular titulares reciente recientes ultima ultimas ultimo ultimos nueva nuevas nuevo nuevos actual actuales " +
    "hoy ayer semana mes ano esta este estas estos ese esa esos esas la el los las un una unos unas de del a al y o u en con por para que como cual cuales donde cuando " +
    "cuanto cuanta cuantos cuantas quien quienes se su sus mi mis tu tus me lo le les es son fue ser esta estan va van hay ha han muy mas menos sobre entre desde hasta segun " +
    "dijo dice dicen hablan habla hablo paso pasa tiene tienen cuesta cuestan vale valen busca buscar buscame trae traer traeme muestra muestrame dame dime quiero necesito " +
    "puedes sabes informacion info acerca respecto favor").split(" "),
);

export function leerPregunta(pregunta: string, ahora = new Date()): LecturaPregunta {
  const texto = pregunta.toLowerCase();
  const plano = sinTilde(texto).replace(/[^a-z0-9ñ\s]/g, " ");
  const periodo = PERIODOS.find((p) => p.patron.test(plano)) ?? null;
  const claves = texto
    .replace(/[^a-z0-9ñáéíóúü\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !RELLENO.has(sinTilde(w)));
  return {
    claves: [...new Set(claves)],
    pideNotas: PIDE_NOTAS.test(plano),
    desde: periodo ? new Date(ahora.getTime() - periodo.dias * DIA_MS) : null,
    periodo: periodo?.nombre ?? null,
  };
}

// Por dónde empieza la palabra, para que «vacunación» encuentre «vacunar» y «exportaciones» encuentre «exportaría».
const raiz = (w: string) => sinTilde(w).slice(0, Math.max(4, Math.min(6, w.length - 1)));

/** ¿El texto trata esta palabra? Compara el comienzo de cada palabra: «carne» no coincide dentro de otra como «encarnecido». */
export function mencionaClave(texto: string, clave: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${raiz(clave)}`).test(sinTilde(texto.toLowerCase()));
}

/**
 * Las notas que tienen TODAS las palabras en el título o el resumen van aparte: son las que tratan del tema. Primero las que las tienen en el título
 * y, dentro de cada grupo, de la más nueva a la más vieja.
 * `resto` conserva el orden del buscador. Sin palabras no hay con qué separar y todas cuentan como del tema.
 */
export function separarPorTema<T extends { title: string; summary: string; publishedAt?: string | null }>(notas: T[], claves: string[]): { delTema: T[]; resto: T[] } {
  if (!claves.length) return { delTema: notas, resto: [] };
  const delTema: T[] = [];
  const resto: T[] = [];
  for (const n of notas) (claves.every((c) => mencionaClave(`${n.title} ${n.summary}`, c)) ? delTema : resto).push(n);
  const enTitulo = (n: T) => (claves.every((c) => mencionaClave(n.title, c)) ? 1 : 0);
  delTema.sort((a, b) => enTitulo(b) - enTitulo(a) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return { delTema, resto };
}

/** Las notas publicadas desde la fecha. Sin fecha, todas. */
export function publicadaDesde<T extends { publishedAt?: string | null }>(notas: T[], desde: Date | null): T[] {
  if (!desde) return notas;
  return notas.filter((n) => !!n.publishedAt && new Date(n.publishedAt) >= desde);
}
