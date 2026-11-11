/**
 * Dirección de arte de una portada: el equipo elige cómo se ve la imagen (tratamiento de color, cámara y lente, plano, luz y ambiente) y todo eso se
 * ensambla en UN prompt ordenado y profesional para el modelo de imagen. Es lógica pura (sin servidor), para usarla en el formulario y en la
 * generación, y para probarla.
 */
type Opcion<Id extends string> = { id: Id; nombre: string; texto: string };

export const TRATAMIENTOS = [
  { id: "cine", nombre: "Cine a color", texto: "Fotografía fotorrealista con estética de fotograma de cine, colores naturales y ricos, grano de película sutil" },
  { id: "natural", nombre: "Color natural", texto: "Fotografía a color fiel a la realidad, balance de blancos neutro, tonos naturales sin filtros ni efectos" },
  { id: "sepia", nombre: "Sepia", texto: "Fotografía monocromática en tono sepia cálido, estética de archivo histórico, grano fino y viñeteado muy suave" },
  { id: "bn", nombre: "Blanco y negro", texto: "Fotografía en blanco y negro de alto contraste y rica gama tonal, estilo de reportaje documental clásico, grano de película fino" },
  { id: "desaturado", nombre: "Documental sobrio", texto: "Fotografía documental de colores desaturados y contraste moderado, aspecto de reportaje serio" },
  { id: "vivo", nombre: "Color vibrante", texto: "Fotografía editorial de colores vibrantes y bien saturados, estilo de revista, luz limpia y cielos definidos" },
] as const satisfies readonly Opcion<string>[];

export const CAMARAS = [
  { id: "fullframe", nombre: "Full frame 35 mm", texto: "cámara full frame con lente de 35 mm f/2, nitidez editorial y rango dinámico amplio" },
  { id: "granangular", nombre: "Gran angular 24 mm", texto: "lente gran angular de 24 mm que abarca el entorno, con perspectiva amplia y profundidad" },
  { id: "tele", nombre: "Teleobjetivo 85–135 mm", texto: "teleobjetivo de 85 a 135 mm f/1.8, compresión de planos, poca profundidad de campo y fondo suavemente desenfocado" },
  { id: "dron", nombre: "Dron (vista aérea)", texto: "toma aérea con dron a unos 80 metros de altura, perspectiva elevada que muestra el territorio" },
  { id: "mediano", nombre: "Medio formato", texto: "cámara de medio formato con lente de 80 mm, detalle y rango dinámico excepcionales" },
  { id: "analogica", nombre: "Cámara analógica 35 mm", texto: "cámara analógica de 35 mm con película Kodak Portra 400, textura y colores propios de la película" },
] as const satisfies readonly Opcion<string>[];

export const PLANOS = [
  { id: "general", nombre: "Plano general", texto: "plano general amplio que sitúa el lugar y la escala de la escena" },
  { id: "medio", nombre: "Plano medio", texto: "plano medio que muestra al sujeto con su entorno cercano" },
  { id: "primer", nombre: "Primer plano", texto: "primer plano del sujeto principal, con fondo desenfocado" },
  { id: "detalle", nombre: "Plano detalle", texto: "plano detalle muy cercano, casi macro, de un elemento significativo" },
  { id: "contrapicado", nombre: "Contrapicado", texto: "toma en contrapicado, desde abajo, que da presencia y fuerza al sujeto" },
  { id: "cenital", nombre: "Cenital", texto: "toma cenital, desde arriba, de forma gráfica y ordenada" },
] as const satisfies readonly Opcion<string>[];

export const LUCES = [
  { id: "dorada", nombre: "Hora dorada", texto: "luz natural cálida de la hora dorada, sombras largas y suaves" },
  { id: "amanecer", nombre: "Amanecer", texto: "luz fría y suave del amanecer, con neblina ligera en el ambiente" },
  { id: "mediodia", nombre: "Mediodía", texto: "luz solar directa de mediodía, nítida y de alto contraste" },
  { id: "nublado", nombre: "Cielo nublado", texto: "luz difusa y pareja de un día nublado, sin sombras duras" },
  { id: "contraluz", nombre: "Contraluz", texto: "contraluz con borde luminoso en los sujetos y atmósfera con partículas de luz" },
  { id: "interior", nombre: "Interior", texto: "luz natural de ventana en un interior, suave y direccional" },
] as const satisfies readonly Opcion<string>[];

