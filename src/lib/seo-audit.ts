/**
 * Auditoría editorial y de posicionamiento.
 *
 * Determinista y sin red: las mismas reglas que un editor aplicaría a mano, de
 * modo que el panel puntúa igual con IA o sin ella. No hay "trucos de SEO"
 * aquí: son comprobaciones de que la pieza está bien escrita y bien descrita.
 *
 * Pura a propósito (sin `server-only`, sin base de datos): la usa el editor en
 * el navegador mientras se escribe y también el servidor si hace falta.
 */

export type AuditSeverity = "error" | "aviso" | "ok";

export type AuditItem = {
  id: string;
  ok: boolean;
  severity: AuditSeverity;
  text: string;
  /** Qué hacer si falla. */
  help?: string;
  /** Peso en la nota final. */
  weight: number;
  group: AuditGroupId;
  critical: boolean;
};

/** Bloques de la nota: reflejan cómo Google evalúa un artículo (ver criterios en `GROUP_OF`). */
export type AuditGroupId = "contenido" | "ficha" | "discover" | "lectura";
export const AUDIT_GROUPS: Record<AuditGroupId, string> = {
  contenido: "Contenido útil y confiable",
  ficha: "Ficha en buscadores",
  discover: "Imagen y Discover",
  lectura: "Lectura y estructura",
};

/**
 * Criterios de Google («contenido útil, fiable y pensado para las personas»,
 * políticas de Discover y spam): autoría visible, fuentes y evidencia, informe
 * original con sustancia, titulares sin sensacionalismo, imagen grande ≥ 1200 px.
 * Guía de Google sobre búsqueda con IA (AI Overviews / modo IA): es SEO normal; contenido único con perspectiva propia,
 * útil y pensado para personas, párrafos claros, encabezados y HTML semántico, imágenes y vídeo relevantes. NO hay una
 * longitud de página obligatoria ni hace falta trocear el texto, reescribirlo «para la IA» ni crear archivos especiales.
 * `CRITICAL`: si falla uno, la nota no puede pasar de «Bueno» aunque lo demás esté perfecto,
 * porque son lo que más pesa en la evaluación de calidad (E-E-A-T) y no se compensa con meta etiquetas.
 */
const GROUP_OF: Record<string, AuditGroupId> = {
  firma: "contenido", fuentes: "contenido", cuerpo: "contenido", pendientes: "contenido",
  "titulo-limpio": "contenido", "tema-titulo": "contenido", "tema-entrada": "contenido", enlaces: "contenido",
  "title-len": "ficha", "desc-len": "ficha", "desc-prosa": "ficha", "desc-distinta": "ficha", excerpt: "ficha",
  portada: "discover", "portada-alt": "discover", alt: "discover",
  intertitulos: "lectura", parrafos: "lectura", frases: "lectura", etiquetas: "lectura",
};
const CRITICAL = new Set(["firma", "fuentes", "pendientes", "titulo-limpio"]);
/** Peso por criterio: el contenido y la confianza pesan más que las meta etiquetas. */
const WEIGHT: Record<string, number> = {
  firma: 4, fuentes: 4, cuerpo: 2, pendientes: 4, "titulo-limpio": 3, "tema-titulo": 1, "tema-entrada": 1, enlaces: 1,
  "title-len": 1, "desc-len": 1, "desc-prosa": 1, "desc-distinta": 1, excerpt: 1,
  portada: 3, "portada-alt": 1, alt: 1,
  intertitulos: 1, parrafos: 1, frases: 1, etiquetas: 1,
};

export type AuditResult = {
  score: number;
  /** Nota (0–100) por bloque; null si el bloque no tiene criterios evaluables. */
  groups: { id: AuditGroupId; label: string; score: number | null }[];
  /** Criterios críticos que fallan y limitan la nota máxima. */
  capped: boolean;
  items: AuditItem[];
  stats: { words: number; minutes: number; paragraphs: number; headings: number };
};

export type AuditInput = {
  title: string;
  excerpt: string;
  body: string;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  /** Tema o palabra clave principal; normalmente, el prompt del redactor. */
  focus?: string;
  /** Opcionales: si no se pasan, no se evalúan las comprobaciones de portada y firma. */
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  authorName?: string | null;
};

