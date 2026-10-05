/**
 * Saca el audio de un video EN EL NAVEGADOR y lo deja como un WAV pequeño (mono, calidad de voz).
 *
 * Por qué: un video de celular pesa cientos de MB, pero el modelo solo necesita lo que se oye. Así el video
 * nunca se sube (más rápido, más barato y más privado) y entra en el tope de 20 MB por archivo.
 * Solo usa APIs del navegador (decodeAudioData); no hay dependencias.
 */

/** `fatal`: no tiene caso reintentar de otra forma (video demasiado largo o pesado). */
export class ExtraerAudioError extends Error {
  constructor(message: string, readonly fatal = false) {
    super(message);
    this.name = "ExtraerAudioError";
  }
}

/** Frecuencias a probar, de mayor a menor calidad: a 16 kHz caben ≈10 min en 20 MB; a 8 kHz, ≈21 min. */
const FRECUENCIAS = [16000, 12000, 8000];
/** Se lee el archivo entero en memoria: más allá de esto el navegador (sobre todo en celular) se queda sin ella. */
const MAX_VIDEO = 800 * 1024 * 1024;

/** ¿Este archivo es un video (y no un audio)? Los `.mp4`/`.webm` sin tipo declarado se tratan como video. */
export function esVideo(f: File): boolean {
  return f.type.startsWith("video/") || (!f.type.startsWith("audio/") && /\.(mp4|m4v|mov|mpe?g|avi|wmv|flv|3gp|webm)$/i.test(f.name));
}

/** Pasa el audio decodificado a mono y a `rate` Hz promediando muestras (basta para voz). */
function aMono(pcm: AudioBuffer, rate: number): Float32Array {
  // Se toman los datos de cada canal y se calcula cuántas muestras originales equivalen a una muestra nueva.
  const canales = Array.from({ length: pcm.numberOfChannels }, (_, c) => pcm.getChannelData(c));
  const razon = pcm.sampleRate / rate;
  const n = Math.floor(pcm.length / razon);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ini = Math.floor(i * razon);
    const fin = Math.max(ini + 1, Math.min(pcm.length, Math.floor((i + 1) * razon)));
    let suma = 0;
    for (const ch of canales) for (let j = ini; j < fin; j++) suma += ch[j];
    out[i] = suma / (canales.length * (fin - ini));
  }
  return out;
}

/** WAV PCM de 16 bits (cabecera de 44 bytes). */
function aWav(muestras: Float32Array, rate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(buf);
  // Escribe una cadena de texto (marca de formato) byte a byte en la cabecera WAV.
  const txt = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, "RIFF"); v.setUint32(4, 36 + muestras.length * 2, true); txt(8, "WAVE");
  txt(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, "data"); v.setUint32(40, muestras.length * 2, true);
  for (let i = 0; i < muestras.length; i++) {
    const m = Math.max(-1, Math.min(1, muestras[i]));
    v.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }
  return buf;
}

/**
 * Devuelve un WAV mono con el audio del video, de a lo sumo `maxBytes`.
 * Lanza `ExtraerAudioError`: con `fatal` si el video es demasiado pesado o largo; sin él, si el navegador no
 * pudo leer ese formato (entonces conviene mandar el video tal cual, si es chico).
 */
export async function extraerAudioDeVideo(video: File, maxBytes: number): Promise<File> {
  if (video.size > MAX_VIDEO) {
    throw new ExtraerAudioError(`El video pesa ${Math.round(video.size / 1048576)} MB: es demasiado para procesarlo en el navegador. Recórtalo o súbelo solo en audio.`, true);
  }
  const Ctx = typeof window === "undefined" ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new ExtraerAudioError("Este navegador no puede extraer el audio de un video.");

  const ctx = new Ctx();
  let pcm: AudioBuffer;
  try {
    pcm = await ctx.decodeAudioData(await video.arrayBuffer());
  } catch {
    throw new ExtraerAudioError("El navegador no pudo leer el audio de este video.");
  } finally {
    void ctx.close().catch(() => {});
  }
  if (pcm.duration < 0.5) throw new ExtraerAudioError("El video no tiene audio.");

  // Se elige la frecuencia de muestreo más alta con la que el archivo WAV resultante no pase del tamaño máximo.
  const rate = FRECUENCIAS.find((r) => 44 + Math.ceil(pcm.duration * r) * 2 <= maxBytes);
  if (!rate) {
    throw new ExtraerAudioError(`La grabación dura ${Math.ceil(pcm.duration / 60)} min: el máximo son unos 20 min por archivo. Recórtala o divídela.`, true);
  }
  const nombre = video.name.replace(/\.[a-z0-9]+$/i, "") || "entrevista";
  return new File([aWav(aMono(pcm, rate), rate)], `${nombre}.wav`, { type: "audio/wav" });
}

/** Parte un WAV mono de 16 bits en trozos de a lo sumo `maxBytes` (cada uno con su cabecera), para mandarlos directo al servidor. */
export async function partirWav(wav: File, maxBytes: number): Promise<File[]> {
  if (wav.size <= maxBytes) return [wav];
  const buf = await wav.arrayBuffer();
  const rate = new DataView(buf).getUint32(24, true);
  const datos = buf.slice(44);
  const por = Math.floor((maxBytes - 44) / 2) * 2;
  const base = wav.name.replace(/\.wav$/i, "");
  const out: File[] = [];
  for (let i = 0, k = 1; i < datos.byteLength; i += por, k++) {
    const parte = datos.slice(i, i + por);
    const h = new ArrayBuffer(44);
    const v = new DataView(h);
    // Escribe una marca de texto en la cabecera WAV de cada trozo.
    const t = (o: number, s: string) => { for (let j = 0; j < s.length; j++) v.setUint8(o + j, s.charCodeAt(j)); };
    t(0, "RIFF"); v.setUint32(4, 36 + parte.byteLength, true); t(8, "WAVE"); t(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    t(36, "data"); v.setUint32(40, parte.byteLength, true);
    out.push(new File([h, parte], `${base}-${k}.wav`, { type: "audio/wav" }));
  }
  return out;
}

/** Duración en segundos de un WAV mono de 16 bits (como los que genera este archivo): lo que pesan los datos entre lo que dura cada segundo. */
export async function duracionWav(wav: File): Promise<number> {
  const rate = new DataView(await wav.slice(0, 44).arrayBuffer()).getUint32(24, true);
  return rate > 0 ? Math.max(0, wav.size - 44) / (rate * 2) : 0;
}
