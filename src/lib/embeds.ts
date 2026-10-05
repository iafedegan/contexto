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

export type Embed = { tipo: "youtube" | "vimeo"; id: string; src: string };

// Patrones de enlaces de YouTube (watch, live, youtu.be, embed y shorts) que capturan el id del video.
const YT = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/live\/|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,20})/,
];
// Patrón de enlaces de Vimeo que captura el id numérico.
const VIMEO = [/vimeo\.com\/(?:video\/)?(\d{6,12})/];

// Reconoce un enlace de video y devuelve cómo incrustarlo; null si no es de un servicio admitido.
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
  return null;
}

/**
 * Figura lista para insertar en el cuerpo. `loading="lazy"` es obligatorio: un
 * iframe de vídeo pesa más que el resto del artículo junto y hundiría el LCP.
 */
export function embedHtml(embed: Embed, titulo = "Vídeo"): string {
  return [
    '<figure class="lx-embed">',
    `  <iframe src="${embed.src}" title="${titulo.replace(/"/g, "&quot;")}" loading="lazy"`,
    '    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
    '    referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>',
    "  <figcaption>Pie del vídeo · Fuente</figcaption>",
    "</figure>",
  ].join("\n");
}