const stripTags = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Normaliza para comparar: sin tildes, minúsculas. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Palabras con carga semántica del foco (descarta artículos y preposiciones). */
const STOP = new Set(
  "el la los las un una unos unas de del al a y o u en con por para que se su sus lo es son sobre entre como mas más".split(" "),
);

export function focusTerms(focus: string): string[] {
  return norm(focus)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .slice(0, 6);
}

export function auditArticle(input: AuditInput): AuditResult {
  const title = (input.metaTitle || input.title).trim();
  const desc = (input.metaDescription || input.excerpt).trim();
  const plain = stripTags(input.body);
  const words = plain ? plain.split(/\s+/).length : 0;
  const paragraphs = (input.body.match(/<p[\s>]/gi) ?? []).length;
  const headings = (input.body.match(/<h2[\s>]/gi) ?? []).length;
  const sentences = plain.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
  const avgSentence = sentences.length ? words / sentences.length : 0;
  const terms = input.focus ? focusTerms(input.focus) : [];
  const firstParagraph = norm(stripTags(input.body.split(/<\/p>/i)[0] ?? ""));

  const items: AuditItem[] = [];
  const add = (
    id: string,
    ok: boolean,
    text: string,
    weight: number,
    help?: string,
    soft = false,
  ) =>
    items.push({
      id,
      ok,
      severity: ok ? "ok" : soft && !CRITICAL.has(id) ? "aviso" : "error",
      text,
      help,
      weight: WEIGHT[id] ?? weight,
      group: GROUP_OF[id] ?? "lectura",
      critical: CRITICAL.has(id),
    });

  // --- Ficha para buscadores -----------------------------------------------
  add(
    "title-len",
    title.length >= 15 && title.length <= 65,
    `Título ${title.length} car. (ideal 15–65)`,
    2,
    "Más de 65 caracteres y Google lo recorta en el resultado.",
  );
  add(
    "desc-len",
    desc.length >= 70 && desc.length <= 155,
    `Descripción ${desc.length} car. (ideal 70–155)`,
    2,
    "Es el texto que decide si alguien hace clic desde el buscador.",
  );
  add(
    "desc-prosa",
    !/(,\s*){4,}/.test(desc) && desc.split(" ").length > 8,
    "Descripción en prosa, no lista de términos",
    1,
    "Una lista de palabras separadas por comas se lee como spam.",
  );
  add("excerpt", input.excerpt.trim().length > 0, "Resumen presente", 1);

  // --- Estructura del texto -------------------------------------------------
  add(
    "cuerpo",
    words >= 150,
    `Cuerpo con sustancia: ${words} palabras (referencia mínima 150)`,
    2,
    "Google no exige una longitud: pide contenido original que deje al lector satisfecho. Por debajo de ~150 palabras rara vez lo logra.",
  );
  add(
    "intertitulos",
    headings >= 1 || words < 400,
    `Intertítulos <h2>: ${headings}`,
    1,
    "A partir de ~400 palabras, divide con intertítulos.",
    true,
  );
  add(
    "parrafos",
    paragraphs === 0 || words / Math.max(paragraphs, 1) <= 110,
    "Párrafos de longitud legible",
    1,
    "Párrafos de más de ~110 palabras cansan en móvil.",
    true,
  );
  add(
    "frases",
    avgSentence === 0 || avgSentence <= 28,
    `Frases de ${Math.round(avgSentence)} palabras de media`,
    1,
    "Por encima de 28 palabras por frase, la lectura se vuelve densa.",
    true,
  );

  // --- Tema principal -------------------------------------------------------
  if (terms.length > 0) {
    const inTitle = terms.some((t) => norm(title).includes(t));
    const inFirst = terms.some((t) => firstParagraph.includes(t));
    add("tema-titulo", inTitle, "El tema central se reconoce en el título", 1,
      `Términos del tema: ${terms.join(", ")}`);
    add("tema-entrada", inFirst, "El tema central se reconoce en el primer párrafo", 1, "Google entiende sinónimos: no repitas la palabra, deja claro de qué trata.", true);
  }

  // --- Higiene --------------------------------------------------------------
  const imgs = input.body.match(/<img[^>]*>/gi) ?? [];
  add(
    "alt",
    imgs.every((i) => /alt=/.test(i)),
    imgs.length ? `Imágenes con alt (${imgs.length})` : "Sin imágenes en el cuerpo",
    1,
    "El alt es accesibilidad primero y posicionamiento después.",
    true,
  );
  add(
    "enlaces",
    /<a\s[^>]*href=/i.test(input.body) || words < 300,
    "Al menos un enlace en el cuerpo",
    1,
    "Enlaza a notas propias relacionadas o a la fuente.",
    true,
  );
  add(
    "pendientes",
    !/\{\{[^}]+\}\}/.test(`${input.title} ${input.excerpt} ${input.body}`),
    "Sin datos por confirmar {{…}}",
    3,
    "El generador marca así lo que no pudo verificar: revísalo antes de publicar.",
  );
  add("etiquetas", (input.tags?.length ?? 0) > 0, "Etiquetas asignadas", 1, undefined, true);

  // --- Contenido útil y confiable (E-E-A-T) y requisitos de Discover ------------
  add(
    "titulo-limpio",
    !(/[!?]{2,}/.test(title) || (title.length > 12 && title === title.toUpperCase())),
    "Título sin MAYÚSCULAS sostenidas ni signos repetidos",
    1,
    "Google desaconseja el señuelo (clickbait) en titulares: pierden visibilidad, sobre todo en Discover.",
  );
  add(
    "desc-distinta",
    norm(desc) !== norm(title) && !norm(desc).startsWith(norm(title)),
    "Descripción distinta del título",
    1,
    "Si repite el título, desperdicias el espacio que convence de hacer clic.",
    true,
  );
  add(
    "fuentes",
    /<a\s[^>]*href=["']https?:\/\//i.test(input.body) || words < 300,
    "Cita o enlaza una fuente externa",
    1,
    "Google valora la evidencia: cita de dónde salen las cifras (entidad, comunicado, estudio) con un enlace.",
  );
  if (input.coverImageUrl !== undefined) {
    add(
      "portada",
      Boolean(input.coverImageUrl),
      "Imagen de portada presente",
      1,
      "Discover pide una imagen propia y relevante de ≥ 1200 px de ancho (ideal 16:9), no un logo.",
    );
    if (input.coverImageUrl) {
      add("portada-alt", Boolean(input.coverImageAlt?.trim()), "La portada tiene texto alternativo", 1, "Describe la imagen en una frase: accesibilidad y buscador de imágenes.", true);
    }
  }
  if (input.authorName !== undefined) {
    add(
      "firma",
      Boolean(input.authorName?.trim()),
      "La nota tiene firma (autor)",
      1,
      "Google pide autoría clara (firma con su página de autor): es la señal de confianza (E-E-A-T) más visible.",
    );
  }

  const total = items.reduce((n, i) => n + i.weight, 0);
  const got = items.reduce((n, i) => n + (i.ok ? i.weight : 0), 0);
  let score = total ? Math.round((got / total) * 100) : 0;
  // Los criterios críticos no se compensan con meta etiquetas: 1 fallo → máx. 79 («Bueno»); 2 o más → máx. 64.
  const fallosCriticos = items.filter((i) => i.critical && !i.ok).length;
  const capped = fallosCriticos > 0;
  if (fallosCriticos >= 2) score = Math.min(score, 64);
  else if (fallosCriticos === 1) score = Math.min(score, 79);
  const groups = (Object.keys(AUDIT_GROUPS) as AuditGroupId[]).map((id) => {
    const its = items.filter((i) => i.group === id);
    const t = its.reduce((n, i) => n + i.weight, 0);
    return { id, label: AUDIT_GROUPS[id], score: t ? Math.round((its.reduce((n, i) => n + (i.ok ? i.weight : 0), 0) / t) * 100) : null };
  });

  return {
    score,
    groups,
    capped,
    items,
    stats: {
      words,
      minutes: Math.max(1, Math.round(words / 220)),
      paragraphs,
      headings,
    },
  };
}

/** Etiqueta legible de la nota. */
export function scoreLabel(score: number): string {
  if (score >= 90) return "Excelente";
  if (score >= 75) return "Bueno";
  if (score >= 55) return "Mejorable";
  return "Insuficiente";
}