export const AMBIENTES = [
  { id: "documental", nombre: "Documental", texto: "ambiente documental, honesto y cercano, sin dramatismo artificial" },
  { id: "sereno", nombre: "Sereno", texto: "ambiente sereno y contemplativo" },
  { id: "dramatico", nombre: "Dramático", texto: "ambiente dramático, de tensión contenida y fuerte contraste" },
  { id: "epico", nombre: "Épico", texto: "ambiente épico, de gran escala y majestuosidad" },
] as const satisfies readonly Opcion<string>[];

export type TratamientoId = (typeof TRATAMIENTOS)[number]["id"];
export type CamaraId = (typeof CAMARAS)[number]["id"];
export type PlanoId = (typeof PLANOS)[number]["id"];
export type LuzId = (typeof LUCES)[number]["id"];
export type AmbienteId = (typeof AMBIENTES)[number]["id"];

export type EstiloEscena = { tratamiento: TratamientoId; camara: CamaraId; plano: PlanoId; luz: LuzId; ambiente: AmbienteId; notas: string };

/** El estilo de siempre de las portadas del sitio: foto de cine a color, full frame, plano general, hora dorada. */
export const ESTILO_POR_DEFECTO: EstiloEscena = { tratamiento: "cine", camara: "fullframe", plano: "general", luz: "dorada", ambiente: "documental", notas: "" };

const buscar = <T extends { id: string }>(lista: readonly T[], id: unknown, defecto: T): T => lista.find((o) => o.id === id) ?? defecto;

/** Un estilo que llega del navegador, saneado: lo que no es una opción conocida vuelve a su valor por defecto y las notas se recortan. */
export function estiloValido(x: unknown): EstiloEscena {
  const e = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const d = ESTILO_POR_DEFECTO;
  return {
    tratamiento: buscar(TRATAMIENTOS, e.tratamiento, TRATAMIENTOS.find((o) => o.id === d.tratamiento)!).id,
    camara: buscar(CAMARAS, e.camara, CAMARAS.find((o) => o.id === d.camara)!).id,
    plano: buscar(PLANOS, e.plano, PLANOS.find((o) => o.id === d.plano)!).id,
    luz: buscar(LUCES, e.luz, LUCES.find((o) => o.id === d.luz)!).id,
    ambiente: buscar(AMBIENTES, e.ambiente, AMBIENTES.find((o) => o.id === d.ambiente)!).id,
    notas: typeof e.notas === "string" ? e.notas.replace(/\s+/g, " ").trim().slice(0, 400) : "",
  };
}

/** Ensambla el prompt final: tratamiento, tema, escena, plano, cámara, luz, ambiente, composición, calidad, notas del equipo y restricciones. */
export function construirPrompt(input: { titulo: string; resumen?: string; escena: string; estilo?: Partial<EstiloEscena> }): string {
  const estilo = estiloValido({ ...ESTILO_POR_DEFECTO, ...input.estilo });
  const tratamiento = TRATAMIENTOS.find((o) => o.id === estilo.tratamiento)!;
  const camara = CAMARAS.find((o) => o.id === estilo.camara)!;
  const plano = PLANOS.find((o) => o.id === estilo.plano)!;
  const luz = LUCES.find((o) => o.id === estilo.luz)!;
  const ambiente = AMBIENTES.find((o) => o.id === estilo.ambiente)!;
  const resumen = input.resumen ? ` (${input.resumen.slice(0, 220)})` : "";
  const monocromo = estilo.tratamiento === "sepia" || estilo.tratamiento === "bn";
  return [
    `${tratamiento.texto}, que ilustra la noticia «${input.titulo}»${resumen}.`,
    `ESCENA: ${input.escena}. Debe mostrar de forma inequívoca el tema de la nota, no una escena genérica.`,
    `ENCUADRE: ${plano.texto}. CÁMARA Y LENTE: ${camara.texto}.`,
    `ILUMINACIÓN: ${luz.texto}${monocromo ? ", interpretada en tonos monocromáticos" : ""}. AMBIENTE: ${ambiente.texto}.`,
    "COMPOSICIÓN: formato horizontal 16:9 de calidad editorial, sujeto principal claro, regla de tercios y un lado visual limpio que respire.",
    "CALIDAD: máxima nitidez y detalle, resolución muy alta, sin compresión ni pixelado, texturas realistas.",
    estilo.notas ? `INDICACIONES DEL EQUIPO: ${estilo.notas}.` : "",
    "RESTRICCIONES: muestra únicamente lo que describe la escena y nada más: no agregues animales, personas, paisajes ni elementos que la escena no mencione. Sin texto, sin letras, sin logotipos, sin marcas de agua. Sin personas reales identificables.",
  ]
    .filter(Boolean)
    .join(" ");
}
