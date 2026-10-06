import "server-only";

/**
 * Material de entrada del asistente de redacción: transcribe entrevistas (audio y video, pequeños por el formulario y
 * grandes por subida firmada) y lee los enlaces que pega la redacción (con descarga segura contra SSRF).
 */

import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getAiModel, getImageAi } from "@/lib/ai-provider";
import { descargarSeguro } from "@/lib/safe-fetch";
import { FORMATOS_MEDIA, esMimeVideo, mimeMedia } from "@/lib/media-mime";
import { SIN_IDENTIFICAR, parseTiempo, textoDeSegmentos, type Material, type Participante, type Segmento } from "@/lib/material-types";
import { registrarUsoIA, verificarCuotaIA } from "@/lib/ai-cuota";

export type MaterialResult = { ok: true; material: Material } | { ok: false; error: string };

// Resultado de leer enlaces: los materiales y los que no se pudieron leer, o un error.
export type EnlacesResult = { ok: true; materiales: Material[]; fallidos: string[] } | { ok: false; error: string };

/** Tope del audio que se envía al modelo en una sola petición (límite práctico de Gemini en línea). */
const MAX_AUDIO = 20 * 1024 * 1024;

/** Lo que el editor declara de la grabación antes de transcribirla: quién interviene y si es una entrevista. */
export type ContextoEntrevista = {
  participantes: Participante[];
  esEntrevista: boolean;
  /** Si la grabación larga se manda en trozos: qué trozo es este y cuántos hay. */
  parte?: { n: number; de: number };
};

/** Valida el contexto que llega del navegador (JSON en texto): recorta largos y descarta lo que no sirve. */
export function limpiarContexto(raw: unknown): ContextoEntrevista | null {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const r = v as { participantes?: unknown; esEntrevista?: unknown; parte?: { n?: unknown; de?: unknown } };
  const participantes = (Array.isArray(r.participantes) ? r.participantes : [])
    .map((p) => ({
      nombre: String((p as Participante)?.nombre ?? "").trim().slice(0, 80),
      cargo: String((p as Participante)?.cargo ?? "").trim().slice(0, 80),
    }))
    .filter((p) => p.nombre)
    .slice(0, 8);
  const n = Number(r.parte?.n);
  const de = Number(r.parte?.de);
  const parte = Number.isInteger(n) && Number.isInteger(de) && n >= 1 && de >= n && de <= 30 ? { n, de } : undefined;
  return { participantes, esEntrevista: r.esEntrevista === true, parte };
}

// Texto sin tildes y en minúsculas, para comparar nombres.
const normNombre = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Lleva la etiqueta que puso el modelo a un nombre declarado, a «Hablante N» o a «Sin identificar». */
function asignarHablante(etiqueta: string, participantes: Participante[]): string {
  const t = etiqueta.trim();
  if (!t) return SIN_IDENTIFICAR;
  const numerado = t.match(/^hablante\s*(\d+)$/i);
  if (numerado) return `Hablante ${numerado[1]}`;
  const n = normNombre(t);
  const exacto = participantes.find((p) => normNombre(p.nombre) === n);
  if (exacto) return exacto.nombre;
  const parecidos = participantes.filter((p) => normNombre(p.nombre).includes(n) || n.includes(normNombre(p.nombre)));
  return parecidos.length === 1 ? parecidos[0].nombre : SIN_IDENTIFICAR;
}

/** Convierte lo que devuelve el modelo en segmentos limpios: nombres normalizados, tiempos en segundos y sin intervenciones vacías. */
export function armarSegmentos(crudos: { hablante: string; inicio: string; texto: string }[], participantes: Participante[]): Segmento[] {
  return crudos
    .map((s) => ({ hablante: asignarHablante(s.hablante, participantes), inicio: parseTiempo(s.inicio), texto: s.texto.trim() }))
    .filter((s) => s.texto);
}

// Forma de la transcripción por intervenciones que debe devolver el modelo.
const segmentosSchema = z.object({
  segmentos: z
    .array(
      z.object({
        hablante: z.string().describe("Nombre exacto del participante, o «Hablante 1», «Hablante 2»… si no se puede asignar"),
        inicio: z.string().describe("Minuto y segundo donde empieza la intervención, formato m:ss"),
        texto: z.string().describe("Lo que dice, literal"),
      }),
    )
    .min(1),
});

