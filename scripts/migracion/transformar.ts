/**
 * Convierte una nota descargada del sitio anterior (Storyblok) en lo que guarda el portal nuevo: título y resumen en texto plano,
 * cuerpo en HTML saneado (con las redes sociales, la galería, el audio y los videos resueltos), categoría, autor, fechas y la lista
 * de imágenes que hay que copiar. Funciones puras (sin red ni base de datos) para poder probarlas con notas reales.
 */
import sanitizeHtml from "sanitize-html";
import { parseEmbed } from "@/lib/embeds";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import type { NotaDescargada } from "./extraer";

/** Lo que el transformador necesita saber del mundo exterior. */
export type Contexto = {
  /** Dirección nueva (ya copiada a nuestro almacenamiento) de una imagen del sitio anterior; null si no se copió. */
  imagen: (urlOriginal: string) => string | null;
  /** Dirección nueva de una nota del sitio anterior, a partir de su ruta (`/seccion/slug`); null si no se conoce. */
  enlace: (rutaAntigua: string) => string | null;
};

/** Slug válido para el portal nuevo: minúsculas, sin tildes, solo letras, números y guiones, sin guiones en los bordes. */
export function normalizarSlug(s: string, idDeRespaldo = ""): string {
  let slug = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > 200) slug = slug.slice(0, 200).replace(/-[^-]*$/, "").replace(/-+$/, "");
  if (slug.length < 4) slug = `${slug}-${idDeRespaldo}`.replace(/^-+|-+$/g, "");
  return slug;
}

// Entidades HTML que aparecen en los textos del sitio anterior.
const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ntilde: "ñ", Ntilde: "Ñ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", uuml: "ü", iexcl: "¡", iquest: "¿", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", ndash: "–", mdash: "—", hellip: "…" };

/** Convierte las entidades HTML (`&amp;`, `&#x27;`, `&#233;`…) en sus caracteres. */
export function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e] ?? ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/** Texto plano de un fragmento HTML, con los espacios en limpio. */
export function aTextoPlano(html: string): string {
  const sinEtiquetas = sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {}, textFilter: (t) => `${t} ` });
  return decodificarEntidades(sinEtiquetas).replace(/\s+/g, " ").trim();
}

