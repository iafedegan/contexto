/**
 * Contenido de las páginas que se arman en el panel (Páginas › constructor): filas divididas en columnas de una cuadrícula de 12,
 * y en cada columna una pila de elementos que se arrastran desde la paleta. Sin `server-only`: lo usan el constructor (cliente),
 * la vista pública y las acciones del servidor, que siempre pasan lo que llega por `sanearPagina` antes de guardar.
 *
 * Hay dos clases de elementos: los básicos (título, párrafo, imagen…), con campos propios, y los «bloques» (carrusel, tarjetas,
 * acordeón…), descritos por un esquema (`ESQUEMAS`): sus campos (`p`) y, si tienen, su lista de elementos repetidos (`items`).
 * El mismo esquema sanea lo que llega, arma el panel de propiedades y da los valores de ejemplo.
 */

export type TipoBasico = "titulo" | "parrafo" | "imagen" | "boton" | "lista" | "cita" | "aviso" | "video" | "separador" | "espacio" | "notas";
export type TipoBloque =
  | "heroe" | "carrusel" | "tarjetas" | "galeria" | "acordeon" | "pestanas" | "cifras" | "caracteristicas" | "testimonios" | "linea"
  | "pasos" | "equipo" | "logos" | "tabla" | "llamado" | "destacado" | "audio" | "mapa" | "contacto" | "cuenta" | "redes" | "descarga"
  | "boletin" | "comparacion" | "precios";
export type TipoElemento = TipoBasico | TipoBloque;

export type Alinear = "izquierda" | "centro" | "derecha";
export type EstiloNotas = "lista" | "tarjetas" | "carrusel" | "portada";

/** Valores de un bloque: todo texto (los números se guardan como texto y se leen con `num`). */
export type Valores = Record<string, string>;

export type Elemento =
  | { id: string; tipo: "titulo"; texto: string; nivel: 2 | 3; alinear?: Alinear; antetitulo?: string }
  | { id: string; tipo: "parrafo"; texto: string; alinear?: Alinear }
  | { id: string; tipo: "imagen"; url: string; alt: string; pie?: string; url_enlace?: string; redondeo?: "no" | "si" | "circulo" }
  | { id: string; tipo: "boton"; texto: string; url: string; estilo?: "lleno" | "borde" | "texto"; alinear?: Alinear; tamano?: "normal" | "grande" }
  | { id: string; tipo: "lista"; items: string[]; numerada?: boolean }
  | { id: string; tipo: "cita"; texto: string; autor?: string }
  | { id: string; tipo: "aviso"; texto: string; tono?: "info" | "alerta" | "exito" }
  | { id: string; tipo: "video"; url: string }
  | { id: string; tipo: "separador"; estilo?: "linea" | "puntos" | "ornamento" }
  | { id: string; tipo: "espacio"; alto: number }
  | { id: string; tipo: "notas"; seccion: string; cantidad: number; estilo?: EstiloNotas; columnas?: number }
  | { id: string; tipo: TipoBloque; p: Valores; items: Valores[] };

export type ElementoBloque = Extract<Elemento, { p: Valores }>;

export function esBloque(e: Elemento): e is ElementoBloque {
  return "p" in e && typeof (e as ElementoBloque).p === "object";
}

export type FondoFila = "ninguno" | "suave" | "acento" | "oscuro" | "degradado" | "imagen";
/** Una fila: cuántas columnas ocupa cada celda (suman 12) y los elementos de cada una. */
export type Fila = {
  id: string;
  columnas: number[];
  celdas: Elemento[][];
  fondo?: FondoFila;
  fondoImagen?: string;
  espaciado?: "compacto" | "normal" | "amplio";
  vertical?: "arriba" | "centro";
};

/**
 * `ocultas`: en la portada de una sección, las notas (por su slug) que el editor quitó de la lista de notas de esa sección. La nota sigue
 * publicada; solo deja de salir en la lista de la sección mientras la portada esté publicada.
 */
export type ContenidoPagina = { filas: Fila[]; ocultas?: string[] };

/** Divisiones de fila que ofrece el constructor (en columnas de 12). */
export const DIVISIONES: { id: string; columnas: number[]; etiqueta: string }[] = [
  { id: "1", columnas: [12], etiqueta: "Una columna" },
  { id: "2", columnas: [6, 6], etiqueta: "Dos iguales" },
  { id: "3", columnas: [4, 4, 4], etiqueta: "Tres iguales" },
  { id: "4", columnas: [3, 3, 3, 3], etiqueta: "Cuatro iguales" },
  { id: "8-4", columnas: [8, 4], etiqueta: "Ancha y angosta" },
  { id: "4-8", columnas: [4, 8], etiqueta: "Angosta y ancha" },
  { id: "9-3", columnas: [9, 3], etiqueta: "Muy ancha y lateral" },
  { id: "3-9", columnas: [3, 9], etiqueta: "Lateral y muy ancha" },
  { id: "7-5", columnas: [7, 5], etiqueta: "Casi mitades (izq.)" },
  { id: "5-7", columnas: [5, 7], etiqueta: "Casi mitades (der.)" },
  { id: "3-6-3", columnas: [3, 6, 3], etiqueta: "Centro ancho" },
  { id: "2-8-2", columnas: [2, 8, 2], etiqueta: "Centro de lectura" },
  { id: "6-3-3", columnas: [6, 3, 3], etiqueta: "Mitad y dos" },
  { id: "3-3-6", columnas: [3, 3, 6], etiqueta: "Dos y mitad" },
];

// --- Esquema de los bloques ---

export type Campo =
  | { k: string; etiqueta: string; tipo: "texto" | "area" | "url" | "imagen" | "fecha" | "color"; ayuda?: string; max?: number }
  | { k: string; etiqueta: string; tipo: "numero"; min: number; max: number; paso?: number; ayuda?: string }
  | { k: string; etiqueta: string; tipo: "opcion"; opciones: [string, string][]; ayuda?: string };

export type Esquema = {
  campos: Campo[];
  /** Valores con que nace el bloque. */
  inicial: Valores;
  items?: { nombre: string; campos: Campo[]; max: number; inicial: Valores[]; nuevo: Valores };
};

