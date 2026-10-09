import { splitHomeSlots } from "@/lib/home-layout";

/** En qué hueco de la portada está una nota. */
export type ZonaPortada = "principal" | "secundaria" | "en_breve" | "rio";
/** Lugar de una nota en la portada: hueco, posición (1 = la primera) y si la fijó un editor o entró por fecha. */
export type PosicionPortada = { zona: ZonaPortada; posicion: number; fijadaPorEditor: boolean };

/**
 * Reparte el orden de la portada (ya ordenado: primero lo fijado a mano, luego por fecha) en huecos. Usa los mismos cortes que
 * `splitHomeSlots`, que es lo que pinta la portada: 1 principal, 1 secundaria, 4 «en breve» y el resto en el río.
 */
export function posicionesDePortada(orden: { slug: string; fijada: boolean }[]): Map<string, PosicionPortada> {
  const { lead, second, rail } = splitHomeSlots(orden.map((_, i) => i));
  const zonaDe = (i: number): ZonaPortada => (i === lead ? "principal" : i === second ? "secundaria" : rail.includes(i) ? "en_breve" : "rio");
  return new Map(orden.map((o, i) => [o.slug, { zona: zonaDe(i), posicion: i + 1, fijadaPorEditor: o.fijada }]));
}

/**
 * Dónde está una nota ahora mismo, para la API pública: en qué hueco de la portada, en qué sección, si es la «Última hora»
 * de la barra roja, si está «En vivo» y si figura entre las más leídas. Antes la API solo daba el `slug` de la categoría y el
 * integrador no podía saber qué notas estaban en portada ni en qué orden. Función pura: la API le pasa lo ya consultado.
 */
export type Ubicacion = {
  portada: {
    /** La nota sale hoy en la portada. */
    esta: boolean;
    /** `principal` (1), `secundaria` (1), `en_breve` (4) o `rio` (el resto); `null` si no está en la portada. */
    zona: ZonaPortada | null;
    /** 1 = la primera de la portada; `null` si no está. */
    posicion: number | null;
    /** `true` si un editor la fijó en /panel/portada; `false` si entró por ser de las más recientes. */
    fijadaPorEditor: boolean;
  };
  /** Sección (categoría) de la nota y, si es una subsección, la sección de la que cuelga. */
  seccion: { slug: string; nombre: string; padre: { slug: string; nombre: string } | null } | null;
  ultimaHora: {
    /** El editor la marcó como «Última hora». */
    marcada: boolean;
    /** Es la que muestra hoy la barra roja (solo se muestra la marcada más reciente). */
    enBarra: boolean;
  };
  /** Lleva la etiqueta «En vivo». */
  enVivo: boolean;
  masLeidas: { esta: boolean; posicion: number | null };
};

export function armarUbicacion(d: {
  categoria: { slug: string; nombre: string } | null;
  padre: { slug: string; nombre: string } | null;
  portada: PosicionPortada | undefined;
  marcadaUltimaHora: boolean;
  enBarra: boolean;
  enVivo: boolean;
  /** Puesto entre las más leídas (1 = la primera), si figura. */
  masLeidas: number | undefined;
}): Ubicacion {
  const p = d.portada;
  return {
    portada: { esta: !!p, zona: p?.zona ?? null, posicion: p?.posicion ?? null, fijadaPorEditor: p?.fijadaPorEditor ?? false },
    seccion: d.categoria ? { slug: d.categoria.slug, nombre: d.categoria.nombre, padre: d.padre } : null,
    ultimaHora: { marcada: d.marcadaUltimaHora, enBarra: d.enBarra },
    enVivo: d.enVivo,
    masLeidas: { esta: d.masLeidas !== undefined, posicion: d.masLeidas ?? null },
  };
}