/** Recorta a `max` caracteres sin partir una palabra, con puntos suspensivos si se cortó. */
export function recortar(s: string, max: number): string {
  if (s.length <= max) return s;
  const corte = s.slice(0, max - 1);
  return `${corte.replace(/\s+\S*$/, "") || corte}…`;
}

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Dirección base de una imagen de Storyblok: sin las transformaciones que se añaden al final (`/m/filters:…`) ni el `?cv=`. */
export function urlBaseImagen(url: string): string {
  let u = url.trim();
  if (u.startsWith("//")) u = `https:${u}`;
  u = u.replace(/^(https?:)\/{3,}/i, "$1//"); // «https:///a.storyblok.com/…» (una barra de más, en notas viejas)
  u = u.replace(/^http:\/\//i, "https://").split("?")[0].split("#")[0];
  const i = u.indexOf("/m/");
  if (i > 0 && /\/f\/\d+\//.test(u)) u = u.slice(0, i);
  return u;
}

/** Hosts de los que se copian las imágenes (el de Storyblok y los pocos que usó la redacción). */
const HOSTS_COPIABLES = /^https:\/\/(a\.storyblok\.com|s3\.amazonaws\.com\/a\.storyblok\.com|storage\.googleapis\.com|www\.contextoganadero\.com|contextoganadero\.com)\//i;
export const esImagenCopiable = (url: string) => HOSTS_COPIABLES.test(urlBaseImagen(url));

// Enlace a una publicación de otra red, en lugar de su incrustación (que depende de scripts de terceros).
const enlaceExterno = (href: string, texto: string) => `<p><a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">${texto}</a></p>`;

/** Resuelve lo que el sitio anterior incrustaba: redes sociales, scripts, marcos de terceros, imágenes y enlaces internos. */
export function limpiarHtmlAntiguo(entrada: string, ctx: Contexto): string {
  let h = entrada ?? "";
  // Muchas notas viejas separan los párrafos con una línea que solo trae un espacio duro (\u00a0): en Markdown eso no corta el párrafo y
  // todo el texto quedaba en un solo bloque. Dentro de cada <p>, esa línea pasa a ser un corte de párrafo de verdad.
  h = h.replace(/<p>([\s\S]*?)<\/p>/gi, (_m, dentro: string) => `<p>${dentro.replace(/\n[ \t\u00a0]*\u00a0[ \t\u00a0]*\n/g, "</p><p>")}</p>`);
  // Scripts de terceros (Twitter/X, Instagram, TikTok): el portal nuevo no los carga; la cita queda como texto con su enlace.
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  // Instagram y TikTok: la cita completa es una maraña de estilos; basta el enlace a la publicación.
  h = h.replace(/<blockquote\b[^>]*instagram-media[^>]*>[\s\S]*?<\/blockquote>/gi, (bloque) => {
    const href = bloque.match(/data-instgrm-permalink="([^"]+)"/)?.[1] ?? bloque.match(/href="(https:\/\/www\.instagram\.com\/[^"]+)"/)?.[1];
    return href ? enlaceExterno(decodificarEntidades(href).split("?")[0], "Ver la publicación en Instagram") : "";
  });
  h = h.replace(/<blockquote\b[^>]*tiktok-embed[^>]*>[\s\S]*?<\/blockquote>/gi, (bloque) => {
    const href = bloque.match(/\bcite="([^"]+)"/)?.[1];
    return href ? enlaceExterno(decodificarEntidades(href), "Ver el video en TikTok") : "";
  });
  // Marcos (iframes): YouTube y Vimeo se conservan por su dominio sin cookies; SoundCloud y lo propio, con su altura; Facebook y el resto
  // pasan a ser un enlace. El contenido que algunas notas dejaron DENTRO del marco (restos de HTML) se descarta. Cada resultado se guarda aparte
  // y se coloca al final, para que el resto de las limpiezas no lo toque.
  const marcos: string[] = [];
  const guardar = (html: string) => `\u0001${marcos.push(html) - 1}\u0001`;
  const convertirMarco = (atributos: string): string => {
    const src = decodificarEntidades(atributos.match(/\bsrc="([^"]+)"/i)?.[1] ?? "");
    if (!src) return "";
    const embed = parseEmbed(src.startsWith("//") ? `https:${src}` : src);
    if (embed) {
      const titulo = decodificarEntidades(atributos.match(/\btitle="([^"]*)"/i)?.[1] ?? "") || "Video";
      return guardar(`<figure class="lx-embed"><iframe src="${embed.src}" title="${escAttr(titulo)}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></figure>`);
    }
    const fb = src.match(/facebook\.com\/plugins\/(post|video)\.php\?(.*)$/i);
    if (fb) {
      const href = new URLSearchParams(fb[2]).get("href");
      if (href) return guardar(enlaceExterno(href.replace("://web.facebook.com", "://www.facebook.com"), fb[1] === "video" ? "Ver el video en Facebook" : "Ver la publicación en Facebook"));
    }
    // Reproductor de SoundCloud y contenidos propios de `static.contextoganadero.com`: se dejan incrustados con su altura original.
    const propio = src.match(/^https:\/\/(w\.soundcloud\.com|static\.contextoganadero\.com)\//i);
    if (propio) {
      const esAudio = propio[1].toLowerCase().startsWith("w.");
      const alto = atributos.match(/\bheight="(\d{2,4})"/i)?.[1] ?? (esAudio ? "166" : "600");
      const titulo = decodificarEntidades(atributos.match(/\btitle="([^"]*)"/i)?.[1] ?? "") || (esAudio ? "Audio" : "Contenido interactivo");
      return guardar(`<figure class="lx-embed"><iframe src="${escAttr(src)}" title="${escAttr(titulo)}" height="${alto}" loading="lazy" allow="autoplay"></iframe></figure>`);
    }
    return /^https?:\/\//i.test(src) ? guardar(enlaceExterno(src, "Ver el contenido incrustado")) : "";
  };
  // Marco con su cierre (el contenido de en medio, de hasta 400 caracteres y sin otro marco, se descarta) o marco sin cerrar.
  h = h.replace(/<iframe\b([^>]*)>(?:(?:(?!<iframe)[\s\S]){0,400}?<\/iframe>)?/gi, (_m, atributos: string) => convertirMarco(atributos));
  h = h.replace(/<\/iframe>/gi, "");
  // Imágenes: se sustituye la dirección por la copia propia y se pide carga diferida.
  h = h.replace(/<img\b[^>]*>/gi, (etiqueta) => {
    const src = etiqueta.match(/\bsrc="([^"]+)"/i)?.[1];
    if (!src) return "";
    const nueva = esImagenCopiable(decodificarEntidades(src)) ? ctx.imagen(urlBaseImagen(decodificarEntidades(src))) : null;
    const alt = decodificarEntidades(etiqueta.match(/\balt="([^"]*)"/i)?.[1] ?? "");
    return `<img src="${escAttr(nueva ?? decodificarEntidades(src))}" alt="${escAttr(alt)}" loading="lazy">`;
  });
  // Enlaces a una imagen de Storyblok (la foto en tamaño completo): apuntan a la copia propia.
  const copias = new Map<string, string>();
  h = h.replace(/\bhref="((?:https?:)?\/\/(?:a\.storyblok\.com|s3\.amazonaws\.com\/a\.storyblok\.com)\/[^"]+)"/gi, (m, url: string) => {
    const base = urlBaseImagen(decodificarEntidades(url));
    const nueva = /\.(?:jpe?g|png|webp|gif)$/i.test(base) && esImagenCopiable(base) ? ctx.imagen(base) : null;
    if (nueva) copias.set(url, nueva);
    return nueva ? `href="${escAttr(nueva)}"` : m;
  });
  // Si el texto del enlace era la propia dirección, se muestra la nueva.
  for (const [vieja, nueva] of copias) h = h.split(`>${vieja}<`).join(`>${escAttr(nueva)}<`);
  // Enlaces a otras notas del sitio anterior: pasan a la dirección nueva (sin esperar al redireccionamiento).
  h = h.replace(/\bhref="(?:https?:\/\/(?:www\.)?contextoganadero\.com)?(\/[^"#?]+)((?:[?#][^"]*)?)"/gi, (m, ruta: string) => {
    let r = ruta;
    try {
      r = decodeURIComponent(ruta);
    } catch {
      /* se deja tal cual */
    }
    const nueva = ctx.enlace(r.replace(/\/+$/, ""));
    return nueva ? `href="${escAttr(nueva)}"` : m;
  });
  // Restos de etiquetas que la redacción escribió como TEXTO (`&lt;br&gt;`, `&lt;/iframe`): se quitan; `&lt;0,3 %` y similares se respetan.
  h = h.replace(/&lt;\*?\/?(?:br|p|iframe|figure|div|h[1-6])\s*\/?(?:&gt;|&lt;)?/gi, "");
  // Párrafos vacíos, separadores sobrantes y espacios de relleno.
  h = h.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "");
  h = h.replace(/<div>(?:\s|&nbsp;|<br\s*\/?>)*<\/div>/gi, "");
  return h.replace(/\u0001(\d+)\u0001/g, (_m, n: string) => marcos[Number(n)] ?? "").trim();
}