const SI_NO: [string, string][] = [["si", "Sí"], ["no", "No"]];
const COLS = (de: number, a: number): [string, string][] => Array.from({ length: a - de + 1 }, (_, i) => [String(de + i), `${de + i} por fila`]);
const PROPORCION: [string, string][] = [["16/9", "Panorámica 16:9"], ["21/9", "Cine 21:9"], ["4/3", "Clásica 4:3"], ["1/1", "Cuadrada"], ["3/4", "Vertical 3:4"]];
const ALINEAR_OP: [string, string][] = [["izquierda", "Izquierda"], ["centro", "Centro"], ["derecha", "Derecha"]];

/** Íconos que se pueden elegir en «Características» (nombres de lucide-react; el dibujo está en components/pagina-iconos). */
export const ICONOS_BLOQUE: [string, string][] = [
  ["Beef", "Ganado"], ["Milk", "Leche"], ["Wheat", "Cultivo"], ["Tractor", "Tractor"], ["Leaf", "Hoja"], ["Sprout", "Brote"], ["Trees", "Bosque"],
  ["Mountain", "Montaña"], ["Droplets", "Agua"], ["Sun", "Sol"], ["CloudRain", "Lluvia"], ["Truck", "Transporte"], ["ShieldCheck", "Seguridad"],
  ["HeartPulse", "Salud"], ["Stethoscope", "Veterinaria"], ["Syringe", "Vacuna"], ["ChartColumn", "Gráfica"], ["TrendingUp", "Crecimiento"],
  ["Coins", "Dinero"], ["Landmark", "Institución"], ["Scale", "Ley"], ["Handshake", "Acuerdo"], ["Users", "Comunidad"], ["GraduationCap", "Formación"],
  ["BookOpen", "Lectura"], ["Newspaper", "Noticias"], ["Mic", "Radio"], ["Video", "Video"], ["Calendar", "Fecha"], ["Clock", "Hora"],
  ["MapPin", "Lugar"], ["Phone", "Teléfono"], ["Mail", "Correo"], ["Globe", "Mundo"], ["Award", "Premio"], ["Star", "Estrella"],
  ["Check", "Listo"], ["Lightbulb", "Idea"], ["Target", "Meta"], ["Zap", "Energía"], ["Sparkles", "Novedad"], ["MessageCircle", "Mensaje"],
];

export const REDES: [string, string][] = [
  ["facebook", "Facebook"], ["instagram", "Instagram"], ["x", "X (Twitter)"], ["youtube", "YouTube"], ["linkedin", "LinkedIn"], ["whatsapp", "WhatsApp"],
  ["tiktok", "TikTok"], ["web", "Sitio web"], ["correo", "Correo"],
];

const IMG = "";

