/**
 * Tipografías premium del portal. `next/font/google` las **descarga en build**
 * y las auto-hospeda (cero peticiones a Google en runtime, cero CLS).
 *
 * Cada plantilla usa una pareja distinta (display + texto). El mapeo
 * familia → plantilla vive en `globals.css`, en el bloque `[data-theme]`.
 */
import {
  Bodoni_Moda,
  Cormorant_Garamond,
  Inter_Tight,
  JetBrains_Mono,
  Jost,
  Marcellus,
  Outfit,
  Playfair_Display,
  Source_Serif_4,
  Space_Grotesk,
  Spectral,
  Syne,
} from "next/font/google";

/** Portada — titulares de alta moda editorial. */
export const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", variable: "--f-playfair" });
/** UI neutra de alta densidad (portada, buscador, panel). */
export const interTight = Inter_Tight({ subsets: ["latin"], display: "swap", variable: "--f-inter" });
/** Artículo — didona de contraste extremo. */
export const bodoni = Bodoni_Moda({ subsets: ["latin"], display: "swap", variable: "--f-bodoni" });
/** Artículo — serif de lectura larga. */
export const spectral = Spectral({
  subsets: ["latin"], display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--f-spectral",
});
/** Sección — grotesca expresiva. */
export const syne = Syne({ subsets: ["latin"], display: "swap", variable: "--f-syne" });
/** Sección / buscador — grotesca técnica. */
export const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--f-grotesk" });
/** Autor — garalda de trazo fino. */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"], display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--f-cormorant",
});
/** Autor — geométrica ligera. */
export const jost = Jost({ subsets: ["latin"], display: "swap", variable: "--f-jost" });
/** Asistente — geométrica contemporánea. */
export const outfit = Outfit({ subsets: ["latin"], display: "swap", variable: "--f-outfit" });
/** Buscador / asistente — monoespaciada de datos. */
export const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--f-mono" });
/** Documentos institucionales — capital romana. */
export const marcellus = Marcellus({ subsets: ["latin"], display: "swap", weight: "400", variable: "--f-marcellus" });
/** Documentos institucionales — serif de cuerpo. */
export const sourceSerif = Source_Serif_4({ subsets: ["latin"], display: "swap", variable: "--f-source-serif" });

export const fontVariables = [
  playfair,
  interTight,
  bodoni,
  spectral,
  syne,
  grotesk,
  cormorant,
  jost,
  outfit,
  mono,
  marcellus,
  sourceSerif,
]
  .map((f) => f.variable)
  .join(" ");