/** Indicaciones sobre quién habla y cómo dividir la grabación, según lo que declaró el editor. */
function indicacionesContexto(c: ContextoEntrevista): string {
  const quienes = c.participantes.length
    ? `Participantes que declaró el editor: ${c.participantes.map((p) => (p.cargo ? `${p.nombre} (${p.cargo})` : p.nombre)).join("; ")}. ` +
      "Usa EXACTAMENTE esos nombres cuando reconozcas a quien habla (por cómo se presenta, cómo lo nombran los demás o su papel: en una entrevista, quien pregunta es el entrevistador). " +
      "Si una voz no se puede asignar con seguridad a uno de ellos, llámala «Hablante 1», «Hablante 2»… de forma consistente en toda la grabación. Nunca inventes un nombre."
    : "El editor no declaró quiénes hablan: llama a cada voz «Hablante 1», «Hablante 2»… de forma consistente (o por su nombre si lo dice con claridad en la grabación).";
  const modo = c.esEntrevista
    ? " Es una entrevista de pregunta y respuesta: separa cada pregunta y cada respuesta en su propio segmento, en el orden en que ocurren, sin mezclar voces."
    : " Divide por intervenciones: cada vez que cambia la persona que habla empieza un segmento nuevo.";
  const parte = c.parte && c.parte.de > 1 ? ` Esta es la parte ${c.parte.n} de ${c.parte.de} de una grabación más larga: los tiempos empiezan en 0:00 en esta parte y los nombres de los hablantes deben ser los mismos que en las demás.` : "";
  return `${quienes}${modo}${parte}`;
}

// Transcribe dividiendo por intervenciones; devuelve null si el modelo no entrega nada utilizable.
async function transcribirPorIntervenciones(
  userId: string,
  model: NonNullable<Awaited<ReturnType<typeof getAiModel>>>,
  bytes: Uint8Array,
  mime: string,
  nombre: string,
  contexto: ContextoEntrevista,
): Promise<MaterialResult | null> {
  const video = esMimeVideo(mime);
  const r = await generateObject({
    model,
    schema: segmentosSchema,
    system:
      "Eres transcriptor profesional de un medio periodístico colombiano. Transcribes con fidelidad: texto literal en el idioma hablado, con puntuación correcta. No resumas, no corrijas lo dicho, no inventes lo inaudible: márcalo como [inaudible]. " +
      "Devuelves la grabación dividida en intervenciones, cada una con quién habla, el minuto:segundo donde empieza y lo que dice. " +
      indicacionesContexto(contexto) +
      (video ? " Si el archivo es un video, transcribe SOLO lo que se oye: no describas imágenes ni añadas lo que se ve." : ""),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: video ? "Transcribe esta grabación en video dividida por intervenciones." : "Transcribe este audio dividido por intervenciones." },
          { type: "file", data: bytes, mediaType: mime },
        ],
      },
    ],
  });
  await registrarUsoIA(userId, r.usage);
  const segmentos = armarSegmentos(r.object.segmentos, contexto.participantes);
  const text = textoDeSegmentos(segmentos);
  if (text.length < 20) return null;
  return {
    ok: true,
    material: {
      kind: "entrevista",
      title: `Entrevista: ${nombre.replace(/\.[a-z0-9]+$/i, "").slice(0, 80)}`,
      text,
      participantes: contexto.participantes,
      esEntrevista: contexto.esEntrevista,
      segmentos,
    },
  };
}