export const ESQUEMAS: Record<TipoBloque, Esquema> = {
  heroe: {
    campos: [
      { k: "antetitulo", etiqueta: "Antetítulo", tipo: "texto" },
      { k: "titulo", etiqueta: "Título", tipo: "texto" },
      { k: "texto", etiqueta: "Texto", tipo: "area" },
      { k: "imagen", etiqueta: "Imagen de fondo", tipo: "imagen" },
      { k: "boton", etiqueta: "Botón principal", tipo: "texto" },
      { k: "url", etiqueta: "Enlace del botón principal", tipo: "url" },
      { k: "boton2", etiqueta: "Botón secundario", tipo: "texto" },
      { k: "url2", etiqueta: "Enlace del botón secundario", tipo: "url" },
      { k: "alto", etiqueta: "Alto", tipo: "opcion", opciones: [["medio", "Medio"], ["alto", "Alto"], ["pantalla", "Toda la pantalla"]] },
      { k: "alinear", etiqueta: "Texto", tipo: "opcion", opciones: [["izquierda", "A la izquierda"], ["centro", "Centrado"]] },
      { k: "oscurecer", etiqueta: "Oscurecer la imagen (%)", tipo: "numero", min: 0, max: 90, paso: 5 },
    ],
    inicial: { antetitulo: "CONtexto Ganadero Media", titulo: "Un título que invite a quedarse", texto: "Una frase corta que explique de qué trata esta página.", imagen: IMG, boton: "Conocer más", url: "/", boton2: "", url2: "", alto: "alto", alinear: "izquierda", oscurecer: "45" },
  },
  carrusel: {
    campos: [
      { k: "proporcion", etiqueta: "Forma", tipo: "opcion", opciones: PROPORCION },
      { k: "auto", etiqueta: "Pasa solo", tipo: "opcion", opciones: SI_NO },
      { k: "segundos", etiqueta: "Segundos por diapositiva", tipo: "numero", min: 2, max: 20 },
      { k: "texto", etiqueta: "Texto sobre la imagen", tipo: "opcion", opciones: [["abajo", "Abajo"], ["centro", "Al centro"], ["no", "Sin texto"]] },
    ],
    inicial: { proporcion: "16/9", auto: "si", segundos: "6", texto: "abajo" },
    items: {
      nombre: "Diapositiva",
      max: 20,
      campos: [
        { k: "imagen", etiqueta: "Imagen", tipo: "imagen" },
        { k: "titulo", etiqueta: "Título", tipo: "texto" },
        { k: "texto", etiqueta: "Texto", tipo: "area" },
        { k: "url", etiqueta: "Enlace (opcional)", tipo: "url" },
      ],
      inicial: [
        { imagen: IMG, titulo: "Primera diapositiva", texto: "Elija una imagen de la biblioteca.", url: "" },
        { imagen: IMG, titulo: "Segunda diapositiva", texto: "Se pasan con las flechas o solas.", url: "" },
        { imagen: IMG, titulo: "Tercera diapositiva", texto: "", url: "" },
      ],
      nuevo: { imagen: IMG, titulo: "Diapositiva nueva", texto: "", url: "" },
    },
  },
  tarjetas: {
    campos: [
      { k: "columnas", etiqueta: "Columnas", tipo: "opcion", opciones: COLS(1, 4) },
      { k: "estilo", etiqueta: "Estilo", tipo: "opcion", opciones: [["sombra", "Con sombra"], ["borde", "Con borde"], ["plana", "Plana"], ["superpuesta", "Texto sobre la imagen"], ["horizontal", "Imagen al lado"]] },
      { k: "proporcion", etiqueta: "Forma de la imagen", tipo: "opcion", opciones: PROPORCION },
      { k: "carrusel", etiqueta: "Mostrar como carrusel", tipo: "opcion", opciones: SI_NO },
    ],
    inicial: { columnas: "3", estilo: "sombra", proporcion: "16/9", carrusel: "no" },
    items: {
      nombre: "Tarjeta",
      max: 24,
      campos: [
        { k: "imagen", etiqueta: "Imagen", tipo: "imagen" },
        { k: "etiqueta", etiqueta: "Etiqueta", tipo: "texto" },
        { k: "titulo", etiqueta: "Título", tipo: "texto" },
        { k: "texto", etiqueta: "Texto", tipo: "area" },
        { k: "boton", etiqueta: "Texto del enlace", tipo: "texto" },
        { k: "url", etiqueta: "Enlace", tipo: "url" },
      ],
      inicial: [
        { imagen: IMG, etiqueta: "Ganadería", titulo: "Primera tarjeta", texto: "Un resumen corto de lo que encontrará.", boton: "Leer más", url: "/" },
        { imagen: IMG, etiqueta: "Mercados", titulo: "Segunda tarjeta", texto: "Cada tarjeta puede llevar imagen, texto y enlace.", boton: "Leer más", url: "/" },
        { imagen: IMG, etiqueta: "Regiones", titulo: "Tercera tarjeta", texto: "Agregue, quite u ordene las que quiera.", boton: "Leer más", url: "/" },
      ],
      nuevo: { imagen: IMG, etiqueta: "", titulo: "Tarjeta nueva", texto: "", boton: "", url: "" },
    },
  },
  galeria: {
    campos: [
      { k: "columnas", etiqueta: "Columnas", tipo: "opcion", opciones: COLS(2, 5) },
      { k: "forma", etiqueta: "Forma", tipo: "opcion", opciones: [["cuadrada", "Cuadradas"], ["libre", "Mosaico (forma libre)"], ["panoramica", "Panorámicas"]] },
    ],
    inicial: { columnas: "3", forma: "cuadrada" },
    items: {
      nombre: "Foto",
      max: 60,
      campos: [
        { k: "imagen", etiqueta: "Imagen", tipo: "imagen" },
        { k: "alt", etiqueta: "Texto alternativo", tipo: "texto" },
        { k: "pie", etiqueta: "Pie de foto", tipo: "texto" },
      ],
      inicial: [{ imagen: IMG, alt: "", pie: "" }, { imagen: IMG, alt: "", pie: "" }, { imagen: IMG, alt: "", pie: "" }],
      nuevo: { imagen: IMG, alt: "", pie: "" },
    },
  },
  acordeon: {
    campos: [{ k: "primera", etiqueta: "La primera abierta", tipo: "opcion", opciones: SI_NO }],
    inicial: { primera: "si" },
    items: {
      nombre: "Pregunta",
      max: 40,
      campos: [
        { k: "titulo", etiqueta: "Pregunta o título", tipo: "texto" },
        { k: "texto", etiqueta: "Respuesta", tipo: "area" },
      ],
      inicial: [
        { titulo: "¿Primera pregunta frecuente?", texto: "La respuesta aparece al pulsar la pregunta." },
        { titulo: "¿Segunda pregunta?", texto: "Puede agregar todas las que necesite." },
      ],
      nuevo: { titulo: "Pregunta nueva", texto: "" },
    },
  },
  pestanas: {
    campos: [{ k: "estilo", etiqueta: "Estilo", tipo: "opcion", opciones: [["subrayado", "Subrayadas"], ["botones", "Botones"]] }],
    inicial: { estilo: "subrayado" },
    items: {
      nombre: "Pestaña",
      max: 10,
      campos: [
        { k: "titulo", etiqueta: "Nombre de la pestaña", tipo: "texto" },
        { k: "texto", etiqueta: "Contenido", tipo: "area" },
        { k: "imagen", etiqueta: "Imagen (opcional)", tipo: "imagen" },
      ],
      inicial: [
        { titulo: "Primera", texto: "Contenido de la primera pestaña.", imagen: IMG },
        { titulo: "Segunda", texto: "Contenido de la segunda pestaña.", imagen: IMG },
      ],
      nuevo: { titulo: "Pestaña", texto: "", imagen: IMG },
    },
  },
  cifras: {
    campos: [
      { k: "columnas", etiqueta: "Columnas", tipo: "opcion", opciones: COLS(2, 4) },
      { k: "estilo", etiqueta: "Estilo", tipo: "opcion", opciones: [["simple", "Simple"], ["tarjeta", "En tarjetas"], ["acento", "Color de acento"]] },
      { k: "animar", etiqueta: "Contar al aparecer", tipo: "opcion", opciones: SI_NO },
    ],
    inicial: { columnas: "3", estilo: "simple", animar: "si" },
    items: {
      nombre: "Cifra",
      max: 8,
      campos: [
        { k: "prefijo", etiqueta: "Antes del número", tipo: "texto", ayuda: "Ej.: $" },
        { k: "valor", etiqueta: "Número", tipo: "texto", ayuda: "Ej.: 29.300.000" },
        { k: "sufijo", etiqueta: "Después del número", tipo: "texto", ayuda: "Ej.: % o cabezas" },
        { k: "etiqueta", etiqueta: "Qué mide", tipo: "texto" },
      ],
      inicial: [
        { prefijo: "", valor: "29.300.000", sufijo: "", etiqueta: "Cabezas de ganado" },
        { prefijo: "", valor: "600.000", sufijo: "", etiqueta: "Ganaderos" },
        { prefijo: "", valor: "32", sufijo: "", etiqueta: "Departamentos" },
      ],
      nuevo: { prefijo: "", valor: "100", sufijo: "", etiqueta: "Nueva cifra" },
    },
  },
  caracteristicas: {
    campos: [
      { k: "columnas", etiqueta: "Columnas", tipo: "opcion", opciones: COLS(1, 4) },
      { k: "estilo", etiqueta: "Estilo", tipo: "opcion", opciones: [["arriba", "Ícono arriba"], ["lado", "Ícono al lado"], ["tarjeta", "En tarjetas"]] },
    ],
    inicial: { columnas: "3", estilo: "arriba" },
    items: {
      nombre: "Característica",
      max: 16,
      campos: [
        { k: "icono", etiqueta: "Ícono", tipo: "opcion", opciones: ICONOS_BLOQUE },
        { k: "titulo", etiqueta: "Título", tipo: "texto" },
        { k: "texto", etiqueta: "Texto", tipo: "area" },
        { k: "url", etiqueta: "Enlace (opcional)", tipo: "url" },
      ],
      inicial: [
        { icono: "Beef", titulo: "Ganadería", texto: "Información para el productor.", url: "" },
        { icono: "ChartColumn", titulo: "Mercados", texto: "Precios y tendencias.", url: "" },
        { icono: "ShieldCheck", titulo: "Sanidad", texto: "Vacunación y bioseguridad.", url: "" },
      ],
      nuevo: { icono: "Star", titulo: "Nueva", texto: "", url: "" },
    },
  },
  testimonios: {
    campos: [{ k: "estilo", etiqueta: "Estilo", tipo: "opcion", opciones: [["tarjetas", "Tarjetas"], ["carrusel", "Carrusel"], ["grande", "Una cita grande"]] }],
    inicial: { estilo: "tarjetas" },
    items: {
      nombre: "Testimonio",
      max: 16,
      campos: [
        { k: "texto", etiqueta: "Lo que dijo", tipo: "area" },
        { k: "nombre", etiqueta: "Nombre", tipo: "texto" },
        { k: "cargo", etiqueta: "Cargo o lugar", tipo: "texto" },
        { k: "foto", etiqueta: "Foto", tipo: "imagen" },
      ],
      inicial: [
        { texto: "Un testimonio de alguien que conoce el tema.", nombre: "Nombre Apellido", cargo: "Ganadero, Córdoba", foto: IMG },
        { texto: "Otro testimonio que da confianza al lector.", nombre: "Nombre Apellido", cargo: "Veterinaria, Meta", foto: IMG },
      ],
      nuevo: { texto: "", nombre: "", cargo: "", foto: IMG },
    },
  },
  linea: {
    campos: [{ k: "estilo", etiqueta: "Estilo", tipo: "opcion", opciones: [["vertical", "Vertical"], ["alterna", "Alternada (a ambos lados)"]] }],
    inicial: { estilo: "vertical" },
    items: {
      nombre: "Hito",
      max: 40,
      campos: [
        { k: "fecha", etiqueta: "Fecha o año", tipo: "texto" },
        { k: "titulo", etiqueta: "Título", tipo: "texto" },
        { k: "texto", etiqueta: "Texto", tipo: "area" },
        { k: "imagen", etiqueta: "Imagen (opcional)", tipo: "imagen" },
      ],
      inicial: [
        { fecha: "1963", titulo: "Primer hito", texto: "Lo que pasó.", imagen: IMG },
        { fecha: "1990", titulo: "Segundo hito", texto: "Lo que pasó después.", imagen: IMG },
        { fecha: "Hoy", titulo: "Tercer hito", texto: "Dónde estamos.", imagen: IMG },
      ],
      nuevo: { fecha: "", titulo: "Hito nuevo", texto: "", imagen: IMG },
    },
  },
  pasos: {
    campos: [{ k: "direccion", etiqueta: "Dirección", tipo: "opcion", opciones: [["horizontal", "En fila"], ["vertical", "En lista"]] }],
    inicial: { direccion: "horizontal" },
    items: {
      nombre: "Paso",
      max: 12,
      campos: [
        { k: "titulo", etiqueta: "Título", tipo: "texto" },
        { k: "texto", etiqueta: "Texto", tipo: "area" },
      ],
      inicial: [
        { titulo: "Primer paso", texto: "Qué hacer primero." },
        { titulo: "Segundo paso", texto: "Qué hacer después." },
        { titulo: "Tercer paso", texto: "Cómo terminar." },
      ],
      nuevo: { titulo: "Paso nuevo", texto: "" },
    },
  },
  equipo: {
    campos: [
      { k: "columnas", etiqueta: "Columnas", tipo: "opcion", opciones: COLS(2, 5) },
      { k: "forma", etiqueta: "Foto", tipo: "opcion", opciones: [["circulo", "Redonda"], ["cuadrada", "Cuadrada"]] },
    ],
    inicial: { columnas: "4", forma: "circulo" },
    items: {
      nombre: "Persona",
      max: 40,
      campos: [
        { k: "foto", etiqueta: "Foto", tipo: "imagen" },
        { k: "nombre", etiqueta: "Nombre", tipo: "texto" },
        { k: "cargo", etiqueta: "Cargo", tipo: "texto" },
        { k: "texto", etiqueta: "Reseña corta", tipo: "area" },
        { k: "url", etiqueta: "Enlace (perfil, correo…)", tipo: "url" },
      ],
      inicial: [
        { foto: IMG, nombre: "Nombre Apellido", cargo: "Director(a)", texto: "", url: "" },
        { foto: IMG, nombre: "Nombre Apellido", cargo: "Editor(a)", texto: "", url: "" },
        { foto: IMG, nombre: "Nombre Apellido", cargo: "Periodista", texto: "", url: "" },
        { foto: IMG, nombre: "Nombre Apellido", cargo: "Diseñador(a)", texto: "", url: "" },
      ],
      nuevo: { foto: IMG, nombre: "", cargo: "", texto: "", url: "" },
    },
  },
  logos: {
    campos: [
      { k: "titulo", etiqueta: "Título encima", tipo: "texto" },
      { k: "gris", etiqueta: "En gris (color al pasar)", tipo: "opcion", opciones: SI_NO },
      { k: "movimiento", etiqueta: "En movimiento continuo", tipo: "opcion", opciones: SI_NO },
    ],
    inicial: { titulo: "Nos acompañan", gris: "si", movimiento: "no" },
    items: {
      nombre: "Logo",
      max: 40,
      campos: [
        { k: "imagen", etiqueta: "Logo", tipo: "imagen" },
        { k: "nombre", etiqueta: "Nombre", tipo: "texto" },
        { k: "url", etiqueta: "Enlace", tipo: "url" },
      ],
      inicial: [{ imagen: IMG, nombre: "Aliado 1", url: "" }, { imagen: IMG, nombre: "Aliado 2", url: "" }, { imagen: IMG, nombre: "Aliado 3", url: "" }, { imagen: IMG, nombre: "Aliado 4", url: "" }],
      nuevo: { imagen: IMG, nombre: "", url: "" },
    },
  },
  tabla: {
    campos: [
      { k: "datos", etiqueta: "Datos: una fila por línea, celdas separadas por |", tipo: "area", max: 20000 },
      { k: "encabezado", etiqueta: "La primera fila es el encabezado", tipo: "opcion", opciones: SI_NO },
      { k: "rayada", etiqueta: "Filas de colores alternos", tipo: "opcion", opciones: SI_NO },
      { k: "pie", etiqueta: "Fuente o nota", tipo: "texto" },
    ],
    inicial: { datos: "Producto | Precio | Variación\nNovillo gordo | $9.800 / kg | +1,2 %\nVaca gorda | $8.100 / kg | -0,4 %\nLeche cruda | $2.050 / litro | 0,0 %", encabezado: "si", rayada: "si", pie: "Fuente: …" },
  },
  llamado: {
    campos: [
      { k: "titulo", etiqueta: "Título", tipo: "texto" },
      { k: "texto", etiqueta: "Texto", tipo: "area" },
      { k: "boton", etiqueta: "Botón", tipo: "texto" },
      { k: "url", etiqueta: "Enlace", tipo: "url" },
      { k: "estilo", etiqueta: "Fondo", tipo: "opcion", opciones: [["acento", "Color de acento"], ["oscuro", "Oscuro"], ["suave", "Suave"], ["imagen", "Imagen"]] },
      { k: "imagen", etiqueta: "Imagen de fondo (si eligió «Imagen»)", tipo: "imagen" },
      { k: "alinear", etiqueta: "Disposición", tipo: "opcion", opciones: [["lado", "Texto y botón al lado"], ["centro", "Todo centrado"]] },
    ],
    inicial: { titulo: "Suscríbase al boletín", texto: "Las noticias del campo, cada mañana en su correo.", boton: "Quiero suscribirme", url: "/boletin", estilo: "acento", imagen: IMG, alinear: "lado" },
  },
  destacado: {
    campos: [
      { k: "texto", etiqueta: "Texto", tipo: "area" },
      { k: "tamano", etiqueta: "Tamaño", tipo: "opcion", opciones: [["grande", "Grande"], ["enorme", "Enorme"]] },
      { k: "color", etiqueta: "Color", tipo: "opcion", opciones: [["normal", "Normal"], ["acento", "Acento"], ["oro", "Dorado"]] },
      { k: "alinear", etiqueta: "Alineación", tipo: "opcion", opciones: ALINEAR_OP },
    ],
    inicial: { texto: "Una frase grande que marque el tono de la página.", tamano: "grande", color: "normal", alinear: "izquierda" },
  },
  audio: {
    campos: [
      { k: "titulo", etiqueta: "Título", tipo: "texto" },
      { k: "url", etiqueta: "Enlace del audio (MP3) o de SoundCloud", tipo: "url" },
      { k: "texto", etiqueta: "Descripción", tipo: "area" },
    ],
    inicial: { titulo: "Escuche el episodio", url: "", texto: "" },
  },
  mapa: {
    campos: [
      { k: "lugar", etiqueta: "Lugar o dirección", tipo: "texto", ayuda: "Ej.: Calle 37 # 14-31, Bogotá" },
      { k: "alto", etiqueta: "Alto (px)", tipo: "numero", min: 200, max: 700, paso: 20 },
      { k: "zoom", etiqueta: "Acercamiento", tipo: "numero", min: 3, max: 19 },
    ],
    inicial: { lugar: "FEDEGÁN, Bogotá", alto: "380", zoom: "15" },
  },
  contacto: {
    campos: [
      { k: "titulo", etiqueta: "Título", tipo: "texto" },
      { k: "telefono", etiqueta: "Teléfono", tipo: "texto" },
      { k: "whatsapp", etiqueta: "WhatsApp (número con indicativo)", tipo: "texto", ayuda: "Ej.: 573001234567" },
      { k: "correo", etiqueta: "Correo", tipo: "texto" },
      { k: "direccion", etiqueta: "Dirección", tipo: "texto" },
      { k: "horario", etiqueta: "Horario", tipo: "texto" },
      { k: "estilo", etiqueta: "Estilo", tipo: "opcion", opciones: [["lista", "Lista"], ["tarjetas", "Tarjetas"]] },
    ],
    inicial: { titulo: "Contáctenos", telefono: "+57 601 578 2020", whatsapp: "", correo: "contacto@contextoganadero.com", direccion: "Bogotá, Colombia", horario: "Lunes a viernes, 8 a. m. – 5 p. m.", estilo: "lista" },
  },
  cuenta: {
    campos: [
      { k: "titulo", etiqueta: "Título", tipo: "texto" },
      { k: "fecha", etiqueta: "Fecha y hora", tipo: "fecha" },
      { k: "fin", etiqueta: "Texto al llegar la hora", tipo: "texto" },
      { k: "boton", etiqueta: "Botón (opcional)", tipo: "texto" },
      { k: "url", etiqueta: "Enlace del botón", tipo: "url" },
    ],
    inicial: { titulo: "Faltan", fecha: "", fin: "¡Ya empezó!", boton: "", url: "" },
  },
  redes: {
    campos: [
      { k: "titulo", etiqueta: "Título", tipo: "texto" },
      { k: "estilo", etiqueta: "Estilo", tipo: "opcion", opciones: [["iconos", "Solo íconos"], ["botones", "Botones con nombre"]] },
      { k: "alinear", etiqueta: "Alineación", tipo: "opcion", opciones: ALINEAR_OP },
    ],
    inicial: { titulo: "Síganos", estilo: "iconos", alinear: "izquierda" },
    items: {
      nombre: "Red",
      max: 12,
      campos: [
        { k: "red", etiqueta: "Red", tipo: "opcion", opciones: REDES },
        { k: "url", etiqueta: "Enlace", tipo: "url" },
      ],
      inicial: [
        { red: "facebook", url: "https://www.facebook.com/" },
        { red: "instagram", url: "https://www.instagram.com/" },
        { red: "x", url: "https://x.com/" },
        { red: "youtube", url: "https://www.youtube.com/" },
      ],
      nuevo: { red: "web", url: "" },
    },
  },
  descarga: {
    campos: [
      { k: "titulo", etiqueta: "Título", tipo: "texto" },
      { k: "texto", etiqueta: "Descripción", tipo: "area" },
      { k: "url", etiqueta: "Enlace del archivo", tipo: "url" },
      { k: "detalle", etiqueta: "Detalle", tipo: "texto", ayuda: "Ej.: PDF · 2 MB" },
      { k: "boton", etiqueta: "Botón", tipo: "texto" },
    ],
    inicial: { titulo: "Documento para descargar", texto: "", url: "", detalle: "PDF", boton: "Descargar" },
  },
  boletin: {
    campos: [
      { k: "titulo", etiqueta: "Título", tipo: "texto" },
      { k: "texto", etiqueta: "Texto", tipo: "area" },
    ],
    inicial: { titulo: "Reciba el boletín", texto: "Las noticias del sector, en su correo." },
  },
  comparacion: {
    campos: [
      { k: "antes", etiqueta: "Imagen «antes»", tipo: "imagen" },
      { k: "despues", etiqueta: "Imagen «después»", tipo: "imagen" },
      { k: "etiqueta1", etiqueta: "Rótulo antes", tipo: "texto" },
      { k: "etiqueta2", etiqueta: "Rótulo después", tipo: "texto" },
      { k: "proporcion", etiqueta: "Forma", tipo: "opcion", opciones: PROPORCION },
    ],
    inicial: { antes: IMG, despues: IMG, etiqueta1: "Antes", etiqueta2: "Después", proporcion: "16/9" },
  },
  precios: {
    campos: [{ k: "columnas", etiqueta: "Columnas", tipo: "opcion", opciones: COLS(1, 4) }],
    inicial: { columnas: "3" },
    items: {
      nombre: "Plan",
      max: 6,
      campos: [
        { k: "nombre", etiqueta: "Nombre", tipo: "texto" },
        { k: "precio", etiqueta: "Precio", tipo: "texto" },
        { k: "periodo", etiqueta: "Periodo", tipo: "texto", ayuda: "Ej.: al mes" },
        { k: "incluye", etiqueta: "Qué incluye (uno por línea)", tipo: "area" },
        { k: "boton", etiqueta: "Botón", tipo: "texto" },
        { k: "url", etiqueta: "Enlace", tipo: "url" },
        { k: "destacado", etiqueta: "Destacado", tipo: "opcion", opciones: [["no", "No"], ["si", "Sí"]] },
      ],
      inicial: [
        { nombre: "Básico", precio: "$0", periodo: "", incluye: "Boletín diario\nNotas abiertas", boton: "Empezar", url: "/boletin", destacado: "no" },
        { nombre: "Aliado", precio: "$1.200.000", periodo: "al mes", incluye: "Banner en portada\nMención en el boletín\nInforme mensual", boton: "Paute con nosotros", url: "/paute-con-nosotros", destacado: "si" },
        { nombre: "Patrocinio", precio: "A convenir", periodo: "", incluye: "Contenido patrocinado\nEventos", boton: "Hablemos", url: "/contacto", destacado: "no" },
      ],
      nuevo: { nombre: "Plan", precio: "", periodo: "", incluye: "", boton: "", url: "", destacado: "no" },
    },
  },
};

