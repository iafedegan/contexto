/**
 * Carrusel de notas de la portada: se configura en /panel/portada y viaja dentro del diseño (`HomeLayoutConfig.carrusel`), así que se
 * ve en la vista previa, se publica y se deshace igual que el resto. Vale para todas las plantillas. Todo es puro: la portada le pasa
 * las notas ya consultadas y el cliente solo pinta.
 */
export type CarruselFuente = "portada" | "recientes" | "masleidas" | "seccion" | "propias";
export type CarruselPosicion = "arriba" | "tras-principal" | "abajo";
export type CarruselEstilo = "superpuesta" | "debajo" | "solo-imagen";
export type CarruselAspecto = "21:9" | "16:9" | "3:2" | "4:3" | "1:1";
export type CarruselTransicion = "deslizar" | "fundido";
export type CarruselFlechas = "siempre" | "hover" | "nunca";
export type CarruselIndicador = "puntos" | "barras" | "numero" | "ninguno";

/** Diapositiva propia del editor: una foto subida (o una dirección de imagen), con su texto y su enlace opcionales. */
export type Diapositiva = {
  id: string;
  /** Dirección de la imagen (https o de este mismo sitio). */
  imagen: string;
  /** Texto pequeño sobre el título (como la sección en una nota). */
  etiqueta: string;
  titulo: string;
  texto: string;
  /** A dónde lleva al pulsarla (https o de este sitio); vacío = no es un enlace. */
  enlace: string;
  /** Abrir el enlace en otra pestaña. */
  nuevaPestana: boolean;
};

export const CARRUSEL_MAX_DIAPOSITIVAS = 12;

export type CarruselConfig = {
  /** Diapositivas propias: fotos con su texto y su enlace, además de (o en lugar de) las notas. */
  diapositivas?: Diapositiva[];
  /** Si hay notas y diapositivas propias, cuáles van primero. */
  propiasPosicion?: "antes" | "despues";
  /** Mostrar el carrusel en la portada. */
  activo?: boolean;
  /** Título sobre el carrusel (vacío = sin título). */
  titulo?: string;
  /** Dónde va: bajo el cintillo, tras la nota principal o antes del pie. */
  posicion?: CarruselPosicion;
  /** De dónde salen las notas. */
  fuente?: CarruselFuente;
  /** Slug de la sección cuando `fuente` es `seccion`. */
  seccion?: string;
  /** Cuántas notas (3-20). */
  cantidad?: number;
  /** Omitir las notas sin foto. */
  soloConFoto?: boolean;
  /** Tarjetas visibles a la vez en escritorio, tableta y celular. */
  visiblesEscritorio?: number;
  visiblesTableta?: number;
  visiblesCelular?: number;
  /** Separación entre tarjetas en px (0-40). */
  separacion?: number;
  /** Proporción de la imagen. */
  aspecto?: CarruselAspecto;
  /** Cómo se ve cada tarjeta. */
  estilo?: CarruselEstilo;
  /** Qué datos lleva cada tarjeta. */
  mostrarCategoria?: boolean;
  mostrarResumen?: boolean;
  mostrarAutor?: boolean;
  mostrarFecha?: boolean;
  /** Tamaño del titular de cada tarjeta en px (14-40). */
  tamanoTitular?: number;
  /** Redondeo de las esquinas en px (0-32). */
  redondeo?: number;
  /** Pasa solo. */
  autoplay?: boolean;
  /** Segundos entre una y otra (2-20). */
  intervalo?: number;
  /** Se detiene mientras el puntero o el foco están encima. */
  pausarAlPasar?: boolean;
  /** Al llegar al final vuelve al principio. */
  bucle?: boolean;
  /** Avanza de a una tarjeta o de a una «página» completa. */
  avance?: "una" | "pagina";
  /** Cómo cambia: deslizando o fundiendo (el fundido muestra una sola tarjeta a la vez). */
  transicion?: CarruselTransicion;
  /** Duración de la transición en ms (200-1500). */
  duracion?: number;
  flechas?: CarruselFlechas;
  indicador?: CarruselIndicador;
  /** Barra que se llena hasta el siguiente cambio. */
  barraProgreso?: boolean;
  /** Colores propios (#rrggbb); vacío = los del tema. */
  colorFondo?: string;
  colorTexto?: string;
  colorAcento?: string;
};

export const DEFAULT_CARRUSEL: Required<CarruselConfig> = {
  diapositivas: [],
  propiasPosicion: "antes",
  activo: false,
  titulo: "Destacados",
  posicion: "arriba",
  fuente: "portada",
  seccion: "",
  cantidad: 8,
  soloConFoto: true,
  visiblesEscritorio: 3,
  visiblesTableta: 2,
  visiblesCelular: 1,
  separacion: 16,
  aspecto: "16:9",
  estilo: "superpuesta",
  mostrarCategoria: true,
  mostrarResumen: false,
  mostrarAutor: false,
  mostrarFecha: true,
  tamanoTitular: 20,
  redondeo: 12,
  autoplay: true,
  intervalo: 6,
  pausarAlPasar: true,
  bucle: true,
  avance: "una",
  transicion: "deslizar",
  duracion: 600,
  flechas: "hover",
  indicador: "puntos",
  barraProgreso: false,
  colorFondo: "",
  colorTexto: "",
  colorAcento: "",
};

