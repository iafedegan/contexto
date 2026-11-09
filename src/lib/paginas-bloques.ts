/**
 * Contenido de las páginas que se arman en el panel (Páginas › constructor): filas divididas en columnas de una cuadrícula de 12,
 * y en cada columna una pila de elementos que se arrastran desde la paleta. Sin `server-only`: lo usan el constructor (cliente),
 * la vista pública y las acciones del servidor, que siempre pasan lo que llega por `sanearPagina` antes de guardar.
 */

export type TipoElemento = "titulo" | "parrafo" | "imagen" | "boton" | "lista" | "cita" | "aviso" | "video" | "separador" | "espacio" | "notas";

export type Elemento =
  | { id: string; tipo: "titulo"; texto: string; nivel: 2 | 3; alinear?: Alinear }
  | { id: string; tipo: "parrafo"; texto: string; alinear?: Alinear }
  | { id: string; tipo: "imagen"; url: string; alt: string; pie?: string }
  | { id: string; tipo: "boton"; texto: string; url: string; estilo?: "lleno" | "borde"; alinear?: Alinear }
  | { id: string; tipo: "lista"; items: string[] }
  | { id: string; tipo: "cita"; texto: string; autor?: string }
  | { id: string; tipo: "aviso"; texto: string; tono?: "info" | "alerta" }
  | { id: string; tipo: "video"; url: string }
  | { id: string; tipo: "separador" }
  | { id: string; tipo: "espacio"; alto: number }
  | { id: string; tipo: "notas"; seccion: string; cantidad: number };

export type Alinear = "izquierda" | "centro" | "derecha";

/** Una fila: cuántas columnas ocupa cada celda (suman 12) y los elementos de cada una. */
export type Fila = { id: string; columnas: number[]; celdas: Elemento[][]; fondo?: "ninguno" | "suave" | "acento" };

export type ContenidoPagina = { filas: Fila[] };

/** Divisiones de fila que ofrece el constructor (en columnas de 12). */
export const DIVISIONES: { id: string; columnas: number[]; etiqueta: string }[] = [
  { id: "1", columnas: [12], etiqueta: "Una columna" },
  { id: "2", columnas: [6, 6], etiqueta: "Dos iguales" },
  { id: "3", columnas: [4, 4, 4], etiqueta: "Tres iguales" },
  { id: "4", columnas: [3, 3, 3, 3], etiqueta: "Cuatro iguales" },
  { id: "8-4", columnas: [8, 4], etiqueta: "Ancha y angosta" },
  { id: "4-8", columnas: [4, 8], etiqueta: "Angosta y ancha" },
  { id: "3-6-3", columnas: [3, 6, 3], etiqueta: "Centro ancho" },
];

/** La paleta del constructor, por grupos. */
export const PALETA: { grupo: string; items: { tipo: TipoElemento; etiqueta: string }[] }[] = [
  { grupo: "Texto", items: [{ tipo: "titulo", etiqueta: "Título" }, { tipo: "parrafo", etiqueta: "Párrafo" }, { tipo: "lista", etiqueta: "Lista" }, { tipo: "cita", etiqueta: "Cita" }, { tipo: "aviso", etiqueta: "Aviso" }] },
  { grupo: "Medios", items: [{ tipo: "imagen", etiqueta: "Imagen" }, { tipo: "video", etiqueta: "Video" }] },
  { grupo: "Acciones", items: [{ tipo: "boton", etiqueta: "Botón" }] },
  { grupo: "Noticias", items: [{ tipo: "notas", etiqueta: "Notas de una sección" }] },
  { grupo: "Diseño", items: [{ tipo: "separador", etiqueta: "Separador" }, { tipo: "espacio", etiqueta: "Espacio" }] },
];

export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Un elemento recién soltado, con textos de ejemplo para que se vea algo en el lienzo. */
export function elementoNuevo(tipo: TipoElemento): Elemento {
  const id = nuevoId();
  switch (tipo) {
    case "titulo": return { id, tipo, texto: "Título de la sección", nivel: 2 };
    case "parrafo": return { id, tipo, texto: "Escriba aquí el texto del párrafo." };
    case "imagen": return { id, tipo, url: "", alt: "" };
    case "boton": return { id, tipo, texto: "Más información", url: "/", estilo: "lleno" };
    case "lista": return { id, tipo, items: ["Primer punto", "Segundo punto"] };
    case "cita": return { id, tipo, texto: "Una frase que valga la pena destacar.", autor: "" };
    case "aviso": return { id, tipo, texto: "Aviso importante para el lector.", tono: "info" };
    case "video": return { id, tipo, url: "" };
    case "separador": return { id, tipo };
    case "espacio": return { id, tipo, alto: 32 };
    case "notas": return { id, tipo, seccion: "", cantidad: 4 };
  }
}

