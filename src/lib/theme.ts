/**
 * Temas de plantilla. Cada clave corresponde a un bloque `[data-theme="…"]`
 * en `globals.css` y a una variante de navbar/footer/tarjeta.
 */
export type Theme =
  | "home"
  | "esmeralda"
  | "clasico"
  | "revista"
  | "compacto"
  | "vanguardia"
  | "gremial"
  | "articulo"
  | "seccion"
  | "autor"
  | "buscar"
  | "asistente"
  | "institucional"
  | "archivo"
  | "panel"
  | "acceso";

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "CONtexto Ganadero";

/** Nombre "de galería" del tema, visible en los footers como firma de diseño. */
export const THEME_LABEL: Record<Theme, string> = {
  home: "Esmeralda Real",
  esmeralda: "Esmeralda Real",
  clasico: "Clásico · Broadsheet",
  revista: "Revista · Negro y Oro",
  compacto: "Compacto · Zafiro",
  vanguardia: "Vanguardia · Bento",
  gremial: "Gremial · Papel & Rojo",
  articulo: "Marfil & Burdeos",
  seccion: "Cobre & Obsidiana",
  autor: "Champán & Perla",
  buscar: "Zafiro Medianoche",
  asistente: "Obsidiana & Aurora",
  institucional: "Mármol & Verde Botella",
  archivo: "Sepia & Ámbar",
  panel: "Grafito & Jade",
  acceso: "Platino",
};
