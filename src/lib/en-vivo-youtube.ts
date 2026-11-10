/**
 * Lee la página `/live` de un canal de YouTube (https://www.youtube.com/@canal/live). Cuando el canal transmite, esa dirección abre su directo
 * y la página trae `"liveBroadcastDetails":{"isLiveNow":true…}`; si tiene uno programado, trae `"isUpcoming":true` y la hora; si no, abre el
 * canal sin video. Sin clave de la API de YouTube (y sin su cuota): es la misma página que ve cualquiera. Puro, sin red: se prueba aparte.
 */

export type LecturaCanal =
  | { estado: "vivo"; videoId: string; titulo: string }
  | { estado: "programado"; videoId: string; titulo: string; programado: string }
  | { estado: "sin" };

const decodificar = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

export function leerPaginaLive(html: string): LecturaCanal {
  const id = html.match(/"videoDetails":\{"videoId":"([A-Za-z0-9_-]{11})"/)?.[1] ?? html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/)?.[1];
  if (!id) return { estado: "sin" };
  const titulo = decodificar(html.match(/<meta name="title" content="([^"]*)"/)?.[1] ?? "").trim().slice(0, 140);
  if (/"liveBroadcastDetails":\{[^}]*"isLiveNow":true/.test(html)) return { estado: "vivo", videoId: id, titulo };
  const prog = html.match(/"scheduledStartTime":"(\d{9,11})"/)?.[1];
  if (/"isUpcoming":true/.test(html) && prog) {
    const cuando = new Date(Number(prog) * 1000);
    // Un programado que ya pasó hace más de un día es un anuncio viejo que YouTube sigue mostrando: no cuenta.
    if (cuando.getTime() > Date.now() - 86_400_000) return { estado: "programado", videoId: id, titulo, programado: cuando.toISOString() };
  }
  return { estado: "sin" };
}