/** La paleta del constructor, por grupos. */
export const PALETA: { grupo: string; items: { tipo: TipoElemento; etiqueta: string }[] }[] = [
  {
    grupo: "Texto",
    items: [
      { tipo: "titulo", etiqueta: "Título" }, { tipo: "parrafo", etiqueta: "Párrafo" }, { tipo: "destacado", etiqueta: "Texto grande" },
      { tipo: "lista", etiqueta: "Lista" }, { tipo: "cita", etiqueta: "Cita" }, { tipo: "aviso", etiqueta: "Aviso" }, { tipo: "tabla", etiqueta: "Tabla" },
    ],
  },
  {
    grupo: "Medios",
    items: [
      { tipo: "imagen", etiqueta: "Imagen" }, { tipo: "carrusel", etiqueta: "Carrusel" }, { tipo: "galeria", etiqueta: "Galería" },
      { tipo: "video", etiqueta: "Video" }, { tipo: "audio", etiqueta: "Audio" }, { tipo: "comparacion", etiqueta: "Antes y después" }, { tipo: "mapa", etiqueta: "Mapa" },
    ],
  },
  {
    grupo: "Secciones",
    items: [
      { tipo: "heroe", etiqueta: "Portada" }, { tipo: "tarjetas", etiqueta: "Tarjetas" }, { tipo: "caracteristicas", etiqueta: "Íconos y textos" },
      { tipo: "cifras", etiqueta: "Cifras" }, { tipo: "llamado", etiqueta: "Llamado" }, { tipo: "testimonios", etiqueta: "Testimonios" },
      { tipo: "equipo", etiqueta: "Equipo" }, { tipo: "logos", etiqueta: "Logos" }, { tipo: "precios", etiqueta: "Planes" },
    ],
  },
  {
    grupo: "Interactivos",
    items: [
      { tipo: "acordeon", etiqueta: "Preguntas" }, { tipo: "pestanas", etiqueta: "Pestañas" }, { tipo: "linea", etiqueta: "Línea de tiempo" },
      { tipo: "pasos", etiqueta: "Pasos" }, { tipo: "cuenta", etiqueta: "Cuenta regresiva" },
    ],
  },
  {
    grupo: "Acciones",
    items: [
      { tipo: "boton", etiqueta: "Botón" }, { tipo: "descarga", etiqueta: "Descarga" }, { tipo: "boletin", etiqueta: "Boletín" },
      { tipo: "redes", etiqueta: "Redes sociales" }, { tipo: "contacto", etiqueta: "Contacto" },
    ],
  },
  { grupo: "Noticias", items: [{ tipo: "notas", etiqueta: "Notas de una sección" }] },
  { grupo: "Diseño", items: [{ tipo: "separador", etiqueta: "Separador" }, { tipo: "espacio", etiqueta: "Espacio" }] },
];