/** Quita del principio del cuerpo el resumen repetido en cursiva entre dos líneas (`<hr><p><em>resumen</em></p><hr>`), que el portal nuevo ya muestra aparte. */
export function sinResumenRepetido(html: string, resumen: string): string {
  const m = html.match(/^\s*(?:<hr\s*\/?>\s*)?<p>\s*<em>([\s\S]*?)<\/em>\s*<\/p>\s*(?:<hr\s*\/?>)?/i);
  if (!m || !resumen) return html;
  const a = aTextoPlano(m[1]).toLowerCase();
  const b = resumen.toLowerCase();
  if (a.length < 20 || !(a === b || a.startsWith(b.slice(0, 60)) || b.startsWith(a.slice(0, 60)))) return html;
  return html.slice(m[0].length).trim();
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const texto = (v: unknown): string => (typeof v === "string" ? v : "");

/** Texto alternativo de la portada: el de la imagen si es una descripción razonable; las notas viejas traían ahí una lista de palabras clave. */
export function altDePortada(content: Obj, titulo: string): string {
  const ti = obj(content.teaser_image);
  for (const c of [texto(ti.alt), texto(ti.title)]) {
    const t = aTextoPlano(c);
    if (t && t.length <= 160 && (t.match(/,/g) ?? []).length < 4) return t;
  }
  return recortar(titulo, 160);
}

/**
 * Pie de foto y crédito de la imagen de portada. Las notas nuevas lo traen en `pie_foto`; las viejas, en el título de la imagen
 * (cuando es distinto del texto alternativo, que ahí solo repite el tema).
 */
export function pieDeFoto(content: Obj, titulo = ""): string | null {
  const ti = obj(content.teaser_image);
  let pie = aTextoPlano(texto(content.pie_foto));
  if (!pie) {
    const t = aTextoPlano(texto(ti.title));
    if (t.length >= 12 && t.length <= 300 && t !== aTextoPlano(texto(ti.alt)) && t.toLowerCase() !== titulo.toLowerCase()) pie = t;
  }
  const credito = aTextoPlano(texto(ti.copyright) || texto(ti.source));
  if (pie && credito && !pie.toLowerCase().includes(credito.toLowerCase())) return `${pie} · Foto: ${credito}`;
  if (pie) return pie;
  return credito ? `Foto: ${credito}` : null;
}

/** Audio de la nota (campo `audio`: lista o un solo archivo); direcciones de los archivos. */
function audiosDe(content: Obj): string[] {
  const a = content.audio;
  const lista = Array.isArray(a) ? a : a ? [a] : [];
  return lista.map((x) => texto(obj(x).filename)).filter((u) => /^https?:\/\//i.test(u));
}

/** Galería de fotos, videos de YouTube y audios de la nota, convertidos en HTML para ponerlos al final del cuerpo. */
export function bloquesMultimedia(content: Obj, ctx: Contexto): string {
  const partes: string[] = [];
  for (const g of Array.isArray(content.gallery) ? content.gallery : []) {
    for (const it of Array.isArray(obj(g).items) ? (obj(g).items as unknown[]) : []) {
      const i = obj(it);
      const titulo = aTextoPlano(texto(i.title));
      if (i.component === "YouTubeVideo" && texto(i.video_id)) {
        const embed = parseEmbed(`https://www.youtube.com/watch?v=${texto(i.video_id)}`);
        if (embed) partes.push(`<figure class="lx-embed"><iframe src="${embed.src}" title="${escAttr(titulo || "Video")}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>${titulo ? `<figcaption>${escAttr(titulo)}</figcaption>` : ""}</figure>`);
      } else if (texto(obj(i.image).filename)) {
        const original = urlBaseImagen(texto(obj(i.image).filename));
        const nueva = esImagenCopiable(original) ? ctx.imagen(original) : null;
        const alt = aTextoPlano(texto(i.alt_text) || texto(obj(i.image).alt)) || titulo;
        partes.push(`<figure><img src="${escAttr(nueva ?? original)}" alt="${escAttr(alt)}" loading="lazy">${titulo ? `<figcaption>${escAttr(titulo)}</figcaption>` : ""}</figure>`);
      }
    }
  }
  for (const url of audiosDe(content)) {
    const original = urlBaseImagen(url);
    partes.push(`<figure><audio controls preload="none" src="${escAttr(ctx.imagen(original) ?? original)}"></audio></figure>`);
  }
  return partes.join("\n");
}

/** Cuerpo de la nota ya listo para guardar: HTML del sitio anterior limpio, más la galería, los videos y los audios, todo saneado. */
export function construirCuerpo(reg: NotaDescargada, resumen: string, ctx: Contexto): string {
  const c = obj(reg.story?.content);
  const cuerpo = obj(c.body);
  let crudo = texto(cuerpo.html);
  if (!aTextoPlano(crudo)) crudo = texto(cuerpo.original) ? `<p>${texto(cuerpo.original).replace(/\n{2,}/g, "</p><p>")}</p>` : (reg.articleHtml ?? "");
  const limpio = sinResumenRepetido(limpiarHtmlAntiguo(crudo, ctx), resumen);
  return sanitizeArticleHtml([limpio, bloquesMultimedia(c, ctx)].filter(Boolean).join("\n")).replace(/<p>(?:\s|&nbsp;|\u00a0|<br\s*\/?>)*<\/p>/gi, "").trim();
}

/** Direcciones de todas las imágenes y audios que hay que copiar para una nota (portada, cuerpo, galería, audio y foto del autor). */
export function recursosDe(reg: NotaDescargada): string[] {
  const vistas = new Set<string>();
  const ctx: Contexto = { imagen: (u) => (vistas.add(u), null), enlace: () => null };
  construirCuerpo(reg, "", ctx);
  const c = obj(reg.story?.content);
  const portada = texto(obj(c.teaser_image).filename);
  if (portada && esImagenCopiable(portada)) vistas.add(urlBaseImagen(portada));
  return [...vistas];
}

/** Datos del autor de una nota (el registro de Storyblok trae el autor completo o solo su identificador). */
export function autorDe(reg: NotaDescargada, porUuid: Map<string, { name: string; slug: string; image: string | null }>): { nombre: string; slug: string; imagen: string | null } {
  const a = obj(reg.story?.content.author);
  const resuelto = typeof a.name === "string" ? { name: a.name, slug: texto(a.slug), image: (a.image as string | null) ?? null } : porUuid.get(texto(a.uuid) || texto(reg.story?.content.author));
  // Un «nombre» de autor de más de 60 letras es un titular pegado por error en el campo: se atribuye a la redacción.
  if (resuelto && aTextoPlano(resuelto.name).length > 60) return { nombre: "CONtexto ganadero", slug: "contexto-ganadero", imagen: null };
  if (resuelto) return { nombre: aTextoPlano(resuelto.name), slug: normalizarSlug(resuelto.slug || resuelto.name), imagen: resuelto.image };
  const nombre = reg.ld?.authors[0];
  return nombre ? { nombre, slug: normalizarSlug(nombre), imagen: null } : { nombre: "CONtexto ganadero", slug: "contexto-ganadero", imagen: null };
}

/** Fecha válida o null. */
export function fecha(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Campos de la nota nueva que salen directamente del registro antiguo (sin imágenes ni categoría, que dependen de más contexto). */
export function camposBasicos(reg: NotaDescargada): {
  titulo: string; resumen: string; metaTitulo: string | null; metaDescripcion: string | null; etiquetas: string[];
  publicadaEn: Date | null; creadaEn: Date | null; actualizadaEn: Date | null; portadaAlt: string; pie: string | null;
} {
  const st = reg.story!;
  const c = obj(st.content);
  const titulo = aTextoPlano(texto(c.title) || st.name);
  const sum = obj(c.summary);
  let resumen = aTextoPlano(texto(sum.html) || texto(sum.original));
  const seo = obj(c.seo_meta);
  // El sitio anterior guardaba el título SEO con su sufijo («… | CONtexto Ganadero»); el portal nuevo ya lo añade.
  const metaTitulo = aTextoPlano(texto(seo.title)).replace(/\s*[|·–—-]\s*CONtexto\s+ganadero\s*$/i, "").trim();
  const metaDescripcion = aTextoPlano(texto(seo.description));
  // Resumen ausente o inservible («.», una palabra): se usa la descripción SEO o el arranque del cuerpo.
  if (resumen.length < 30) {
    const arranque = recortar(aTextoPlano(texto(obj(c.body).html)), 220);
    resumen = metaDescripcion.length >= 30 ? metaDescripcion : arranque.length > resumen.length ? arranque : resumen;
  }
  const etiquetas = [...new Set((st.tag_list ?? []).map((t) => aTextoPlano(t).toLowerCase()).filter(Boolean))].slice(0, 12);
  return {
    titulo,
    resumen: recortar(resumen, 600),
    metaTitulo: metaTitulo && metaTitulo !== titulo ? recortar(metaTitulo, 200) : null,
    metaDescripcion: metaDescripcion ? recortar(metaDescripcion, 320) : null,
    etiquetas,
    publicadaEn: fecha(st.first_published_at) ?? fecha(reg.ld?.datePublished) ?? fecha(st.published_at),
    creadaEn: fecha(st.created_at),
    actualizadaEn: fecha(reg.ld?.dateModified) ?? fecha(st.published_at) ?? fecha(st.first_published_at),
    portadaAlt: altDePortada(c, titulo),
    pie: pieDeFoto(c, titulo),
  };
}
