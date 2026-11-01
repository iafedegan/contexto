import type { HomeLayoutConfig, HomeStyle, Pantalla, VisualPantalla, ZoneStyle } from "@/db/schema";

/**
 * Edición por pantalla: lo visual de la portada (colores, tipografía, medidas, zonas, aspecto del menú y estilo de cada nota) puede ser
 * distinto en computador, tableta y celular; el contenido y la estructura (plantilla, notas y su orden, textos, cintillo) son comunes.
 *
 * Lo publicado antes de existir esto sigue siendo el punto de partida de las tres: una pantalla sin ajuste propio usa los valores generales.
 * El editor escribe solo en la pantalla elegida, nunca en los generales, así que tocar una no mueve a las otras. Cada pantalla guarda el
 * ajuste entero, no diferencias: no hace falta distinguir «quitar un color» de «heredarlo».
 */
export type { Pantalla };

export const PANTALLAS: { id: Pantalla; nombre: string }[] = [
  { id: "pc", nombre: "Computador" },
  { id: "tablet", nombre: "Tableta" },
  { id: "movil", nombre: "Celular" },
];

// Anchos de cada pantalla: los mismos cortes de la portada (sm = 640, lg = 1024).
export const MEDIA_PANTALLA: Record<Pantalla, string> = {
  pc: "(min-width:1024px)",
  tablet: "(min-width:640px) and (max-width:1023.98px)",
  movil: "(max-width:639.98px)",
};

/** Pantalla que corresponde a un ancho de ventana. */
export const pantallaDeAncho = (ancho: number): Pantalla => (ancho >= 1024 ? "pc" : ancho >= 640 ? "tablet" : "movil");

/** Envuelve la hoja de cada pantalla en su `@media`. Sin ajustes por pantalla, la hoja general de siempre. */
export function cssPorPantalla<T>(general: T | undefined, propio: (p: Pantalla) => T | undefined, generar: (v: T | undefined, p?: Pantalla) => string): string {
  if (PANTALLAS.every(({ id }) => propio(id) === undefined)) return generar(general);
  return PANTALLAS.map(({ id }) => {
    const css = generar(propio(id) ?? general, id);
    return css ? `@media ${MEDIA_PANTALLA[id]}{\n${css}\n}` : "";
  })
    .filter(Boolean)
    .join("\n");
}

/** El diseño tal como se ve en una pantalla: lo que leen los controles del editor. */
export function layoutDePantalla<L extends HomeLayoutConfig>(layout: L, p: Pantalla): L {
  const s = layout.pantallas?.[p];
  if (!s) return layout;
  return {
    ...layout,
    regions: s.regions ?? layout.regions,
    zones: s.zones ?? layout.zones,
    sectionEls: s.sectionEls ?? layout.sectionEls,
    menuNav: s.menuEstilo ? { ...layout.menuNav, estilo: s.menuEstilo } : layout.menuNav,
  };
}

/** Aplica un cambio del editor: lo visual va solo a la pantalla elegida; lo demás es común a las tres. */
export function conCambios<L extends HomeLayoutConfig>(layout: L, p: Pantalla, cambio: Partial<HomeLayoutConfig>): L {
  const { regions, zones, sectionEls, menuNav, ...comun } = cambio;
  const slot: VisualPantalla = { ...layout.pantallas?.[p] };
  if (regions !== undefined) slot.regions = regions;
  if (sectionEls !== undefined) slot.sectionEls = sectionEls;
  if (zones !== undefined) slot.zones = p === "movil" ? marcarLibres(layoutDePantalla(layout, p).zones, zones) : zones;
  const siguiente: L = { ...layout, ...comun };
  if (menuNav !== undefined) {
    // Del menú solo el aspecto es por pantalla: qué secciones y enlaces lleva es común.
    const resto = { ...menuNav };
    delete resto.estilo;
    slot.menuEstilo = menuNav.estilo ?? {};
    siguiente.menuNav = { ...resto, ...(layout.menuNav?.estilo ? { estilo: layout.menuNav.estilo } : {}) };
  }
  return { ...siguiente, pantallas: { ...layout.pantallas, [p]: slot } };
}

// En el celular las zonas se apilan a una columna salvo las que se ajustaron a propósito para él.
function marcarLibres(antes: Record<string, ZoneStyle> | undefined, ahora: Record<string, ZoneStyle>): Record<string, ZoneStyle> {
  return Object.fromEntries(Object.entries(ahora).map(([k, z]) => [k, JSON.stringify(antes?.[k]) === JSON.stringify(z) ? z : { ...z, libreEnMovil: true }]));
}

/** «Copiar a las otras pantallas»: todas quedan con lo visual de la elegida. */
export function copiarDiseno<L extends HomeLayoutConfig>(layout: L, p: Pantalla): L {
  const v = layoutDePantalla(layout, p);
  const copia = (destino: Pantalla): VisualPantalla => ({
    regions: v.regions ?? {},
    sectionEls: v.sectionEls ?? {},
    menuEstilo: v.menuNav?.estilo ?? {},
    zones: destino === "movil" ? Object.fromEntries(Object.entries(v.zones ?? {}).map(([k, z]) => [k, { ...z, libreEnMovil: true }])) : (v.zones ?? {}),
  });
  return { ...layout, pantallas: { pc: copia("pc"), tablet: copia("tablet"), movil: copia("movil") } };
}

/** El estilo de una nota en una pantalla. */
export function estiloEnPantalla(style: HomeStyle | null | undefined, p: Pantalla): HomeStyle {
  if (!style) return {};
  const { pantallas, ...general } = style;
  return pantallas?.[p] ?? general;
}

/** Cambia el estilo de una nota solo en una pantalla; `null` le quita sus ajustes en esa pantalla. */
export function conEstiloEnPantalla(style: HomeStyle | null | undefined, p: Pantalla, cambio: Partial<HomeStyle> | null): HomeStyle | null {
  const merged: HomeStyle = cambio === null ? {} : { ...estiloEnPantalla(style, p), ...cambio };
  for (const k of Object.keys(merged) as (keyof HomeStyle)[]) if (merged[k] === undefined) delete merged[k];
  return { ...(style ?? {}), pantallas: { ...style?.pantallas, [p]: merged } };
}

/** El estilo de la nota en una pantalla, copiado a las tres. */
export function copiarEstilo(style: HomeStyle | null | undefined, p: Pantalla): HomeStyle | null {
  if (!style) return null;
  const s = estiloEnPantalla(style, p);
  return { ...style, pantallas: { pc: s, tablet: s, movil: s } };
}