// Transcribe audio o video con Gemini (solo cuenta lo que se oye), comprueba la cuota y registra el gasto.
async function transcribir(userId: string, bytes: Uint8Array, mime: string, nombre: string, contexto?: ContextoEntrevista | null): Promise<MaterialResult> {
  const model = await getAiModel();
  if (!model) return { ok: false, error: "Falta la clave del modelo (Configuración → Asistente)." };
  const settingsOk = await getImageAi(); // solo para distinguir proveedor: «otro-proveedor» = no es Google
  if (settingsOk === "otro-proveedor") {
    return { ok: false, error: "Transcribir audio o video usa Gemini: elige Google (Gemini) en Configuración → Asistente." };
  }
  const cuota = await verificarCuotaIA(userId);
  if (!cuota.ok) return { ok: false, error: cuota.message };
  // Con contexto (lo declara el editor en el panel) se divide por intervenciones; si el modelo falla, se cae al texto corrido.
  if (contexto) {
    try {
      const porIntervenciones = await transcribirPorIntervenciones(userId, model, bytes, mime, nombre, contexto);
      if (porIntervenciones) return porIntervenciones;
    } catch (err) {
      console.error("transcribir por intervenciones:", err);
    }
  }
  const video = esMimeVideo(mime);
  const r = await generateText({
    model,
    system:
      "Eres transcriptor profesional de un medio periodístico colombiano. Transcribes entrevistas con fidelidad: texto literal en el idioma hablado, con puntuación correcta, párrafos por intervención y, cuando se distingan voces, marcas «Entrevistador:» / «Entrevistado:» (o el nombre si se menciona). No resumas, no corrijas lo dicho, no inventes lo inaudible: márcalo como [inaudible]." +
      (contexto ? ` ${indicacionesContexto(contexto)} Marca cada intervención como «Nombre:» al empezar el párrafo.` : "") +
      (video ? " Si el archivo es un video, transcribe SOLO lo que se oye: no describas imágenes ni añadas lo que se ve." : ""),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: video ? "Transcribe completo lo que se dice en esta entrevista grabada en video." : "Transcribe completa esta entrevista de audio." },
          { type: "file", data: bytes, mediaType: mime },
        ],
      },
    ],
  });
  await registrarUsoIA(userId, r.usage);
  const text = r.text.trim();
  if (text.length < 20) return { ok: false, error: "No se pudo transcribir (¿está vacío o ilegible?)." };
  return {
    ok: true,
    material: {
      kind: "entrevista",
      title: `Entrevista: ${nombre.replace(/\.[a-z0-9]+$/i, "").slice(0, 80)}`,
      text,
      ...(contexto ? { participantes: contexto.participantes, esEntrevista: contexto.esEntrevista } : {}),
    },
  };
}

/** Audio pequeño: llega directo en el formulario (el límite de Vercel para cuerpos de petición es ~4,5 MB). */
export async function transcribirEntrevistaCore(userId: string, formData: FormData): Promise<MaterialResult> {
  const f = formData.get("audio");
  if (!(f instanceof File) || f.size === 0) return { ok: false, error: "No llegó ningún audio ni video." };
  const mime = mimeMedia(f.name, f.type);
  if (!mime) return { ok: false, error: `Formato no admitido. Usa ${FORMATOS_MEDIA}.` };
  if (f.size > MAX_AUDIO) return { ok: false, error: `El archivo pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo son 20 MB. Recórtalo o comprímelo.` };
  try {
    return await transcribir(userId, new Uint8Array(await f.arrayBuffer()), mime, f.name, limpiarContexto(formData.get("contexto")));
  } catch (err) {
    console.error("transcribirEntrevista:", err);
    const d = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: d ? `No se pudo transcribir: ${d.slice(0, 220)}` : "El modelo no respondió." };
  }
}

/** Audio grande: se sube directo al almacenamiento con una URL firmada y aquí solo se pide su transcripción. */
export async function crearSubidaAudioCore(userId: string, input: { name: string; type: string; size: number }): Promise<
  { ok: true; uploadUrl: string; path: string } | { ok: false; error: string }
> {
  const mime = mimeMedia(input.name, input.type);
  if (!mime) return { ok: false, error: `Formato no admitido. Usa ${FORMATOS_MEDIA}.` };
  if (input.size > MAX_AUDIO) return { ok: false, error: `El archivo pesa ${(input.size / 1048576).toFixed(1)} MB; el máximo son 20 MB.` };
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Para audios grandes falta configurar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY." };
  const video = esMimeVideo(mime);
  const ext = input.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (video ? "mp4" : "mp3");
  // El «-v» del nombre recuerda que es un video: al transcribir solo se conoce la ruta, no el tipo que declaró el navegador.
  const path = `entrevistas/${crypto.randomUUID()}${video ? "-v" : ""}.${ext}`;
  const res = await fetch(`${url}/storage/v1/object/upload/sign/media/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return { ok: false, error: `No se pudo preparar la subida (${res.status}).` };
  const data = (await res.json()) as { url?: string };
  if (!data.url) return { ok: false, error: "Supabase no devolvió la dirección de subida." };
  return { ok: true, uploadUrl: data.url.startsWith("http") ? data.url : `${url}/storage/v1${data.url}`, path };
}

// Transcribe una entrevista subida directamente a Supabase Storage, validando antes la ruta del archivo.
export async function transcribirEntrevistaSubidaCore(userId: string, input: { path: string; name: string; contexto?: unknown }): Promise<MaterialResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^entrevistas\/[\w-]+\.[a-z0-9]+$/.test(input.path)) return { ok: false, error: "Subida no válida." };
  const mime = mimeMedia(input.path, /-v\.[a-z0-9]+$/.test(input.path) ? "video/*" : "");
  if (!mime) return { ok: false, error: "Formato no admitido." };
  try {
    const r = await fetch(`${url}/storage/v1/object/media/${input.path}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
    if (!r.ok) return { ok: false, error: `No se pudo leer el archivo subido (${r.status}).` };
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > MAX_AUDIO) return { ok: false, error: "El archivo supera 20 MB." };
    return await transcribir(userId, bytes, mime, input.name, limpiarContexto(input.contexto));
  } catch (err) {
    console.error("transcribirEntrevistaSubida:", err);
    const d = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: d ? `No se pudo transcribir: ${d.slice(0, 220)}` : "El modelo no respondió." };
  } finally {
    // La entrevista es privada y el bucket es público: se borra apenas se transcribe.
    void fetch(`${url}/storage/v1/object/media/${input.path}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}`, apikey: key } }).catch(() => {});
  }
}