export function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const TIPOS_BLOQUE = new Set(Object.keys(ESQUEMAS));
export function tipoEsBloque(t: string): t is TipoBloque {
  return TIPOS_BLOQUE.has(t);
}

/** Un elemento recién soltado, con textos de ejemplo para que se vea algo en el lienzo. */
export function elementoNuevo(tipo: TipoElemento): Elemento {
  const id = nuevoId();
  if (tipoEsBloque(tipo)) {
    const s = ESQUEMAS[tipo];
    return { id, tipo, p: { ...s.inicial }, items: (s.items?.inicial ?? []).map((x) => ({ ...x, _id: nuevoId() })) };
  }
  switch (tipo) {
    case "titulo": return { id, tipo, texto: "Título de la sección", nivel: 2 };
    case "parrafo": return { id, tipo, texto: "Escriba aquí el texto del párrafo." };
    case "imagen": return { id, tipo, url: "", alt: "" };
    case "boton": return { id, tipo, texto: "Más información", url: "/", estilo: "lleno" };
    case "lista": return { id, tipo, items: ["Primer punto", "Segundo punto"] };
    case "cita": return { id, tipo, texto: "Una frase que valga la pena destacar.", autor: "" };
    case "aviso": return { id, tipo, texto: "Aviso importante para el lector.", tono: "info" };
    case "video": return { id, tipo, url: "" };
    case "separador": return { id, tipo, estilo: "linea" };
    case "espacio": return { id, tipo, alto: 32 };
    case "notas": return { id, tipo, seccion: "", cantidad: 4, estilo: "lista", columnas: 2 };
  }
}

