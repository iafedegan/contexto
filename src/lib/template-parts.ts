import type { HomeTemplateId } from "@/lib/home-layout";

/**
 * Piezas para componer una plantilla desde cero en /panel/portada. Cada
 * plantilla prediseñada es una combinación de estas piezas; el editor puede
 * mezclarlas libremente (p. ej. navbar de Revista + cuerpo Bento + footer de
 * Clásico + paleta Esmeralda).
 *
 * Sin "server-only": lo usan también el editor (cliente) y la validación.
 */

export type NavbarId = "masthead" | "couture" | "bold" | "glass" | "crest" | "gremial";
export type FooterId = "grand" | "atelier" | "copper" | "aurora" | "seal" | "gremial";
export type BodyId = HomeTemplateId;

export type TemplateParts = {
  navbar?: NavbarId;
  body?: BodyId;
  footer?: FooterId;
};

type Option<T> = { id: T; label: string; description: string };

export const NAVBARS: Option<NavbarId>[] = [
  { id: "masthead", label: "Cabecera de diario", description: "Fecha y edición arriba, logotipo grande centrado y menú en una franja." },
  { id: "couture", label: "Frontispicio", description: "Nombre espaciado y centrado, filetes finos y menú en dos líneas." },
  { id: "bold", label: "Barra compacta", description: "Una sola línea con logo, menú y utilidades. Máximo espacio para el contenido." },
  { id: "glass", label: "Píldora flotante", description: "Barra redondeada translúcida que flota sobre el contenido." },
  { id: "crest", label: "Escudo institucional", description: "Logo con sello, filete de color y menú clásico." },
  { id: "gremial", label: "Gremial", description: "Logotipo rojo + lema, menú horizontal, buscador y «Mi cuenta»." },
];

export const BODIES: Option<BodyId>[] = [
  { id: "esmeralda", label: "Apertura + «Lo último»", description: "Nota principal grande y columna numerada con lo más reciente." },
  { id: "clasico", label: "Diario", description: "Portada de periódico: apertura, columnas con filetes y breves." },
  { id: "revista", label: "Revista", description: "Carrusel a toda anchura y fotos grandes con zoom." },
  { id: "compacto", label: "Fichas densas", description: "Cuadrícula de fichas: muchas notas visibles de un vistazo." },
  { id: "vanguardia", label: "Bento", description: "Cuadrícula asimétrica de esquinas redondeadas." },
  { id: "gremial", label: "Gremial", description: "Apertura + 3 destacadas, cuadrícula de noticias, accesos por sección, columnistas y boletín." },
];

export const FOOTERS: Option<FooterId>[] = [
  { id: "grand", label: "Pie completo", description: "Columnas de secciones, herramientas y legales." },
  { id: "atelier", label: "Pie editorial", description: "Firma centrada y enlaces discretos." },
  { id: "copper", label: "Pie de secciones", description: "Todas las secciones en rejilla y bloque legal." },
  { id: "aurora", label: "Pie con degradado", description: "Fondo con brillo de color y enlaces en línea." },
  { id: "seal", label: "Pie institucional", description: "Sello, filete de acento y enlaces legales." },
  { id: "gremial", label: "Gremial", description: "Franja verde oscuro continua con el boletín, columnas de secciones y legales." },
];

/** Piezas de cada plantilla prediseñada (lo que se ve si no se personaliza). */
export const PRESET_PARTS: Record<BodyId, Required<TemplateParts>> = {
  esmeralda: { navbar: "masthead", body: "esmeralda", footer: "grand" },
  clasico: { navbar: "masthead", body: "clasico", footer: "grand" },
  revista: { navbar: "couture", body: "revista", footer: "atelier" },
  compacto: { navbar: "bold", body: "compacto", footer: "copper" },
  vanguardia: { navbar: "glass", body: "vanguardia", footer: "aurora" },
  gremial: { navbar: "gremial", body: "gremial", footer: "gremial" },
};

/** Piezas efectivas: las elegidas y, si falta alguna, la de la plantilla base. */
export function resolveParts(templateId: string, parts?: TemplateParts): Required<TemplateParts> {
  const base = PRESET_PARTS[templateId as BodyId] ?? PRESET_PARTS.clasico;
  return {
    navbar: NAVBARS.some((n) => n.id === parts?.navbar) ? parts!.navbar! : base.navbar,
    body: BODIES.some((b) => b.id === parts?.body) ? parts!.body! : base.body,
    footer: FOOTERS.some((f) => f.id === parts?.footer) ? parts!.footer! : base.footer,
  };
}
