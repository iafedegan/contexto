/**
 * Extrae de la página HTML de una nota del sitio anterior los datos que importan para migrarla. Cada página trae el contenido completo
 * de la nota (cuerpo, secciones, regiones, galería, audio, autor, imagen con créditos…) dentro del JSON de Next.js (`__NEXT_DATA__`),
 * mucho más fiable que raspar el HTML visible. Función pura, para probarla sin red.
 */

/** Autor reducido a lo que se necesita (la página trae el registro completo de Storyblok). */
export type AutorAntiguo = { uuid: string; name: string; slug: string; image: string | null; labels: string[] } | { uuid: string };

/** Lo que se guarda de cada nota descargada. */
export type NotaDescargada = {
  /** Ruta de la nota en el sitio anterior, sin dominio: `/seccion/slug`. */
  path: string;
  /** Código HTTP con el que respondió la página. */
  status: number;
  /** La nota, tal como la entrega Storyblok (con `content` casi completo); null si la página no trajo la nota. */
  story: {
    id: number | string;
    uuid: string;
    name: string;
    slug: string;
    full_slug: string;
    created_at: string | null;
    first_published_at: string | null;
    published_at: string | null;
    updated_at: string | null;
    tag_list: string[];
    content: Record<string, unknown>;
  } | null;
  /** Datos estructurados (JSON-LD) de la página: fechas reales y palabras clave. */
  ld: { datePublished?: string; dateModified?: string; keywords?: string; authors: string[] } | null;
  /** HTML del `<article>`, solo si el cuerpo de la nota vino vacío (por si el contenido estaba en otro componente). */
  articleHtml?: string;
  titulo?: string;
  descripcion?: string;
  ogImagen?: string;
};

// Quita la parte pesada y sin uso del autor (el registro completo de Storyblok).
function reducirAutor(a: unknown): unknown {
  if (!a || typeof a !== "object") return a;
  const o = a as Record<string, unknown>;
  if (typeof o.name !== "string") return o.uuid ? { uuid: String(o.uuid) } : a;
  const c = (o.content ?? {}) as Record<string, unknown>;
  const img = (c.image ?? {}) as Record<string, unknown>;
  return {
    uuid: String(o.uuid ?? ""),
    name: o.name,
    slug: String(o.slug ?? ""),
    image: typeof img.filename === "string" && img.filename ? img.filename : null,
    labels: Array.isArray(c.labels) ? c.labels.filter((x): x is string => typeof x === "string") : [],
  };
}

// Busca dentro del JSON de la página la nota cuya dirección coincide con la ruta pedida.
function buscarNota(raiz: unknown, fullSlug: string): Record<string, unknown> | null {
  const objetivo = fullSlug.toLowerCase();
  let hallada: Record<string, unknown> | null = null;
  const visitar = (o: unknown) => {
    if (hallada || !o || typeof o !== "object") return;
    if (Array.isArray(o)) { for (const v of o) visitar(v); return; }
    const r = o as Record<string, unknown>;
    if (typeof r.full_slug === "string" && r.full_slug.toLowerCase() === objetivo && r.content && typeof r.content === "object") { hallada = r; return; }
    for (const v of Object.values(r)) visitar(v);
  };
  visitar(raiz);
  return hallada;
}

const textoPlano = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Convierte la página de una nota en el registro que se guarda. Devuelve `story: null` si la página no trae la nota. */
export function extraerNota(html: string, path: string, status: number): NotaDescargada {
  const salida: NotaDescargada = { path, status, story: null, ld: null };
  const mTitulo = html.match(/<title>([\s\S]*?)<\/title>/);
  if (mTitulo) salida.titulo = mTitulo[1].trim();
  const mDesc = html.match(/<meta name="description" content="([^"]*)"/);
  if (mDesc) salida.descripcion = mDesc[1];
  const mOg = html.match(/<meta property="og:image" content="([^"]*)"/);
  if (mOg) salida.ogImagen = mOg[1];

  // Datos estructurados.
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      for (const x of Array.isArray(d) ? d : [d]) {
        if (x && x["@type"] === "Article") {
          const autores = (Array.isArray(x.author) ? x.author : x.author ? [x.author] : []).map((a: { name?: string }) => a?.name).filter((n: unknown): n is string => typeof n === "string");
          salida.ld = { datePublished: x.datePublished, dateModified: x.dateModified, keywords: typeof x.keywords === "string" ? x.keywords : undefined, authors: autores };
        }
      }
    } catch {
      /* JSON-LD mal formado: se ignora, no es imprescindible */
    }
  }

  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return salida;
  let datos: { props?: { pageProps?: unknown } };
  try {
    datos = JSON.parse(m[1]);
  } catch {
    return salida;
  }
  const fullSlug = path.replace(/^\/+/, "");
  const nota = buscarNota(datos.props?.pageProps, fullSlug);
  if (!nota) return salida;

  const c = { ...(nota.content as Record<string, unknown>) };
  delete c.relevance; // posiciones en la portada vieja: no sirven
  c.author = reducirAutor(c.author);
  salida.story = {
    id: nota.id as number | string,
    uuid: String(nota.uuid ?? ""),
    name: String(nota.name ?? ""),
    slug: String(nota.slug ?? ""),
    full_slug: String(nota.full_slug ?? ""),
    created_at: (nota.created_at as string) ?? null,
    first_published_at: (nota.first_published_at as string) ?? null,
    published_at: (nota.published_at as string) ?? null,
    updated_at: (nota.updated_at as string) ?? null,
    tag_list: Array.isArray(nota.tag_list) ? (nota.tag_list as string[]) : [],
    content: c,
  };

  // Cuerpo vacío: se guarda el HTML del artículo por si el texto estaba en otro componente.
  const cuerpo = c.body as { html?: string; original?: string } | string | undefined;
  const textoCuerpo = typeof cuerpo === "string" ? cuerpo : `${cuerpo?.html ?? ""}${cuerpo?.original ?? ""}`;
  if (!textoPlano(textoCuerpo)) {
    const a = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    if (a) salida.articleHtml = a[1];
  }
  return salida;
}

/** Direcciones de nota (`<loc>`) de un mapa del sitio. */
export function direccionesDeMapa(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}