/** Copia de un elemento con ids nuevos (para duplicar). */
export function duplicarElemento(e: Elemento): Elemento {
  const c = JSON.parse(JSON.stringify(e)) as Elemento;
  c.id = nuevoId();
  if (esBloque(c)) c.items = c.items.map((x) => ({ ...x, _id: nuevoId() }));
  return c;
}

export function filaNueva(columnas: number[]): Fila {
  return { id: nuevoId(), columnas: [...columnas], celdas: columnas.map(() => []), fondo: "ninguno" };
}

export function duplicarFila(f: Fila): Fila {
  return { ...JSON.parse(JSON.stringify(f)), id: nuevoId(), celdas: f.celdas.map((c) => c.map(duplicarElemento)) };
}

/** Filas prediseñadas: se insertan ya armadas y luego se cambian como cualquier otra. */
export const PLANTILLAS: { id: string; etiqueta: string; descripcion: string; crear: () => Fila }[] = [
  { id: "portada", etiqueta: "Portada con imagen", descripcion: "Imagen de fondo, título y botones", crear: () => filaCon([12], [[elementoNuevo("heroe")]]) },
  { id: "texto-imagen", etiqueta: "Texto e imagen", descripcion: "Título y párrafo al lado de una foto", crear: () => filaCon([6, 6], [[elementoNuevo("titulo"), elementoNuevo("parrafo"), elementoNuevo("boton")], [elementoNuevo("imagen")]], { vertical: "centro" }) },
  { id: "imagen-texto", etiqueta: "Imagen y texto", descripcion: "La foto a la izquierda", crear: () => filaCon([6, 6], [[elementoNuevo("imagen")], [elementoNuevo("titulo"), elementoNuevo("parrafo"), elementoNuevo("boton")]], { vertical: "centro" }) },
  { id: "tarjetas", etiqueta: "Tres tarjetas", descripcion: "Título y tarjetas con enlace", crear: () => filaCon([12], [[conTitulo("Lo más importante"), elementoNuevo("tarjetas")]]) },
  { id: "cifras", etiqueta: "Cifras clave", descripcion: "Números grandes sobre fondo de color", crear: () => filaCon([12], [[elementoNuevo("cifras")]], { fondo: "acento" }) },
  { id: "servicios", etiqueta: "Servicios", descripcion: "Íconos con título y texto", crear: () => filaCon([12], [[conTitulo("Qué hacemos"), elementoNuevo("caracteristicas")]], { fondo: "suave" }) },
  { id: "faq", etiqueta: "Preguntas frecuentes", descripcion: "Acordeón al lado de un texto", crear: () => filaCon([4, 8], [[conTitulo("Preguntas frecuentes"), elementoNuevo("parrafo")], [elementoNuevo("acordeon")]]) },
  { id: "galeria", etiqueta: "Galería de fotos", descripcion: "Título y mosaico de fotos", crear: () => filaCon([12], [[conTitulo("Galería"), elementoNuevo("galeria")]]) },
  { id: "equipo", etiqueta: "Nuestro equipo", descripcion: "Fotos, nombres y cargos", crear: () => filaCon([12], [[conTitulo("Nuestro equipo"), elementoNuevo("equipo")]]) },
  { id: "historia", etiqueta: "Historia", descripcion: "Línea de tiempo", crear: () => filaCon([2, 8, 2], [[], [conTitulo("Nuestra historia"), elementoNuevo("linea")], []]) },
  { id: "llamado", etiqueta: "Llamado a la acción", descripcion: "Franja con botón", crear: () => filaCon([12], [[elementoNuevo("llamado")]]) },
  { id: "testimonios", etiqueta: "Testimonios", descripcion: "Lo que dicen de nosotros", crear: () => filaCon([12], [[conTitulo("Lo que dicen"), elementoNuevo("testimonios")]], { fondo: "suave" }) },
  { id: "noticias", etiqueta: "Noticias de una sección", descripcion: "Notas que se actualizan solas", crear: () => filaCon([8, 4], [[conTitulo("Últimas noticias"), { ...elementoNuevo("notas"), estilo: "tarjetas" } as Elemento], [elementoNuevo("boletin"), elementoNuevo("redes")]]) },
  { id: "contacto", etiqueta: "Contacto y mapa", descripcion: "Datos de contacto al lado del mapa", crear: () => filaCon([5, 7], [[elementoNuevo("contacto")], [elementoNuevo("mapa")]]) },
];

