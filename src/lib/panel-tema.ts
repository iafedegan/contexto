import type { Theme } from "@/lib/theme";

/**
 * Colores de la barra lateral del panel: el color principal de la plantilla que usa el sitio, para que el panel «huela» a la
 * marca elegida en /panel/portada. `desde` y `hasta` son los extremos del degradado vertical (siempre oscuros: el texto de la
 * barra es claro) y `acento` el color de la nota activa, el avatar y los filos.
 */
export type ColorPanel = { desde: string; hasta: string; acento: string };

// El azul marino de siempre: sin plantilla conocida (o sin base de datos) la barra se ve como antes.
const MARINO: ColorPanel = { desde: "#16315c", hasta: "#0f2347", acento: "#f4a93d" };

const POR_PLANTILLA: Partial<Record<Theme, ColorPanel>> = {
  // Esmeralda Real: verde esmeralda profundo y pan de oro.
  esmeralda: { desde: "#14472d", hasta: "#082519", acento: "#d8b558" },
  // Clásico: el rojo de su cabecera, en borgoña.
  clasico: { desde: "#8a2018", hasta: "#561410", acento: "#f1d9a3" },
  // Revista: negro cálido y dorado.
  revista: { desde: "#2b2620", hasta: "#16130f", acento: "#d4a24e" },
  // Compacto: azul zafiro.
  compacto: { desde: "#1e3f94", hasta: "#14295f", acento: "#7cc4f5" },
  // Vanguardia: casi negro con violeta, y el coral como acento.
  vanguardia: { desde: "#2d1f63", hasta: "#171033", acento: "#ff6a48" },
  // Gremial: el rojo de su logotipo.
  gremial: { desde: "#8c261c", hasta: "#5c1812", acento: "#f3c58e" },
};

/** Colores de la barra del panel para la plantilla activa (`home` es el nombre antiguo de Esmeralda Real). */
export function colorPanel(tema: string | null | undefined): ColorPanel {
  const id = tema === "home" ? "esmeralda" : tema;
  return POR_PLANTILLA[id as Theme] ?? MARINO;
}