/* --- Lectura de enlaces --------------------------------------------------- */

const decodeHtml = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

// Extrae el titular y el texto principal de una página HTML, descartando scripts, menús y pies.
function htmlATexto(html: string): { title: string; text: string } {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const tt = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = decodeHtml((og || tt || "").replace(/\s+/g, " ").trim()).slice(0, 200);
  let cuerpo = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  cuerpo = cuerpo
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeHtml(cuerpo).replace(/[ \t\f\v]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").replace(/ *\n */g, "\n").trim();
  return { title, text };
}

// Descarga y lee un enlace de forma segura (ver safe-fetch) y devuelve su texto como material.
async function leerUnEnlace(raw: string): Promise<Material | null> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  // Protección SSRF (ver src/lib/safe-fetch.ts): IP validada en la propia conexión, redirecciones
  // revisadas salto a salto y cuerpo limitado a 2 MB.
  const r = await descargarSeguro(u, {
    maxBytes: 2_000_000,
    cabeceras: { "user-agent": "Mozilla/5.0 (compatible; CONtextoGanadero-Redaccion/1.0)", accept: "text/html,application/xhtml+xml" },
  });
  if (!r) return null;
  if (!/text\/html|application\/xhtml|text\/plain/.test(r.tipo)) return null;
  const html = r.cuerpo;
  const { title, text } = r.tipo.includes("text/plain") ? { title: r.url.hostname, text: html } : htmlATexto(html);
  if (text.length < 200) return null;
  return { kind: "enlace", title: title || r.url.hostname, text: text.slice(0, 30_000), url: r.url.toString() };
}

/** Lee hasta 5 enlaces (una por línea): extrae titular y texto principal para redactar a partir de ellos. */
export async function leerEnlacesCore(userId: string, input: { urls: string }): Promise<EnlacesResult> {
  const urls = [...new Set(input.urls.split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x)))].slice(0, 5);
  if (!urls.length) return { ok: false, error: "Pega al menos un enlace que empiece por http:// o https://." };
  const res = await Promise.all(urls.map((u) => leerUnEnlace(u).catch(() => null)));
  const materiales = res.filter((m): m is Material => m !== null);
  const fallidos = urls.filter((_, i) => !res[i]);
  if (!materiales.length) {
    return { ok: false, error: "No se pudo leer ningún enlace (puede estar protegido, ser un video o exigir suscripción). Pega el texto en el cuadro de tema." };
  }
  return { ok: true, materiales, fallidos };
}

/** Transcribe un audio o video ya descargado (bytes): lo usa el bot de Telegram. */
export async function transcribirAudioBytesCore(userId: string, bytes: Uint8Array, mime: string, nombre: string): Promise<MaterialResult> {
  const m = mimeMedia(nombre, mime);
  if (!m) return { ok: false, error: `Formato no admitido. Usa ${FORMATOS_MEDIA}.` };
  try {
    return await transcribir(userId, bytes, m, nombre);
  } catch (err) {
    console.error("transcribirAudioBytes:", err);
    const d = err && typeof err === "object" && "message" in err ? String((err as Error).message) : "";
    return { ok: false, error: d ? `No se pudo transcribir: ${d.slice(0, 220)}` : "El modelo no respondió." };
  }
}
