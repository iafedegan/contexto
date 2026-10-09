import { DEFAULT_TICKER } from "@/lib/cintillo";
import type { HomeLayoutConfig } from "@/db/schema";

/**
 * Disposición por defecto de la portada. Compartido entre la portada
 * pública, el editor del panel y `getHomeLayoutConfig` — sin "server-only"
 * porque también lo usa el builder (cliente).
 */
export const DEFAULT_HOME_LAYOUT: Required<HomeLayoutConfig> = {
  templateId: "clasico",
  breveDirection: "vertical",
  breveColumns: 2,
  riverColumns: 3,
  background: { mode: "theme" },
  regions: {},
  parts: {},
  sectionFilters: "cabecera",
  sectionEls: {},
  zones: {},
  ticker: DEFAULT_TICKER,
};

// Identificador de una plantilla de portada.
export type HomeTemplateId = NonNullable<HomeLayoutConfig["templateId"]>;

// Descripción de una plantilla: id, nombre y cómo se presenta al editor.
export type HomeTemplate = {
  id: HomeTemplateId;
  name: string;
  description: string;
  /** Sin `ticker`: elegir una plantilla no debe borrar el cintillo que el editor configuró. */
  config: Omit<Required<HomeLayoutConfig>, "ticker">;
};

/**
 * Plantillas de portada listas para elegir en /panel/portada. Cada una fija
 * `templateId` (que decide componentes y efectos: carrusel, tiles, hovers)
 * más una disposición de secciones de partida — no son solo un cambio de
 * columnas, cambian qué se renderiza.
 */
export const HOME_TEMPLATES: HomeTemplate[] = [
  {
    id: "esmeralda",
    name: "Esmeralda Real",
    description:
      "Obsidiana verde y pan de oro: cabecera centrada con cintillo de titulares, apertura a sangre con lámina metálica y columna «Lo último» numerada.",
    config: { templateId: "esmeralda", breveDirection: "vertical", breveColumns: 2, riverColumns: 3, background: { mode: "theme" }, regions: {}, parts: {}, sectionFilters: "cabecera", sectionEls: {}, zones: {} },
  },
  {
    id: "clasico",
    name: "Clásico",
    description: "Diario tradicional: principal fija + columna “En breve”. Subrayado sutil al pasar el mouse.",
    config: { templateId: "clasico", breveDirection: "vertical", breveColumns: 2, riverColumns: 3, background: { mode: "theme" }, regions: {}, parts: {}, sectionFilters: "cabecera", sectionEls: {}, zones: {} },
  },
  {
    id: "revista",
    name: "Revista",
    description: "Carrusel automático como portada + “En breve” en carrusel horizontal. Fotos grandes, tarjetas que se alzan al pasar el mouse.",
    config: { templateId: "revista", breveDirection: "horizontal", breveColumns: 3, riverColumns: 3, background: { mode: "theme" }, regions: {}, parts: {}, sectionFilters: "cabecera", sectionEls: {}, zones: {} },
  },
  {
    id: "compacto",
    name: "Compacto",
    description: "Cuadrícula densa de fichas: la imagen se oscurece y el titular aparece al pasar el mouse. Máxima cantidad de notas visibles.",
    config: { templateId: "compacto", breveDirection: "horizontal", breveColumns: 4, riverColumns: 4, background: { mode: "theme" }, regions: {}, parts: {}, sectionFilters: "cabecera", sectionEls: {}, zones: {} },
  },
  {
    id: "vanguardia",
    name: "Vanguardia",
    description: "Cuadrícula “bento” oscura y asimétrica con orbes de gradiente, esquinas muy redondeadas y fichas que revelan resumen y brillo al pasar el mouse. Lo más moderno.",
    config: { templateId: "vanguardia", breveDirection: "horizontal", breveColumns: 4, riverColumns: 4, background: { mode: "theme" }, regions: {}, parts: {}, sectionFilters: "cabecera", sectionEls: {}, zones: {} },
  },
  {
    id: "gremial",
    name: "Gremial",
    description: "Papel blanco, acento rojo y verde institucional: cabecera con indicadores, apertura + 3 destacadas, cuadrícula de \"Últimas noticias\", accesos rápidos por sección, columnistas y boletín. Estilo sitio de gremio/federación.",
    config: { templateId: "gremial", breveDirection: "horizontal", breveColumns: 4, riverColumns: 4, background: { mode: "theme" }, regions: {}, parts: {}, sectionFilters: "cabecera", sectionEls: {}, zones: {} },
  },
];

/** Reparte una lista ordenada de artículos en los cuatro huecos de la
 * portada. Los mismos índices que usa /panel/portada para el drag & drop. */
export function splitHomeSlots<T>(items: T[]): { lead?: T; second?: T; rail: T[]; river: T[] } {
  const [lead, second, ...tail] = items;
  return { lead, second, rail: tail.slice(0, 4), river: tail.slice(4) };
}

/**
 * En el celular las notas van de a dos por fila, salvo las que ocupan todo el ancho: la primera (la destacada) y, si tras
 * ella queda un número impar de notas, la última, para no dejar una tarjeta sola con medio ancho vacío.
 */
export function anchaEnCelular(indice: number, total: number): boolean {
  return indice === 0 || (indice === total - 1 && (total - 1) % 2 === 1);
}

// Tailwind necesita ver las clases completas en el código fuente (no arma
// nombres de clase dinámicos), de ahí el mapa explícito en vez de interpolar.
export const RIVER_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
};
// Clases de cuadrícula según el número de columnas de «En breve» en horizontal.
export const BREVE_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
};