const entero = (v: unknown, min: number, max: number, def: number) => {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
const uno = <T extends string>(v: unknown, opciones: readonly T[], def: T): T => opciones.find((o) => o === v) ?? def;
// Dirección permitida en una diapositiva: https o ruta de este mismo sitio (nunca `javascript:` ni `data:`).
const direccion = (v: unknown) => (typeof v === "string" && v.length <= 600 && /^(https:\/\/|\/(?!\/))[^\s"'<>]*$/.test(v.trim()) ? v.trim() : "");
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
// Valida las diapositivas propias: solo las que tienen imagen.
function sanitizeDiapositivas(input: unknown): Diapositiva[] {
  if (!Array.isArray(input)) return [];
  const vistos = new Set<string>();
  const out: Diapositiva[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" && /^[a-z0-9-]{3,40}$/.test(r.id) ? r.id : null;
    const imagen = direccion(r.imagen);
    if (!id || !imagen || vistos.has(id)) continue;
    vistos.add(id);
    out.push({ id, imagen, etiqueta: texto(r.etiqueta, 40), titulo: texto(r.titulo, 120), texto: texto(r.texto, 300), enlace: direccion(r.enlace), nuevaPestana: r.nuevaPestana === true });
    if (out.length >= CARRUSEL_MAX_DIAPOSITIVAS) break;
  }
  return out;
}
const color = (v: unknown) => (typeof v === "string" && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(v) ? v : "");

/** Valida lo que llegue (acaba en una página pública) y rellena lo que falte con los valores por defecto. */
export function sanitizeCarrusel(input: unknown): Required<CarruselConfig> {
  const c = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_CARRUSEL;
  const fuente = uno(c.fuente, ["portada", "recientes", "masleidas", "seccion", "propias"] as const, d.fuente);
  return {
    diapositivas: sanitizeDiapositivas(c.diapositivas),
    propiasPosicion: uno(c.propiasPosicion, ["antes", "despues"] as const, d.propiasPosicion),
    activo: bool(c.activo, d.activo),
    titulo: typeof c.titulo === "string" ? c.titulo.replace(/\s+/g, " ").trim().slice(0, 60) : d.titulo,
    posicion: uno(c.posicion, ["arriba", "tras-principal", "abajo"] as const, d.posicion),
    fuente,
    seccion: fuente === "seccion" && typeof c.seccion === "string" && /^[a-z0-9-]{1,80}$/.test(c.seccion) ? c.seccion : "",
    cantidad: entero(c.cantidad, 3, 20, d.cantidad),
    soloConFoto: bool(c.soloConFoto, d.soloConFoto),
    visiblesEscritorio: entero(c.visiblesEscritorio, 1, 5, d.visiblesEscritorio),
    visiblesTableta: entero(c.visiblesTableta, 1, 3, d.visiblesTableta),
    visiblesCelular: entero(c.visiblesCelular, 1, 2, d.visiblesCelular),
    separacion: entero(c.separacion, 0, 40, d.separacion),
    aspecto: uno(c.aspecto, ["21:9", "16:9", "3:2", "4:3", "1:1"] as const, d.aspecto),
    estilo: uno(c.estilo, ["superpuesta", "debajo", "solo-imagen"] as const, d.estilo),
    mostrarCategoria: bool(c.mostrarCategoria, d.mostrarCategoria),
    mostrarResumen: bool(c.mostrarResumen, d.mostrarResumen),
    mostrarAutor: bool(c.mostrarAutor, d.mostrarAutor),
    mostrarFecha: bool(c.mostrarFecha, d.mostrarFecha),
    tamanoTitular: entero(c.tamanoTitular, 14, 40, d.tamanoTitular),
    redondeo: entero(c.redondeo, 0, 32, d.redondeo),
    autoplay: bool(c.autoplay, d.autoplay),
    intervalo: entero(c.intervalo, 2, 20, d.intervalo),
    pausarAlPasar: bool(c.pausarAlPasar, d.pausarAlPasar),
    bucle: bool(c.bucle, d.bucle),
    avance: uno(c.avance, ["una", "pagina"] as const, d.avance),
    transicion: uno(c.transicion, ["deslizar", "fundido"] as const, d.transicion),
    duracion: entero(c.duracion, 200, 1500, d.duracion),
    flechas: uno(c.flechas, ["siempre", "hover", "nunca"] as const, d.flechas),
    indicador: uno(c.indicador, ["puntos", "barras", "numero", "ninguno"] as const, d.indicador),
    barraProgreso: bool(c.barraProgreso, d.barraProgreso),
    colorFondo: color(c.colorFondo),
    colorTexto: color(c.colorTexto),
    colorAcento: color(c.colorAcento),
  };
}

/** Una línea con lo que lleva el carrusel, para verla aunque su bloque del panel esté cerrado. */
export function resumenCarrusel(c: CarruselConfig | undefined): string {
  const v = sanitizeCarrusel(c);
  const fuentes: Record<CarruselFuente, string> = { portada: "como la portada", recientes: "las más recientes", masleidas: "las más leídas", seccion: "de una sección", propias: "solo diapositivas propias" };
  const propias = v.diapositivas.length ? ` + ${v.diapositivas.length} propias` : "";
  return `${v.cantidad} notas ${fuentes[v.fuente]}${propias} · ${v.visiblesEscritorio} a la vez${v.autoplay ? ` · cada ${v.intervalo} s` : ""}`;
}