export function filaNueva(columnas: number[]): Fila {
  return { id: nuevoId(), columnas: [...columnas], celdas: columnas.map(() => []), fondo: "ninguno" };
}

// --- Saneado: lo que llega del navegador nunca se guarda tal cual. ---

const MAX_FILAS = 60;
const MAX_POR_CELDA = 40;
const txt = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const id = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{1,16}$/.test(v) ? v : nuevoId());
const alinear = (v: unknown): Alinear | undefined => (v === "izquierda" || v === "centro" || v === "derecha" ? v : undefined);
/** Solo rutas del sitio o enlaces http(s): nada de `javascript:`. */
export function urlSegura(v: unknown): string {
  const s = txt(v, 1000).trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function sanearElemento(e: unknown): Elemento | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  const base = { id: id(o.id) };
  switch (o.tipo) {
    case "titulo": return { ...base, tipo: "titulo", texto: txt(o.texto, 300), nivel: o.nivel === 3 ? 3 : 2, alinear: alinear(o.alinear) };
    case "parrafo": return { ...base, tipo: "parrafo", texto: txt(o.texto), alinear: alinear(o.alinear) };
    case "imagen": return { ...base, tipo: "imagen", url: urlSegura(o.url), alt: txt(o.alt, 300), pie: txt(o.pie, 300) || undefined };
    case "boton": return { ...base, tipo: "boton", texto: txt(o.texto, 80), url: urlSegura(o.url), estilo: o.estilo === "borde" ? "borde" : "lleno", alinear: alinear(o.alinear) };
    case "lista": return { ...base, tipo: "lista", items: (Array.isArray(o.items) ? o.items : []).slice(0, 50).map((x) => txt(x, 500)) };
    case "cita": return { ...base, tipo: "cita", texto: txt(o.texto, 1000), autor: txt(o.autor, 120) || undefined };
    case "aviso": return { ...base, tipo: "aviso", texto: txt(o.texto, 1000), tono: o.tono === "alerta" ? "alerta" : "info" };
    case "video": return { ...base, tipo: "video", url: urlSegura(o.url) };
    case "separador": return { ...base, tipo: "separador" };
    case "espacio": return { ...base, tipo: "espacio", alto: Math.min(200, Math.max(8, Number(o.alto) || 32)) };
    case "notas": return { ...base, tipo: "notas", seccion: txt(o.seccion, 100).replace(/[^a-z0-9-]/g, ""), cantidad: Math.min(12, Math.max(1, Number(o.cantidad) || 4)) };
    default: return null;
  }
}

export function sanearPagina(v: unknown): ContenidoPagina {
  const filas = Array.isArray((v as ContenidoPagina | null)?.filas) ? (v as ContenidoPagina).filas : [];
  return {
    filas: filas.slice(0, MAX_FILAS).flatMap((f): Fila[] => {
      if (!f || typeof f !== "object") return [];
      const cols = (Array.isArray(f.columnas) ? f.columnas : []).map((n) => Math.round(Number(n))).filter((n) => n >= 1 && n <= 12);
      if (!cols.length || cols.length > 4 || cols.reduce((a, b) => a + b, 0) !== 12) return [];
      const celdas = cols.map((_, i) => (Array.isArray(f.celdas?.[i]) ? f.celdas[i] : []).slice(0, MAX_POR_CELDA).map(sanearElemento).filter((x): x is Elemento => !!x));
      const fondo = f.fondo === "suave" || f.fondo === "acento" ? f.fondo : "ninguno";
      return [{ id: id(f.id), columnas: cols, celdas, fondo }];
    }),
  };
}

/** Dirección pública válida para una página: minúsculas, números y guiones. */
export function slugPagina(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Si un video es de YouTube o Vimeo, la dirección para incrustarlo; si no, null. */
export function videoIncrustado(url: string): string | null {
  try {
    const u = new URL(url);
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      const v = u.searchParams.get("v") ?? u.pathname.split("/").pop();
      return v ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}` : null;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (/(^|\.)vimeo\.com$/.test(u.hostname)) return `https://player.vimeo.com/video/${encodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "")}`;
  } catch {}
  return null;
}
