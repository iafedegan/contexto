/**
 * Armado de una edición: una lista ordenada donde se mezclan encabezados de sección («Última hora», «Colombia»…) y notas. Las notas
 * que siguen a un encabezado forman esa sección. Sin `server-only`: lo usan el servidor (al validar y dibujar) y el panel (al armar).
 */

/** Un renglón del armado: un encabezado de sección (`s`) o una nota (`n`). */
export type ItemEdicion = { t: "s"; titulo: string } | { t: "n"; slug: string };

export const MAX_NOTAS = 12;
export const MAX_SECCIONES = 10;
export const MAX_TITULO = 80;
/** Título por defecto de una sección sin nombre. */
export const TITULO_SECCION = "Sección";

const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{1,219}$/;

/** Deja solo lo válido: tipos conocidos, títulos limpios, notas sin repetir y dentro de los máximos. Lo que llega de la red pasa siempre por aquí. */
export function sanitizarItems(v: unknown): ItemEdicion[] {
  if (!Array.isArray(v)) return [];
  const vistos = new Set<string>();
  const out: ItemEdicion[] = [];
  let notas = 0;
  let secciones = 0;
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (o.t === "s" && typeof o.titulo === "string") {
      if (secciones >= MAX_SECCIONES) continue;
      out.push({ t: "s", titulo: o.titulo.replace(/\s+/g, " ").trim().slice(0, MAX_TITULO) || TITULO_SECCION });
      secciones++;
    } else if (o.t === "n" && typeof o.slug === "string" && SLUG.test(o.slug)) {
      if (vistos.has(o.slug) || notas >= MAX_NOTAS) continue;
      vistos.add(o.slug);
      out.push({ t: "n", slug: o.slug });
      notas++;
    }
  }
  return out;
}

/** Las notas, en orden y sin encabezados (lo que usan la lista plana y la versión en texto). */
export const slugsDeItems = (items: ItemEdicion[]): string[] => items.flatMap((i) => (i.t === "n" ? [i.slug] : []));

/** Una lista plana de notas como armado sin secciones. */
export const itemsDeSlugs = (slugs: string[]): ItemEdicion[] => slugs.map((slug) => ({ t: "n" as const, slug }));

/** ¿El armado tiene al menos un encabezado de sección? Sin ninguno, el correo se dibuja como siempre. */
export const tieneSecciones = (items: ItemEdicion[] | undefined): boolean => !!items?.some((i) => i.t === "s");

/**
 * Agrupa las notas por sección. Las notas anteriores al primer encabezado quedan en una sección sin título; las secciones sin ninguna nota
 * disponible (p. ej. todas despublicadas) se omiten.
 */
export function agruparEnSecciones<T extends { slug: string }>(items: ItemEdicion[], porSlug: Map<string, T>): { titulo: string | null; articulos: T[] }[] {
  const grupos: { titulo: string | null; articulos: T[] }[] = [{ titulo: null, articulos: [] }];
  for (const i of items) {
    if (i.t === "s") grupos.push({ titulo: i.titulo, articulos: [] });
    else {
      const a = porSlug.get(i.slug);
      if (a) grupos[grupos.length - 1].articulos.push(a);
    }
  }
  return grupos.filter((g) => g.articulos.length > 0);
}

// --- Operaciones del armado (puras: el panel las usa al arrastrar, mover, añadir y quitar) -------------------------

const usadas = (items: ItemEdicion[]) => new Set(slugsDeItems(items));

/** Añade una nota al final (si ya está o no caben más, no cambia nada). */
export function anadirNota(items: ItemEdicion[], slug: string): ItemEdicion[] {
  const u = usadas(items);
  return u.has(slug) || u.size >= MAX_NOTAS ? items : [...items, { t: "n", slug }];
}

/** Sube (`d` = −1) o baja (`d` = 1) un renglón, sea nota o encabezado. */
export function moverItem(items: ItemEdicion[], i: number, d: -1 | 1): ItemEdicion[] {
  const j = i + d;
  if (i < 0 || j < 0 || i >= items.length || j >= items.length) return items;
  const a = [...items];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

/** Quita un renglón (nota o encabezado; al quitar un encabezado sus notas pasan a la sección anterior). */
export const quitarItem = (items: ItemEdicion[], i: number): ItemEdicion[] => items.filter((_, k) => k !== i);

/** Pone una nota en una posición (al soltarla): si ya estaba la mueve; si es nueva la inserta, siempre dentro del máximo. */
export function colocarNota(items: ItemEdicion[], slug: string, pos: number): ItemEdicion[] {
  const antes = items.findIndex((x) => x.t === "n" && x.slug === slug);
  if (antes < 0 && usadas(items).size >= MAX_NOTAS) return items;
  const sin = items.filter((x) => !(x.t === "n" && x.slug === slug));
  const i = Math.max(0, Math.min(sin.length, antes >= 0 && antes < pos ? pos - 1 : pos));
  return [...sin.slice(0, i), { t: "n", slug }, ...sin.slice(i)];
}

/** Cambia el título de un encabezado. */
export const renombrarSeccion = (items: ItemEdicion[], i: number, titulo: string): ItemEdicion[] =>
  items.map((x, k) => (k === i && x.t === "s" ? { t: "s", titulo: titulo.slice(0, MAX_TITULO) } : x));

/** Añade una sección al final con esas notas (las que ya estaban en el boletín no se repiten y se respeta el máximo). */
export function anadirSeccion(items: ItemEdicion[], titulo: string, slugs: string[]): ItemEdicion[] {
  if (items.filter((x) => x.t === "s").length >= MAX_SECCIONES) return items;
  const u = usadas(items);
  const nuevas: ItemEdicion[] = [];
  for (const s of slugs) {
    if (u.has(s) || u.size >= MAX_NOTAS) continue;
    u.add(s);
    nuevas.push({ t: "n", slug: s });
  }
  return [...items, { t: "s", titulo: titulo.trim().slice(0, MAX_TITULO) || TITULO_SECCION }, ...nuevas];
}

/** Una nota que se puede traer al boletín (lo que necesita elegirla por sección o por «última hora»). */
export type NotaElegible = { slug: string; seccion: string; publishedAt: string | null; esUltimaHora: boolean };

const reciente = (a: NotaElegible, b: NotaElegible) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

/** Las `n` notas más recientes de una sección del sitio que aún no están en el boletín. */
export function notasDeSeccion(notas: NotaElegible[], seccion: string, items: ItemEdicion[], n = 3): string[] {
  const u = usadas(items);
  return notas.filter((x) => x.seccion === seccion && !u.has(x.slug)).sort(reciente).slice(0, n).map((x) => x.slug);
}

/** «Última hora»: primero las marcadas así en el panel y, si no hay suficientes, las más recientes del sitio. */
export function notasDeUltimaHora(notas: NotaElegible[], items: ItemEdicion[], n = 3): string[] {
  const u = usadas(items);
  const libres = notas.filter((x) => !u.has(x.slug)).sort(reciente);
  return [...libres.filter((x) => x.esUltimaHora), ...libres.filter((x) => !x.esUltimaHora)].slice(0, n).map((x) => x.slug);
}
