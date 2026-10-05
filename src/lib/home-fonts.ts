/**
 * Catálogo de tipografías elegibles para el titular de una tarjeta en
 * /panel/portada.
 *
 * Son las mismas familias que ya se descargan y auto-hospedan en build
 * (`src/app/fonts.ts`): elegir cualquiera de ellas no añade una sola petición
 * de red ni un byte de descarga extra al visitante.
 *
 * `display` y `sans` se conservan por compatibilidad: son los dos valores que
 * existían antes y siguen guardados en artículos ya configurados.
 */
export type HomeTitleFont =
  | "display"
  | "sans"
  | "playfair"
  | "bodoni"
  | "cormorant"
  | "marcellus"
  | "spectral"
  | "source-serif"
  | "syne"
  | "grotesk"
  | "inter"
  | "jost"
  | "outfit"
  | "mono"
  | "arial"
  | "helvetica"
  | "georgia"
  | "times"
  | "verdana"
  | "trebuchet"
  | "tahoma"
  | "courier"
  | "systemui";

// Opción tipográfica que se ofrece al editor para los titulares.
export type HomeFontOption = {
  id: HomeTitleFont;
  /** Nombre que ve el editor. */
  label: string;
  /** Variable CSS con la familia. */
  cssVar: string;
  /** Familia visual: sirve para agrupar el selector. */
  group: "tema" | "serif" | "sans" | "sistema";
};

// Catálogo de tipografías disponibles, agrupadas por estilo.
export const HOME_FONTS: HomeFontOption[] = [
  // Heredadas del tema de la plantilla.
  { id: "display", label: "Titular del tema", cssVar: "var(--font-display)", group: "tema" },
  { id: "sans", label: "Texto del tema", cssVar: "var(--font-ui)", group: "tema" },

  // Serif: de alta moda editorial a lectura larga.
  { id: "playfair", label: "Playfair Display", cssVar: "var(--f-playfair)", group: "serif" },
  { id: "bodoni", label: "Bodoni Moda", cssVar: "var(--f-bodoni)", group: "serif" },
  { id: "cormorant", label: "Cormorant", cssVar: "var(--f-cormorant)", group: "serif" },
  { id: "marcellus", label: "Marcellus", cssVar: "var(--f-marcellus)", group: "serif" },
  { id: "spectral", label: "Spectral", cssVar: "var(--f-spectral)", group: "serif" },
  { id: "source-serif", label: "Source Serif", cssVar: "var(--f-source-serif)", group: "serif" },

  // Sans y monoespaciada.
  { id: "syne", label: "Syne", cssVar: "var(--f-syne)", group: "sans" },
  { id: "grotesk", label: "Space Grotesk", cssVar: "var(--f-grotesk)", group: "sans" },
  { id: "inter", label: "Inter Tight", cssVar: "var(--f-inter)", group: "sans" },
  { id: "jost", label: "Jost", cssVar: "var(--f-jost)", group: "sans" },
  { id: "outfit", label: "Outfit", cssVar: "var(--f-outfit)", group: "sans" },
  { id: "mono", label: "JetBrains Mono", cssVar: "var(--f-mono)", group: "sans" },

  // Fuentes del sistema: las trae el dispositivo del lector, no se descargan.
  { id: "arial", label: "Arial", cssVar: "Arial, Helvetica, sans-serif", group: "sistema" },
  { id: "helvetica", label: "Helvetica", cssVar: "'Helvetica Neue', Helvetica, Arial, sans-serif", group: "sistema" },
  { id: "verdana", label: "Verdana", cssVar: "Verdana, Geneva, sans-serif", group: "sistema" },
  { id: "tahoma", label: "Tahoma", cssVar: "Tahoma, Geneva, sans-serif", group: "sistema" },
  { id: "trebuchet", label: "Trebuchet MS", cssVar: "'Trebuchet MS', Helvetica, sans-serif", group: "sistema" },
  { id: "georgia", label: "Georgia", cssVar: "Georgia, 'Times New Roman', serif", group: "sistema" },
  { id: "times", label: "Times New Roman", cssVar: "'Times New Roman', Times, serif", group: "sistema" },
  { id: "courier", label: "Courier New", cssVar: "'Courier New', Courier, monospace", group: "sistema" },
  { id: "systemui", label: "Sistema (system-ui)", cssVar: "system-ui, -apple-system, 'Segoe UI', sans-serif", group: "sistema" },
];

// Índice del catálogo por id, para buscar rápido.
const BY_ID = new Map(HOME_FONTS.map((f) => [f.id, f]));

/** Familia CSS de una elección; `undefined` = la del tema (sin tocar nada). */
export function homeFontFamily(font: HomeTitleFont | undefined): string | undefined {
  if (!font) return undefined;
  return BY_ID.get(font)?.cssVar;
}

// Grupos con los que el selector organiza las tipografías.
export const HOME_FONT_GROUPS: Array<{ id: HomeFontOption["group"]; label: string }> = [
  { id: "tema", label: "Del tema" },
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans y mono" },
  { id: "sistema", label: "Del sistema (Arial, Georgia…)" },
];
