/**
 * Tipos de audio y video que el asistente acepta para transcribir una entrevista.
 * Gemini lee tanto audio como video (de este último solo se usa lo que se oye).
 */
const AUDIO: Record<string, string> = {
  mp3: "audio/mpeg", mpeg: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac",
  wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", webm: "audio/webm", flac: "audio/flac",
};
const VIDEO: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/mov", mpeg: "video/mpeg", mpg: "video/mpg",
  avi: "video/avi", wmv: "video/wmv", flv: "video/x-flv", "3gp": "video/3gpp", webm: "video/webm",
};
const VIDEO_ADMITIDOS = new Set(Object.values(VIDEO));
const VIDEO_ALIAS: Record<string, string> = { "video/quicktime": "video/mov", "video/x-msvideo": "video/avi", "video/x-ms-wmv": "video/wmv", "video/x-m4v": "video/mp4" };

export const FORMATOS_MEDIA = "audio (MP3, M4A, WAV, OGG, WEBM, AAC, FLAC) o video (MP4, MOV, WEBM, MPEG, AVI, WMV, 3GP)";

/**
 * Tipo MIME que se le dice al modelo, o null si no es un formato admitido.
 * `declared` es el tipo que reporta quien lo envía; uno que empiece por «video/» manda sobre la extensión
 * (así un `.mp4` o `.webm` de video no se confunde con audio).
 */
export function mimeMedia(name: string, declared = ""): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const dec = declared.toLowerCase();
  if (dec.startsWith("video/")) {
    if (VIDEO[ext]) return VIDEO[ext];
    const n = VIDEO_ALIAS[dec] ?? dec;
    return VIDEO_ADMITIDOS.has(n) ? n : null;
  }
  if (AUDIO[ext]) return AUDIO[ext];
  if (VIDEO[ext]) return VIDEO[ext]; // .mov, .avi, .m4v…: extensiones que solo existen como video
  if (dec.startsWith("audio/")) return dec === "audio/x-m4a" || dec === "audio/m4a" ? "audio/mp4" : declared;
  return null;
}

export const esMimeVideo = (mime: string) => mime.startsWith("video/");
