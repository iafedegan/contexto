/**
 * Incrustación de vídeo (RT-09). Sin `server-only`: lo usa el editor.
 *
 * Solo se admiten proveedores conocidos y se construye la URL a mano a partir
 * del identificador extraído. Nunca se pega el HTML que traiga el usuario: eso
 * sería inyectar un <script> de terceros en el artículo.
 *
 * YouTube se sirve por `youtube-nocookie.com`: no coloca cookies de
 * seguimiento hasta que el lector le da al play, lo que evita depender del
 * consentimiento para que el artículo se vea completo.
 */

export type Embed = {
  tipo: "youtube" | "vimeo" | "x" | "instagram" | "facebook" | "tiktok" | "linkedin";
  id: string;
  src: string;
  /** Alto fijo en px de las publicaciones de redes (que no son 16:9). Sin él, el video va en 16:9. */
  alto?: number;
};

// Patrones de enlaces de YouTube (watch, live, youtu.be, embed y shorts) que capturan el id del video.
const YT = [
  /(?:youtube\.com\/watch\?(?:[^#\s]*&)?v=|youtube\.com\/live\/|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,20})/,
];
// Patrón de enlaces de Vimeo que captura el id numérico.
const VIMEO = [/vimeo\.com\/(?:video\/)?(\d{6,12})/];

// Reconoce un enlace de video o de red social y devuelve cómo incrustarlo; null si no es de un servicio admitido.
export function parseEmbed(url: string): Embed | null {
  const limpia = url.trim();
  for (const re of YT) {
    const m = limpia.match(re);
    if (m) {
      return {
        tipo: "youtube",
        id: m[1],
        src: `https://www.youtube-nocookie.com/embed/${m[1]}`,
      };
    }
  }
  for (const re of VIMEO) {
    const m = limpia.match(re);
    if (m) return { tipo: "vimeo", id: m[1], src: `https://player.vimeo.com/video/${m[1]}` };
  }
  // Redes sociales: se usa la página de incrustación oficial de cada una (sin pegar el código que ellas dan, que trae scripts).
  const x = limpia.match(/^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/\w+\/status\/(\d{5,25})/i);
  if (x) return { tipo: "x", id: x[1], src: `https://platform.twitter.com/embed/Tweet.html?id=${x[1]}&dnt=true`, alto: 560 };
  const ig = limpia.match(/^https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]{5,30})/i);
  if (ig) return { tipo: "instagram", id: ig[2], src: `https://www.instagram.com/${ig[1].toLowerCase()}/${ig[2]}/embed/`, alto: 660 };
  const tt = limpia.match(/^https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d{8,25})/i);
  if (tt) return { tipo: "tiktok", id: tt[1], src: `https://www.tiktok.com/embed/v2/${tt[1]}`, alto: 740 };
  const li = limpia.match(/^https?:\/\/(?:[\w]+\.)?linkedin\.com\/(?:posts\/[^?#\s]*?-(share|ugcPost|activity)-(\d{10,25})|embed\/feed\/update\/urn:li:(share|ugcPost|activity):(\d{10,25}))/i);
  if (li) {
    const tipo = li[1] ?? li[3];
    const id = li[2] ?? li[4];
    return { tipo: "linkedin", id, src: `https://www.linkedin.com/embed/feed/update/urn:li:${tipo}:${id}`, alto: 620 };
  }
  const fb = limpia.match(/^https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch)\/\S+/i);
  if (fb && /(\/posts\/|\/videos\/|\/watch|\/reel\/|\/photo|story\.php|permalink|\/share\/|fb\.watch)/i.test(limpia)) {
    const esVideo = /(\/videos\/|\/watch|\/reel\/|fb\.watch)/i.test(limpia);
    const href = encodeURIComponent(limpia);
    return esVideo
      ? { tipo: "facebook", id: limpia, src: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=560` }
      : { tipo: "facebook", id: limpia, src: `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500`, alto: 600 };
  }
  return null;
}

/** Nombre corto del servicio, para los avisos y el título accesible. */
export const NOMBRE_EMBED: Record<Embed["tipo"], string> = { youtube: "YouTube", vimeo: "Vimeo", x: "X", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn" };

/**
 * Figura lista para insertar en el cuerpo. `loading="lazy"` es obligatorio: un
 * iframe de vídeo pesa más que el resto del artículo junto y hundiría el LCP.
 * `ancho` es el porcentaje del ancho del texto que ocupa (por defecto, todo); `pie: false` omite el pie.
 */
export function embedHtml(embed: Embed, titulo = "Vídeo", opciones: { ancho?: number; pie?: string | false } = {}): string {
  const ancho = Math.round(Math.min(100, Math.max(20, opciones.ancho ?? 100)));
  const pie = opciones.pie === undefined ? "Pie del vídeo · Fuente" : opciones.pie;
  return [
    `<figure class="lx-embed${embed.alto ? " lx-embed-social" : ""}"${ancho < 100 ? ` style="width:${ancho}%"` : ""}>`,
    `  <iframe src="${embed.src.replace(/"/g, "&quot;")}" title="${titulo.replace(/"/g, "&quot;")}" loading="lazy"${embed.alto ? ` height="${embed.alto}"` : ""}`,
    '    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
    '    referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>',
    ...(pie === false ? [] : [`  <figcaption>${pie.replace(/</g, "&lt;")}</figcaption>`]),
    "</figure>",
  ].join("\n");
}

/**
 * Los párrafos que traen SOLO un enlace de video o de red social (pegado como texto o como enlace) se vuelven la publicación incrustada. Se usa al
 * pintar la nota y en el editor; lo que no es un servicio admitido queda como enlace.
 */
export function incrustarEnlaces(html: string): string {
  return incrustarCodigoPegado(html).replace(/<p[^>]*>\s*(?:<a\s[^>]*href="([^"]+)"[^>]*>[^<]*<\/a>|(https?:\/\/[^\s<]+))\s*(?:<br\s*\/?>\s*)?<\/p>/gi, (todo, href: string | undefined, texto: string | undefined) => {
    const url = (href ?? texto ?? "").replace(/&amp;/g, "&");
    const e = parseEmbed(url);
    return e ? embedHtml(e, NOMBRE_EMBED[e.tipo], { pie: false }) : todo;
  });
}

/* ------------------------------------------------------------------ Código de incrustación pegado */

// Marcas del código que dan X, Instagram, TikTok y Facebook para incrustar («Copiar código»).
const MARCAS_CODIGO = /twitter-tweet|instagram-media|tiktok-embed|fb-post|fb-video|<iframe|&lt;iframe/i;
const URL_EN_TEXTO = /https?:\/\/[^\s"'<>\\]+/gi;

// Quita las entidades HTML más comunes de un enlace que venía dentro de código pegado.
const deEntidades = (u: string) => u.replace(/&amp;/g, "&").replace(/&quot;.*$/, "").replace(/&#0?39;.*$/, "").replace(/&lt;.*$/, "").replace(/&gt;.*$/, "");

/**
 * Si el texto es el CÓDIGO de incrustación de una red (el «<blockquote class="twitter-tweet">… <script …>» que se copia de X, Instagram, TikTok o
 * Facebook) o de un video (<iframe>), devuelve la publicación a incrustar. Nunca se pega el código tal cual: solo se toma su enlace.
 */
export function embedDeCodigo(texto: string): Embed | null {
  if (!MARCAS_CODIGO.test(texto)) return null;
  for (const m of texto.matchAll(URL_EN_TEXTO)) {
    const e = parseEmbed(deEntidades(m[0]));
    if (e) return e;
  }
  return null;
}

/**
 * Notas donde ese código se pegó como TEXTO (se ve «<blockquote class="twitter-tweet">…» en la página): se reemplaza todo el bloque, desde su
 * apertura hasta el «</blockquote>» (y el «<script>» que lo sigue), por la publicación incrustada.
 */
export function incrustarCodigoPegado(html: string): string {
  const apertura = /(?:&lt;|<)blockquote[^]{0,200}?(?:twitter-tweet|instagram-media|tiktok-embed)/i;
  let salida = html;
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const m = apertura.exec(salida);
    if (!m) break;
    const ini = m.index;
    const cierre = /(?:&lt;|<)\/blockquote(?:&gt;|>)/i.exec(salida.slice(ini));
    if (!cierre) break;
    let fin = ini + cierre.index + cierre[0].length;
    // El <script> que acompaña al código (si viene justo después).
    const script = /^[^]{0,80}?(?:&lt;|<)\/script(?:&gt;|>)/i.exec(salida.slice(fin));
    if (script && /script/i.test(script[0])) fin += script[0].length;
    const bloque = salida.slice(ini, fin);
    const e = embedDeCodigo(bloque.replace(/<[^>]+>/g, " ")) ?? embedDeCodigo(bloque);
    // Si el bloque no trae un enlace reconocible se deja como estaba (y se sigue con lo demás).
    if (!e) break;
    // Se amplía al párrafo que lo contiene si solo hay ese código en él.
    let a = ini;
    let b = fin;
    const antes = /<p[^>]*>\s*$/i.exec(salida.slice(0, ini));
    if (antes) a = ini - antes[0].length;
    const despues = /^\s*<\/p>/i.exec(salida.slice(fin));
    if (despues) b = fin + despues[0].length;
    salida = salida.slice(0, a) + embedHtml(e, NOMBRE_EMBED[e.tipo], { pie: false }) + salida.slice(b);
  }
  return salida;
}