function filaCon(columnas: number[], celdas: Elemento[][], extra: Partial<Fila> = {}): Fila {
  return { ...filaNueva(columnas), celdas, ...extra };
}
function conTitulo(texto: string): Elemento {
  return { id: nuevoId(), tipo: "titulo", texto, nivel: 2 };
}

// --- Saneado: lo que llega del navegador nunca se guarda tal cual. ---

const MAX_FILAS = 80;
const MAX_POR_CELDA = 40;
const txt = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const id = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{1,16}$/.test(v) ? v : nuevoId());
const alinear = (v: unknown): Alinear | undefined => (v === "izquierda" || v === "centro" || v === "derecha" ? v : undefined);
const uno = <T extends string>(v: unknown, ops: readonly T[], def: T): T => (ops.includes(v as T) ? (v as T) : def);

/** Solo rutas del sitio o enlaces http(s) (y mailto/tel): nada de `javascript:`. */
export function urlSegura(v: unknown): string {
  const s = txt(v, 1000).trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (s.startsWith("#") && /^#[A-Za-z0-9_-]{1,60}$/.test(s)) return s;
  if (/^mailto:[^\s<>"']{3,200}$/i.test(s) || /^tel:\+?[0-9 ()-]{3,30}$/i.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/** Número de un valor de bloque, dentro de un rango. */
export function num(v: string | undefined, min: number, max: number, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

function sanearCampo(c: Campo, v: unknown, def: string): string {
  switch (c.tipo) {
    case "texto": return txt(v, c.max ?? 300);
    case "area": return txt(v, c.max ?? 4000);
    case "url":
    case "imagen": return urlSegura(v);
    case "color": return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "";
    case "fecha": return typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v) ? v : "";
    case "numero": return String(num(typeof v === "string" || typeof v === "number" ? String(v) : def, c.min, c.max, Number(def) || c.min));
    case "opcion": return c.opciones.some(([k]) => k === v) ? (v as string) : def || c.opciones[0][0];
  }
}

function sanearValores(campos: Campo[], v: unknown, inicial: Valores): Valores {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const out: Valores = {};
  for (const c of campos) out[c.k] = sanearCampo(c, o[c.k], inicial[c.k] ?? "");
  return out;
}

function sanearElemento(e: unknown): Elemento | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  const base = { id: id(o.id) };
  if (typeof o.tipo === "string" && tipoEsBloque(o.tipo)) {
    const s = ESQUEMAS[o.tipo];
    const items = s.items
      ? (Array.isArray(o.items) ? o.items : []).slice(0, s.items.max).map((x) => ({ ...sanearValores(s.items!.campos, x, s.items!.nuevo), _id: id((x as Valores | null)?._id) }))
      : [];
    return { ...base, tipo: o.tipo, p: sanearValores(s.campos, o.p, s.inicial), items };
  }
  switch (o.tipo) {
    case "titulo": return { ...base, tipo: "titulo", texto: txt(o.texto, 300), nivel: o.nivel === 3 ? 3 : 2, alinear: alinear(o.alinear), antetitulo: txt(o.antetitulo, 120) || undefined };
    case "parrafo": return { ...base, tipo: "parrafo", texto: txt(o.texto, 8000), alinear: alinear(o.alinear) };
    case "imagen": return { ...base, tipo: "imagen", url: urlSegura(o.url), alt: txt(o.alt, 300), pie: txt(o.pie, 300) || undefined, url_enlace: urlSegura(o.url_enlace) || undefined, redondeo: uno(o.redondeo, ["no", "si", "circulo"] as const, "si") };
    case "boton": return { ...base, tipo: "boton", texto: txt(o.texto, 80), url: urlSegura(o.url), estilo: uno(o.estilo, ["lleno", "borde", "texto"] as const, "lleno"), alinear: alinear(o.alinear), tamano: uno(o.tamano, ["normal", "grande"] as const, "normal") };
    case "lista": return { ...base, tipo: "lista", items: (Array.isArray(o.items) ? o.items : []).slice(0, 50).map((x) => txt(x, 500)), numerada: o.numerada === true };
    case "cita": return { ...base, tipo: "cita", texto: txt(o.texto, 1000), autor: txt(o.autor, 120) || undefined };
    case "aviso": return { ...base, tipo: "aviso", texto: txt(o.texto, 1000), tono: uno(o.tono, ["info", "alerta", "exito"] as const, "info") };
    case "video": return { ...base, tipo: "video", url: urlSegura(o.url) };
    case "separador": return { ...base, tipo: "separador", estilo: uno(o.estilo, ["linea", "puntos", "ornamento"] as const, "linea") };
    case "espacio": return { ...base, tipo: "espacio", alto: Math.min(240, Math.max(8, Number(o.alto) || 32)) };
    case "notas": return {
      ...base, tipo: "notas", seccion: txt(o.seccion, 100).replace(/[^a-z0-9-]/g, ""), cantidad: Math.min(24, Math.max(1, Number(o.cantidad) || 4)),
      estilo: uno(o.estilo, ["lista", "tarjetas", "carrusel", "portada"] as const, "lista"), columnas: Math.min(4, Math.max(1, Number(o.columnas) || 2)),
    };
    default: return null;
  }
}

/** Máximo de notas quitadas de la lista de una sección. */
export const MAX_OCULTAS = 60;

export function sanearPagina(v: unknown): ContenidoPagina {
  const filas = Array.isArray((v as ContenidoPagina | null)?.filas) ? (v as ContenidoPagina).filas : [];
  const ocultasCrudas = (v as ContenidoPagina | null)?.ocultas;
  const ocultas = [...new Set((Array.isArray(ocultasCrudas) ? ocultasCrudas : []).filter((x): x is string => typeof x === "string" && /^[^\s]{1,300}$/.test(x)))].slice(0, MAX_OCULTAS);
  return {
    ...(ocultas.length ? { ocultas } : {}),
    filas: filas.slice(0, MAX_FILAS).flatMap((f): Fila[] => {
      if (!f || typeof f !== "object") return [];
      const cols = (Array.isArray(f.columnas) ? f.columnas : []).map((n) => Math.round(Number(n))).filter((n) => n >= 1 && n <= 12);
      if (!cols.length || cols.length > 4 || cols.reduce((a, b) => a + b, 0) !== 12) return [];
      const celdas = cols.map((_, i) => (Array.isArray(f.celdas?.[i]) ? f.celdas[i] : []).slice(0, MAX_POR_CELDA).map(sanearElemento).filter((x): x is Elemento => !!x));
      return [{
        id: id(f.id),
        columnas: cols,
        celdas,
        fondo: uno(f.fondo, ["ninguno", "suave", "acento", "oscuro", "degradado", "imagen"] as const, "ninguno"),
        fondoImagen: urlSegura(f.fondoImagen) || undefined,
        espaciado: uno(f.espaciado, ["compacto", "normal", "amplio"] as const, "normal"),
        vertical: uno(f.vertical, ["arriba", "centro"] as const, "arriba"),
      }];
    }),
  };
}

/** Un tramo de dirección: minúsculas, números y guiones. */
export function slugPagina(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Dirección completa de una página: uno o dos tramos (`pagina` o `seccion/pagina`). */
export function rutaPagina(texto: string): string {
  return texto
    .split("/")
    .map(slugPagina)
    .filter(Boolean)
    .slice(0, 2)
    .join("/");
}

/** Si un video es de YouTube o Vimeo, la dirección para incrustarlo; si no, null. */
export function videoIncrustado(url: string): string | null {
  try {
    const u = new URL(url);
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      const v = u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/live/") ? u.pathname.split("/")[2] : (u.searchParams.get("v") ?? u.pathname.split("/").pop());
      return v ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}` : null;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (/(^|\.)vimeo\.com$/.test(u.hostname)) return `https://player.vimeo.com/video/${encodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "")}`;
  } catch {}
  return null;
}

/** Celdas de una tabla escrita como texto (una fila por línea, celdas separadas por «|»). */
export function celdasTabla(datos: string): string[][] {
  return datos
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map((l) => l.split("|").map((c) => c.trim()).slice(0, 12));
}
