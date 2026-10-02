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
};

export type AuditResult = {
  score: number;
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
  ) => items.push({ id, ok, severity: ok ? "ok" : soft ? "aviso" : "error", text, help, weight });

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
    words >= 250,
    `Cuerpo ${words} palabras (mínimo recomendado 250)`,
    2,
    "Una nota muy corta rara vez responde la intención de búsqueda.",
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
    add("tema-titulo", inTitle, "El tema aparece en el título", 2,
      `Términos del tema: ${terms.join(", ")}`);
    add("tema-entrada", inFirst, "El tema aparece en el primer párrafo", 1);
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
    "Los titulares sensacionalistas se tratan como señuelo y pierden visibilidad.",
    true,
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
    "Google premia el contenido que muestra de dónde salen los datos (cifras, comunicados, entidades).",
    true,
  );
  if (input.coverImageUrl !== undefined) {
    add(
      "portada",
      Boolean(input.coverImageUrl),
      "Imagen de portada presente",
      1,
      "Discover y los resultados enriquecidos exigen una imagen grande (≥ 1200 px de ancho).",
      true,
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
      "La autoría visible y enlazada a una página de autor es una señal de confianza para Google.",
      true,
    );
  }

  const total = items.reduce((n, i) => n + i.weight, 0);
  const got = items.reduce((n, i) => n + (i.ok ? i.weight : 0), 0);

  return {
    score: total ? Math.round((got / total) * 100) : 0,
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
