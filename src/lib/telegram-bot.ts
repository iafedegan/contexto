import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories, users } from "@/db/schema";
import { canPublish } from "@/lib/auth";
import { auditArticle, scoreLabel } from "@/lib/seo-audit";
import { aplicarTipo, encodeSpec, TIPOS_GRAFICA, type ChartSpec, type TipoGrafica } from "@/lib/chart-svg";
import {
  generateArticleDraftCore, generateChartCore, generateCoverImageCore, leerEnlacesCore, regenerateDraftPartCore,
  searchNewsAboutCore, suggestTitlesAndContextsCore, suggestTopicIdeasCore, transcribirAudioBytesCore, type DraftPart,
} from "@/lib/ai-core";
import { distintivosCore, enviarARevisionCore, fijarPortadaCore, guardarBorradorCore, programarCore, publicarCore } from "@/lib/article-ops";
import { graficaPng } from "@/lib/chart-png";
import { materialParaPrompt } from "@/lib/material-types";
import { tienePermiso } from "@/lib/permisos-server";
import { borrar, descargarArchivo, editar, editarTeclado, enviar, enviarFoto, esc, escribiendo, responderCallback, tg, type Boton } from "@/lib/telegram";
import { getEstado, setEstado, vincularConCodigo, vinculoDe, desvincular, type EstadoChat, type Espera, type Fase } from "@/lib/telegram-store";
import { signPreviewToken } from "@/lib/preview-token";
import { avisarNota, contarSuscriptores, notaYaAvisada, pushConfigurado } from "@/lib/push";
import { siteUrl } from "@/lib/utils";
import { subirImagenBytes } from "@/lib/media-upload";
import { recortar as recorta } from "@/lib/format";

/**
 * Bot de redacción por Telegram. Recorre el mismo asistente que el panel web, con los mismos nueve pasos y las mismas
 * opciones, pero pensado para el chat: UN solo mensaje «panel» que se reescribe en cada paso (la conversación no se
 * llena de mensajes), pantallas cortas, navegación fija «Atrás / Siguiente» y el texto que escribes siempre significa
 * lo mismo (suma al tema, o es lo que un botón te pidió). Nada se publica sin confirmación y sin el permiso de publicar.
 */

type Msg = {
  message_id: number;
  chat: { id: number; first_name?: string };
  from?: { first_name?: string };
  text?: string;
  caption?: string;
  voice?: { file_id: string; mime_type?: string; file_size?: number };
  audio?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
  video?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
  /** Video redondo («mensaje de video»): siempre MP4. */
  video_note?: { file_id: string; file_size?: number };
  photo?: { file_id: string; width: number }[];
  document?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
};
// Actualización que envía Telegram: un mensaje o la pulsación de un botón.
export type Update = { update_id: number; message?: Msg; callback_query?: { id: string; data?: string; message?: Msg } };

// Mismos pasos y nombres que el asistente web (modo IA y modo manual).
const PASOS_IA: Fase[] = ["tema", "resumen", "claves", "portada", "seccion", "cuerpo", "grafica", "seo", "final"];
// Pasos del modo manual: empieza por el título.
const PASOS_MANUAL: Fase[] = ["titulo", "resumen", "claves", "portada", "seccion", "cuerpo", "grafica", "seo", "final"];
// Nombre de cada paso para el encabezado del panel.
const NOMBRE_PASO: Partial<Record<Fase, string>> = {
  tema: "Título y contexto", titulo: "Título", resumen: "Resumen", claves: "Palabras clave", portada: "Imagen",
  seccion: "Sección y autor", cuerpo: "Cuerpo", grafica: "Gráfica", seo: "Buscadores", final: "Vista previa",
};
// Texto de ayuda: describe los nueve pasos y los comandos.
const AYUDA =
  "✍️ <b>Redactor de CONtexto Ganadero</b>\n\nEs el mismo asistente del panel, en nueve pasos: Título y contexto · Resumen · Palabras clave · Portada · Sección y autor · Cuerpo · Gráfica · Buscadores · Vista previa.\n\nTodo ocurre en un solo mensaje que se va actualizando: usa los botones <b>⬅️ Atrás</b> y <b>Siguiente ➡️</b>. Lo que escribas en el chat se suma al tema (o responde al botón que pulsaste). También puedes enviar una <b>nota de voz, un audio o un video</b> (hasta 20 MB): lo transcribo y propongo títulos.\n\n/nueva — empezar un artículo con IA\n/estado — estado de la última nota\n/cancelar — descartar el flujo actual\n/ayuda — esta ayuda\n/desvincular — separar este Telegram de tu cuenta";

// Direcciones web que contiene un texto, sin repetir.
const urlsEn = (t: string) => [...new Set(t.match(/https?:\/\/[^\s<>"')]+/gi) ?? [])];

// Convierte el HTML del cuerpo en texto para Telegram, marcando los intertítulos y las listas.
function textoDeHtml(html: string): string {
  return html
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n##$1##\n")
    .replace(/<li[^>]*>/gi, "\n• ").replace(/<\/p>|<br\s*\/?>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}
// Convierte las marcas de intertítulo en negrita de Telegram, escapando el resto.
const conIntertitulos = (t: string) => esc(t).replace(/##([\s\S]*?)##/g, "<b>$1</b>");
/** Cuerpo de la nota → mensaje de Telegram (intertítulos en negrita). */
const cuerpoParaTelegram = (html: string) => conIntertitulos(textoDeHtml(html));
/** Resumen del cuerpo para el panel: se recorta el TEXTO (no el HTML) para no cortar etiquetas. */
function cuerpoCorto(html: string, n = 650): string {
  const t = textoDeHtml(html);
  return conIntertitulos(t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, "")}…` : t);
}
/** Texto editado por la persona → HTML de la nota («## » = intertítulo, líneas en blanco = párrafos). */
function htmlDeTexto(t: string): string {
  return t.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map((b) => {
    const e = esc(b);
    return /^##\s+/.test(b) ? `<h2>${e.replace(/^##\s+/, "")}</h2>` : `<p>${e.replace(/\n/g, "<br>")}</p>`;
  }).join("");
}
// Cuenta las palabras del cuerpo.
const palabras = (html: string) => { const t = textoDeHtml(html).replace(/##/g, " ").trim(); return t ? t.split(/\s+/).length : 0; };
/** Contador de longitud como el del asistente web: ✅ dentro del rango ideal, ⚠️ fuera. */
const contador = (len: number, min: number, max: number) => `${len} car. · ideal ${min}–${max} ${len >= min && len <= max ? "✅" : "⚠️"}`;

/** «05/10 20:00», «5 de octubre 8pm», «mañana 8pm», «lunes 7 am», «hoy 18:30» → ISO (hora de Colombia, UTC-5). */
export function parseFecha(txt: string, ahora = new Date()): string | null {
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  let t = txt.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();
  t = t.replace(/de la manana/g, " am ").replace(/de la (tarde|noche)/g, " pm ").replace(/del dia/g, " am ");
  const co = new Date(ahora.getTime() - 5 * 3600_000);
  let y = co.getUTCFullYear(), m = co.getUTCMonth(), d = co.getUTCDate();
  let explicita = false, conAnio = false, fecha = false;
  const r = t.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?/);
  const r2 = t.match(new RegExp(`(\\d{1,2})\\s*(?:de\\s+)?(${MESES.join("|")})(?:\\s*(?:de|del)?\\s*(\\d{4}))?`));
  if (r && !/\d{1,2}:\d{2}/.test(r[0])) {
    d = Number(r[1]); m = Number(r[2]) - 1; fecha = explicita = true;
    if (r[3]) { y = Number(r[3]) < 100 ? 2000 + Number(r[3]) : Number(r[3]); conAnio = true; }
    t = t.replace(r[0], " ");
  } else if (r2) {
    d = Number(r2[1]); m = MESES.indexOf(r2[2]); fecha = explicita = true;
    if (r2[3]) { y = Number(r2[3]); conAnio = true; }
    t = t.replace(r2[0], " ");
  } else if (/pasado manana/.test(t)) { d += 2; fecha = true; t = t.replace("pasado manana", " "); }
  else if (/manana/.test(t)) { d += 1; fecha = true; t = t.replace("manana", " "); }
  else if (/\bhoy\b/.test(t)) { fecha = true; t = t.replace("hoy", " "); }
  else {
    const dia = DIAS.findIndex((x) => new RegExp(`\\b${x}\\b`).test(t));
    if (dia >= 0) { let n = (dia - co.getUTCDay() + 7) % 7; if (n === 0) n = 7; d += n; fecha = true; t = t.replace(DIAS[dia], " "); }
  }
  let h = 8, min = 0, conHora = false;
  const hm = t.match(/(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?(?!\d)/);
  if (hm) {
    conHora = true;
    h = Number(hm[1]); min = Number(hm[2] ?? 0);
    if (hm[3]) { const pm = hm[3].startsWith("p"); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    if (h > 23 || min > 59) return null;
  }
  if (!fecha && !conHora) return null;
  // Fecha de hoy con la hora pedida, convertida de hora de Colombia a UTC.
  const hoyIso = () => new Date(Date.UTC(y, m, d, h + 5, min));
  if (!fecha) { // solo hora: hoy si aún no pasó, si no mañana
    let w = hoyIso(); if (w.getTime() <= ahora.getTime()) { d += 1; w = hoyIso(); }
    return w.toISOString();
  }
  let when = hoyIso();
  // Día y mes sin año que ya pasaron → el año siguiente.
  if (explicita && !conAnio && when.getTime() < ahora.getTime() - 3600_000) { y += 1; when = hoyIso(); }
  if (explicita && (when.getUTCMonth() !== m || Number.isNaN(when.getTime()))) return null; // 31/02, etc.
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}
// Próximo lunes a las 8 p. m. (hora de Colombia) como fecha ISO: sugerencia para programar.
function proximoLunes8pm(ahora = new Date()): string {
  const co = new Date(ahora.getTime() - 5 * 3600_000);
  let dias = (1 - co.getUTCDay() + 7) % 7;
  if (dias === 0 && co.getUTCHours() >= 20) dias = 7;
  return new Date(Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate() + dias, 25)).toISOString();
}
// Fecha y hora completas en español de Colombia.
const fmtHora = (iso: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(iso));

// -------------------------------------------------------------------------------------------------------------

type Ctx = {
  chatId: number; userId: string; nombre: string; role: Parameters<typeof canPublish>[0]; e: EstadoChat;
  /** Mensaje del que viene el botón pulsado. */
  mid?: number;
  /** El próximo panel va como mensaje nuevo (abajo del chat) y reemplaza al anterior. */
  nuevo?: boolean;
  /** Mensaje de texto que escribió la persona (se borra al usarlo, para mantener el chat limpio). */
  entrada?: number;
  /** Aviso de un solo uso que se antepone al próximo panel (errores, confirmaciones). */
  aviso?: string;
};

// Lista de pasos según el modo (IA o manual).
const pasos = (c: Ctx) => (c.e.modo === "manual" ? PASOS_MANUAL : PASOS_IA);
// Indica si la conversación está en modo IA.
const esIA = (c: Ctx) => c.e.modo !== "manual";
// Guarda el estado de la conversación.
const fin = (c: Ctx) => setEstado(c.chatId, c.e);

// Aplica los cambios al estado y guarda el borrador de la nota en la base.
async function guardar(c: Ctx, extra: Partial<EstadoChat> = {}) {
  Object.assign(c.e, extra);
  // Un intento de guardar el borrador con todos los datos del estado.
  const intentar = () => guardarBorradorCore(c.userId, {
    id: c.e.articleId, title: c.e.title ?? "", excerpt: c.e.excerpt ?? "", body: c.e.body ?? "", tags: c.e.tags ?? [],
    categoryId: c.e.categoryId, coverImageUrl: c.e.coverUrl, coverImageAlt: c.e.coverAlt, metaTitle: c.e.metaTitle, metaDescription: c.e.metaDescription,
  });
  let r = await intentar();
  // La nota enlazada al chat se borró desde el panel: se vuelve a crear con el contenido actual.
  if (!r.ok && c.e.articleId && r.error === "La nota ya no existe.") { c.e.articleId = undefined; r = await intentar(); }
  if (r.ok) c.e.articleId = r.id;
  await setEstado(c.chatId, c.e);
  if (!r.ok && !r.skipped) c.aviso = `⚠️ No se pudo guardar en el panel: ${esc(r.detalle ?? r.error ?? "error desconocido")}`;
  return r;
}

/** Los botones finales llevan el inicio del id de SU nota: un botón viejo no debe publicar otra nota. */
const tk = (c: Ctx) => (c.e.articleId ?? "").slice(0, 8);
// Enlace al panel web de la nota (o al listado si aún no existe).
const enlacePanel = (c: Ctx) => (c.e.articleId ? siteUrl(`/panel/articulos/${c.e.articleId}?modo=ia&paso=vista`) : siteUrl("/panel/articulos"));
/** Vista previa de la nota tal como se verá en el sitio: enlace firmado y caducable, se abre sin iniciar sesión (noindex). */
const vistaUrl = (c: Ctx) => (c.e.articleId ? siteUrl(`/vista-previa/${c.e.articleId}?t=${signPreviewToken(c.e.articleId)}`) : null);
// Botón con el enlace a la vista previa, si la nota ya existe.
const botonVista = (c: Ctx): Boton[][] => { const u = vistaUrl(c); return u ? [[{ texto: "👁️ Vista previa en el sitio", url: u }]] : []; };
// Línea de texto con el enlace a la vista previa firmada.
const linkVista = (c: Ctx) => { const u = vistaUrl(c); return u ? `\n👁️ <a href="${u}">Vista previa del artículo</a> (se abre sin contraseña)` : ""; };

// --- El panel: un solo mensaje que se reescribe -------------------------------------------------------------------

/**
 * Muestra la pantalla actual. Si ya hay un panel y el botón se pulsó en él, se REESCRIBE (la conversación no crece);
 * si no, se envía uno nuevo abajo y el anterior se borra.
 */
async function mostrar(c: Ctx, texto: string, filas: Boton[][] = []) {
  const cuerpo = `${c.aviso ? `${c.aviso}\n\n` : ""}${texto}`;
  c.aviso = undefined;
  const viejo = c.e.panel;
  if (viejo && !c.nuevo) {
    const r = await editar(c.chatId, viejo, cuerpo, filas);
    if (r.ok) return;
  }
  const r = await enviar(c.chatId, cuerpo, filas);
  if (r.ok) {
    if (viejo && viejo !== r.result.message_id) void borrar(c.chatId, viejo);
    c.e.panel = r.result.message_id;
    c.nuevo = false;
    await fin(c);
  }
}
/** Estado «trabajando…» dentro del propio panel (sin mensajes sueltos). */
const ocupado = (c: Ctx, texto: string) => mostrar(c, `⏳ ${texto}`);
// Borra el mensaje de la persona que se usó como entrada, para mantener limpia la conversación.
async function borrarEntrada(c: Ctx) {
  if (c.entrada) { void borrar(c.chatId, c.entrada); c.entrada = undefined; }
}
/** Pide un dato por texto: el panel pasa a ser la instrucción, con «Cancelar». */
async function pedir(c: Ctx, espera: Espera, instruccion: string, actual?: string) {
  c.e.espera = espera;
  await fin(c);
  return mostrar(c, `✏️ ${instruccion}${actual ? `\n\n<i>Actual:</i>\n<code>${esc(actual.slice(0, 1200))}</code>` : ""}`, [[{ texto: "✖ Cancelar", dato: "x:" }]]);
}
// Muestra un aviso de error dentro del panel.
const fallo = (c: Ctx, msg: string) => { c.aviso = `⚠️ ${msg}`; return vista(c); };

// Audita la nota en curso con los criterios SEO.
const auditoria = (c: Ctx) => auditArticle({ title: c.e.title ?? "", excerpt: c.e.excerpt ?? "", body: c.e.body ?? "", metaTitle: c.e.metaTitle, metaDescription: c.e.metaDescription, tags: c.e.tags, focus: c.e.tags?.[0] || c.e.title, coverImageUrl: c.e.coverUrl ?? "", coverImageAlt: c.e.coverAlt, authorName: c.nombre });
/** Encabezado mínimo: nombre del paso y «2/9». */
function cab(c: Ctx, f: Fase, titulo?: string): string {
  const l = pasos(c);
  return `<b>${titulo ?? NOMBRE_PASO[f] ?? ""}</b> · ${l.indexOf(f) + 1}/${l.length}\n\n`;
}
/** Navegación fija: «Atrás» (salvo en el primer paso) y «Siguiente». */
const nav = (c: Ctx, sig: Boton = { texto: "Siguiente ➡️", dato: "n:" }): Boton[] =>
  pasos(c).indexOf(c.e.fase) > 0 ? [{ texto: "⬅️ Atrás", dato: "b:" }, sig] : [sig];
// Nombre de la sección elegida para la nota.
const nombreSeccion = async (c: Ctx) => (c.e.categoryId ? (await cats()).find((x) => x.id === c.e.categoryId)?.name : undefined);

// --- Primer paso: Tema, título y contexto --------------------------------------------------------------------

async function pasoTema(c: Ctx) {
  c.e.fase = "tema";
  c.e.espera = undefined;
  const topic = (c.e.topic ?? "").trim();
  await mostrar(c, `${cab(c, "tema", "Tema")}<b>¿De qué trata la nota?</b>\nEscríbelo en un mensaje, o elige una fuente.${topic ? `\n\n📝 ${esc(recorta(topic, 300))}` : ""}`, [
    [{ texto: "💡 Ideas de la IA", dato: "i:ideas" }, { texto: "🔎 Buscar noticias", dato: "i:noticias" }],
    [{ texto: "🎙️ Voz o video", dato: "i:entrevista" }, { texto: "🔗 Enlaces", dato: "i:enlaces" }],
    ...(topic || (c.e.material ?? []).length ? [[{ texto: "✨ Proponer títulos", dato: "i:prop" }]] : []),
    ...(c.e.generated ? [[{ texto: "Siguiente ➡️ (ya hay borrador)", dato: "n:" }]] : []),
  ]);
}

/** Pantallas de cada fuente: una instrucción de una línea y «Volver». */
async function subPanel(c: Ctx, texto: string) {
  await mostrar(c, texto, [[{ texto: "⬅️ Volver", dato: "i:ini" }]]);
}
// Pide qué investigar para buscar noticias.
async function subNoticias(c: Ctx) {
  c.e.espera = "busqueda";
  await fin(c);
  return subPanel(c, "🔎 <b>¿Qué quieres investigar?</b>\nEscribe una persona, empresa o tema.");
}
// Pide un audio, nota de voz o video de hasta 20 MB para transcribir.
const subEntrevista = (c: Ctx) => subPanel(c, "🎙️ Envíame una <b>nota de voz</b>, un <b>audio</b> o un <b>video</b> (hasta 20 MB). Transcribo lo que se oye.");
// Pide pegar hasta cinco enlaces.
const subEnlaces = (c: Ctx) => subPanel(c, "🔗 <b>Pega los enlaces</b> (hasta 5, uno por línea).");

/** Suma el texto al tema (como escribir en el cuadro de tema) y lee los enlaces que traiga. */
async function agregarTema(c: Ctx, texto: string) {
  const urls = urlsEn(texto);
  const sinUrls = texto.replace(/https?:\/\/\S+/g, "").trim();
  if (sinUrls) c.e.topic = [c.e.topic, sinUrls].filter(Boolean).join("\n\n");
  c.e.options = undefined;
  c.e.enOpciones = false;
  if (urls.length) await leerEnlaces(c, urls);
  if (!(c.e.topic ?? "").trim() && !(c.e.material ?? []).length) return pasoTema(c);
  return proponer(c); // sigue solo: propone títulos con lo que escribiste
}

// Lee los enlaces recibidos y los agrega como material para redactar.
async function leerEnlaces(c: Ctx, urls: string[]) {
  await ocupado(c, `Leyendo ${Math.min(urls.length, 5)} enlace${urls.length > 1 ? "s" : ""}…`);
  const r = await leerEnlacesCore(c.userId, { urls: urls.slice(0, 5).join("\n") });
  if (!r.ok) { c.aviso = `⚠️ ${esc(r.error)}`; return; }
  c.e.material = [...(c.e.material ?? []), ...r.materiales];
  c.e.options = undefined;
  if (r.fallidos.length) c.aviso = `⚠️ No pude leer: ${esc(r.fallidos.join(", "))}`;
  await fin(c);
}

// Busca ideas de temas con la IA y las ofrece como opciones.
async function buscarIdeas(c: Ctx) {
  await escribiendo(c.chatId);
  await ocupado(c, "Buscando tendencias en internet… puede tardar hasta un minuto.");
  const r = await suggestTopicIdeasCore(c.userId, { section: await nombreSeccion(c), focus: c.e.ideasFocus?.slice(0, 200) });
  if (!r.ok) { c.aviso = `⚠️ ${esc(r.error)}`; return pasoTema(c); }
  c.e.ideas = r.ideas.slice(0, 6).map((i) => ({ title: recorta(i.title, 110), angle: recorta(i.angle, 170), why: recorta(i.why, 110), scope: i.scope }));
  c.e.ideasFuentes = r.sources;
  await fin(c);
  const lista = c.e.ideas.map((i, k) => `<b>${k + 1}.</b> ${i.scope === "local" ? "🇨🇴" : "🌎"} <b>${esc(i.title)}</b>\n${esc(i.angle)}\n<i>${esc(i.why)}</i>`).join("\n\n");
  const hosts = r.sources.slice(0, 8).map((x) => { let h = x.title; try { if (/vertexaisearch/.test(x.url)) h = x.title; else h = new URL(x.url).hostname.replace(/^www\./, ""); } catch { /* texto del título */ } return `<a href="${esc(x.url)}">${esc(recorta(h, 40))}</a>`; });
  await mostrar(c, `<b>💡 Elige un tema</b>\n\n${lista}${hosts.length ? `\n\n<blockquote expandable><b>Fuentes</b>\n${hosts.join(" · ")}</blockquote>` : ""}`, [
    c.e.ideas.map((_, k) => ({ texto: String(k + 1), dato: `i:u:${k}` })),
    [{ texto: "✨ Otros temas", dato: "i:find" }, { texto: "⬅️ Volver", dato: "i:ini" }],
  ]);
}

// Borra las tarjetas de resultados mostradas antes.
async function limpiarTarjetas(c: Ctx) {
  for (const id of c.e.tarjetas ?? []) void borrar(c.chatId, id);
  c.e.tarjetas = [];
}

// Busca noticias sobre la consulta y las muestra como tarjetas con botones.
async function buscarNoticias(c: Ctx, consulta: string) {
  const q = consulta.trim();
  if (q.length < 3) { c.aviso = "⚠️ Escribe a quién o qué buscar (mínimo 3 caracteres)."; return subNoticias(c); }
  await escribiendo(c.chatId);
  await ocupado(c, `Investigando «${esc(recorta(q, 100))}» en la web… puede tardar hasta un minuto.`);
  const r = await searchNewsAboutCore(c.userId, { query: q, section: await nombreSeccion(c) });
  if (!r.ok) { c.aviso = `⚠️ ${esc(r.error)}`; return subNoticias(c); }
  c.e.noticias = r.items.slice(0, 12);
  c.e.noticiasFiltro = "todo";
  await fin(c);
  return mostrarNoticias(c);
}

// Indica si una noticia ya fue marcada para referenciar.
const esRef = (c: Ctx, url: string) => (c.e.refs ?? []).some((r) => r.url === url);
// Botones de una tarjeta de noticia: referenciar, usar como tema y abrir.
const botonesNoticia = (c: Ctx, k: number): Boton[][] => {
  const n = c.e.noticias?.[k];
  if (!n) return [];
  return [
    [{ texto: "✍️ Escribir sobre esto", dato: `i:ns:${k}` }, { texto: esRef(c, n.url) ? "✓ Referenciada" : n.type === "video" ? "📎 Referenciar e incrustar" : "📎 Referenciar", dato: `i:nr:${k}` }],
    [{ texto: n.type === "video" ? "▶️ Ver en YouTube ↗" : "↗ Abrir fuente", url: n.url }],
  ];
};

/** Resultados: una tarjeta por noticia y, abajo, el panel con filtros. Las tarjetas se borran al salir. */
async function mostrarNoticias(c: Ctx) {
  const todas = c.e.noticias ?? [];
  const f = c.e.noticiasFiltro ?? "todo";
  // Cuenta los resultados de cada tipo, para mostrar los filtros.
  const cuantos = (t: string) => (t === "todo" ? todas.length : todas.filter((n) => n.type === t).length);
  const etiquetas: Record<string, string> = { todo: "Todo", noticia: "Noticias", video: "Videos", oficial: "Oficiales" };
  const filtros: Boton[] = (["todo", "noticia", "video", "oficial"] as const)
    .filter((t) => t === "todo" || cuantos(t) > 0)
    .map((t) => ({ texto: `${f === t ? "● " : ""}${etiquetas[t]} (${cuantos(t)})`, dato: `i:nf:${t}` }));
  await limpiarTarjetas(c);
  const lista = todas.map((n, k) => ({ n, k })).filter((x) => f === "todo" || x.n.type === f).slice(0, 6);
  const ids: number[] = [];
  for (const { n, k } of lista) {
    const marca = n.type === "video" ? "▶ <b>VIDEO</b> · " : n.type === "oficial" ? "🏛️ <b>OFICIAL</b> · " : "";
    const r = await enviar(c.chatId, `${marca}<i>${esc(n.outlet)}${n.date ? ` · ${esc(n.date)}` : ""}</i>\n<b>${esc(n.title)}</b>\n${esc(recorta(n.summary, 200))}`, botonesNoticia(c, k));
    if (r.ok) ids.push(r.result.message_id);
  }
  c.e.tarjetas = ids;
  const refs = c.e.refs ?? [];
  c.nuevo = true;
  await mostrar(c, `<b>🔎 Resultados (${todas.length})</b>\nElige «Escribir sobre esto» o «Referenciar» (irá enlazada al final de la nota; los videos, incrustados).${refs.length ? `\n\n📚 <b>Referencias (${refs.length}):</b> ${refs.map((r) => esc(recorta(r.outlet || r.title, 24))).join(" · ")}` : ""}`, [filtros, [{ texto: "🔎 Buscar otra cosa", dato: "i:noticias" }, { texto: "⬅️ Volver", dato: "i:ini" }]]);
}

/** «Escribir sobre esto»: la noticia pasa a ser el tema y queda referenciada. */
async function noticiaComoTema(c: Ctx, k: number) {
  const n = c.e.noticias?.[k];
  if (!n) return fallo(c, "Esa noticia ya no está: busca de nuevo.");
  c.e.topic = `${n.title}. ${n.summary} (Fuente: ${n.outlet}${n.date ? `, ${n.date}` : ""}).`;
  c.e.options = undefined;
  c.e.enOpciones = false;
  if (!esRef(c, n.url)) c.e.refs = [...(c.e.refs ?? []), { title: n.title, outlet: n.outlet, url: n.url, videoId: n.videoId }];
  await limpiarTarjetas(c);
  c.nuevo = true;
  await fin(c);
  return proponer(c); // sigue solo: propone títulos y enfoques con esa noticia
}

// Propone títulos y enfoques a partir del tema y el material cargado.
async function proponer(c: Ctx) {
  const topic = (c.e.topic ?? "").trim();
  if (!topic && !(c.e.material?.length)) { c.aviso = "⚠️ Escribe de qué trata la nota (o carga una entrevista o enlaces) y pulsa «Proponer títulos y contextos»."; return pasoTema(c); }
  await escribiendo(c.chatId);
  await ocupado(c, "La IA está buscando títulos y contextos…");
  const r = await suggestTitlesAndContextsCore(c.userId, { topic, section: await nombreSeccion(c), material: c.e.material });
  if (!r.ok) { c.aviso = `⚠️ ${esc(r.error)}`; return pasoTema(c); }
  c.e.options = { titles: r.titles, contexts: r.contexts };
  c.e.enOpciones = true;
  c.e.etapa = "titulo";
  c.e.context = undefined;
  c.e.ctxSel = undefined;
  await fin(c);
  return pasoOpciones(c);
}

/** Primera pregunta: el título. */
async function pasoTitulos(c: Ctx) {
  const o = c.e.options;
  if (!o) return pasoTema(c);
  c.e.fase = "tema"; c.e.etapa = "titulo"; c.e.espera = undefined;
  await fin(c);
  await mostrar(c, `${cab(c, "tema", "Título")}<b>Elige un título</b>\n\n${o.titles.map((x, i) => `<b>${i + 1}.</b> ${esc(x)}`).join("\n")}`, [
    o.titles.map((_, i) => ({ texto: String(i + 1), dato: `t:${i}` })),
    [{ texto: "✏️ Escribir el mío", dato: "t:x" }],
    [{ texto: "⬅️ Cambiar tema", dato: "i:chg" }],
  ]);
}

/** Segunda pregunta: el enfoque. Al elegirlo, la IA redacta sola. */
async function pasoEnfoques(c: Ctx) {
  const o = c.e.options;
  if (!o) return pasoTema(c);
  c.e.fase = "tema"; c.e.etapa = "enfoque"; c.e.espera = undefined;
  await fin(c);
  await mostrar(c, `${cab(c, "tema", "Enfoque")}<b>¿Qué enfoque le damos?</b>\n<i>${esc(recorta(c.e.title ?? "", 90))}</i>\n\n${o.contexts.map((x, i) => `<b>${String.fromCharCode(65 + i)}.</b> <b>${esc(x.label)}</b> — ${esc(recorta(x.text, 120))}`).join("\n")}`, [
    o.contexts.map((_, i) => ({ texto: String.fromCharCode(65 + i), dato: `c:${i}` })),
    [{ texto: "Sin enfoque especial", dato: "c:x" }, { texto: "✏️ Escribir uno", dato: "c:e" }],
    [{ texto: "⬅️ Atrás", dato: "b:" }],
  ]);
}

// Muestra los títulos o los enfoques según la etapa.
const pasoOpciones = (c: Ctx) => (c.e.etapa === "enfoque" ? pasoEnfoques(c) : pasoTitulos(c));

// Redacta el borrador completo con la IA y avanza al siguiente paso.
async function redactar(c: Ctx) {
  const titulo = (c.e.title ?? "").trim();
  const prompt = [c.e.topic, c.e.context].filter(Boolean).join("\n\n");
  if (titulo.length < 5) { c.aviso = "⚠️ Elige o escribe un título de al menos 5 caracteres."; return pasoTitulos(c); }
  if (prompt.length < 20 && !(c.e.material?.length)) { c.aviso = "⚠️ Añade un poco más de contexto (mínimo 20 caracteres) o carga una entrevista o enlaces."; return pasoOpciones(c); }
  await escribiendo(c.chatId);
  await ocupado(c, "Redactando el borrador… hasta 1 minuto.");
  const enlaces = (c.e.material ?? []).filter((m) => m.kind === "enlace" && m.url).map((m) => ({ title: m.title, outlet: "", url: m.url! }));
  const refs = (c.e.refs ?? []).map((r) => ({ title: r.title, outlet: r.outlet, url: r.url, videoId: r.videoId }));
  const r = await generateArticleDraftCore(c.userId, {
    title: titulo,
    prompt: prompt || "Redacta la nota a partir del material.",
    section: await nombreSeccion(c),
    material: c.e.material,
    references: [...refs, ...enlaces.filter((x) => !refs.some((y) => y.url === x.url))],
  });
  if (!r.ok) { c.aviso = `⚠️ ${esc(r.error)}`; return pasoOpciones(c); }
  const d = r.draft;
  c.e.generated = true;
  await guardar(c, { title: titulo || d.title, excerpt: d.excerpt, body: d.body, tags: d.tags.map((t) => t.toLowerCase()).slice(0, 12), metaTitle: d.metaTitle, metaDescription: d.metaDescription });
  c.aviso = `${c.aviso ? `${c.aviso}\n` : ""}${r.mode === "esquema" ? `ℹ️ ${esc(r.note ?? "Sin clave del modelo: solo se generó un esquema.")}` : "✅ Borrador listo y guardado en el panel."}`;
  return paso(c, "resumen");
}

// --- Pasos 2 a 9 ----------------------------------------------------------------------------------------------

/** Dibuja el paso en el que va la nota (en el panel). */
async function vista(c: Ctx) {
  switch (c.e.fase) {
    case "tema": return c.e.enOpciones && c.e.options ? pasoOpciones(c) : pasoTema(c);
    case "titulo": return pasoTitulo(c);
    case "resumen": return pasoResumen(c);
    case "claves": return pasoClaves(c);
    case "portada": return pasoPortada(c);
    case "seccion": return mostrarSecciones(c);
    case "cuerpo": return pasoCuerpo(c);
    case "grafica": return pasoGrafica(c);
    case "seo": return pasoSeo(c);
    case "final": return panelFinal(c);
    default: return;
  }
}

// Cambia al paso indicado y lo muestra.
async function paso(c: Ctx, f: Fase) {
  c.e.fase = f;
  c.e.espera = undefined;
  await fin(c);
  return f === "final" ? pasoFinal(c) : vista(c);
}

// Avanza al paso siguiente de la lista del modo en curso.
async function siguiente(c: Ctx) {
  const l = pasos(c);
  const i = l.indexOf(c.e.fase);
  if (i < 0 || i >= l.length - 1) return;
  return paso(c, l[i + 1]);
}

/** Qué impide avanzar (solo título y resumen son obligatorios, como en el asistente web). */
function bloqueo(c: Ctx): string | null {
  if (c.e.fase === "titulo" && (c.e.title ?? "").trim().length < 5) return "Escribe un título de al menos 5 caracteres.";
  if (c.e.fase === "resumen" && (c.e.excerpt ?? "").trim().length < 20) return "El resumen debe tener al menos 20 caracteres.";
  return null;
}

// Botón para regenerar una parte del borrador con la IA.
const regenerar = (c: Ctx, parte: "resumen" | "claves" | "cuerpo" | "seo"): Boton => ({ texto: "🔄 Regenerar", dato: `r:${parte}` });

// Paso del título (modo manual): lo pide por texto.
async function pasoTitulo(c: Ctx) {
  c.e.espera = "titulo";
  const t = c.e.title ?? "";
  await mostrar(c, `${cab(c, "titulo")}<b>¿Cuál es el título?</b>\n<i>Claro y concreto: lo que verá el lector y Google.</i>\n\n${t ? `📌 <b>${esc(t)}</b>\n<i>${contador(t.length, 15, 65)}</i>\n\nEscribe otro para cambiarlo.` : "✏️ Escríbelo en un mensaje.\n<i>Ej.: El precio del novillo gordo sube 4 % en Medellín</i>"}`, [nav(c)]);
}

// Paso del resumen: lo muestra con su contador de longitud y las acciones.
async function pasoResumen(c: Ctx) {
  const x = c.e.excerpt ?? "";
  await mostrar(c, `${cab(c, "resumen")}${x ? esc(x) : "✏️ Escribe el resumen en un mensaje."}`, [
    ...(x ? [[...(esIA(c) && c.e.generated ? [regenerar(c, "resumen")] : []), { texto: "✏️ Editar", dato: "e:resumen" }]] : []),
    nav(c),
  ]);
}

// Paso de las palabras clave.
async function pasoClaves(c: Ctx) {
  const t = c.e.tags ?? [];
  const filas: Boton[][] = [];
  for (let i = 0; i < t.length; i += 3) filas.push(t.slice(i, i + 3).map((x, k) => ({ texto: `✖ ${recorta(x, 18)}`, dato: `k:${i + k}` })));
  await mostrar(c, `${cab(c, "claves")}${t.length ? `🏷️ ${t.map((x) => esc(x)).join(" · ")}` : "<i>sin palabras clave</i>"}\n<i>Escribe para añadir · toca para quitar</i>`, [
    ...filas,
    [...(esIA(c) && c.e.generated ? [regenerar(c, "claves")] : []), { texto: "✏️ Reemplazar todas", dato: "e:claves" }],
    nav(c),
  ]);
}

// Paso del cuerpo: muestra el texto con su recuento de palabras y las acciones.
async function pasoCuerpo(c: Ctx) {
  const b = c.e.body ?? "";
  const w = palabras(b);
  const largo = textoDeHtml(b).length > 650;
  await mostrar(c, `${cab(c, "cuerpo")}${b ? cuerpoCorto(b) : "✏️ Escribe el cuerpo en un mensaje."}\n\n<i>${w} palabras${w > 0 && w < 250 ? " · conviene al menos 250" : ""}</i>`, [
    ...(largo ? [[{ texto: "📖 Ver completo", dato: "v:cuerpo" }]] : []),
    ...(b ? [[...(esIA(c) && c.e.generated ? [regenerar(c, "cuerpo")] : []), { texto: "✏️ Editar", dato: "e:cuerpo" }]] : []),
    ...botonVista(c),
    nav(c),
  ]);
}

// --- Imagen de portada ---------------------------------------------------------------------------------------

async function pasoPortada(c: Ctx) {
  const filas: Boton[][] = [];
  filas.push([{ texto: c.e.coverUrl ? "🎨 Otra imagen con IA" : "🎨 Generar imagen con IA", dato: "ph:g" }]);
  filas.push([{ texto: "✏️ Describir la escena", dato: "e:escena" }, ...(c.e.coverUrl ? [{ texto: "✏️ Texto alt", dato: "e:alt" }, { texto: "🗑️ Quitar", dato: "ph:q" }] : [])]);
  filas.push(nav(c));
  await mostrar(c, `${cab(c, "portada")}🖼️ ${c.e.coverUrl ? "Imagen lista" : "Sin imagen"}\n<i>Envía una foto o genera una con IA.</i>`, filas);
}

// Genera la imagen de portada con IA y la muestra.
async function portadaIA(c: Ctx) {
  await escribiendo(c.chatId, "upload_photo");
  await ocupado(c, "Generando la imagen… puede tardar unos 20–40 segundos.");
  const r = await generateCoverImageCore(c.userId, { title: c.e.title ?? "", excerpt: c.e.excerpt, body: c.e.body, section: await nombreSeccion(c), scene: c.e.sceneTxt });
  if (!r.ok) { c.aviso = `⚠️ ${esc(r.error)}`; return pasoPortada(c); }
  c.e.coverUrl = r.url; c.e.coverAlt = r.alt;
  await guardar(c);
  await tg("sendPhoto", { chat_id: c.chatId, photo: r.url, caption: `🖼️ ${r.alt}`.slice(0, 900) });
  c.nuevo = true; // el panel va debajo de la imagen
  c.aviso = "✅ Imagen lista. «Otra imagen con IA» genera una distinta.";
  return pasoPortada(c);
}

// Descarga una foto enviada por la persona y la usa como portada.
async function fotoRecibida(c: Ctx, fileId: string) {
  const f = await descargarArchivo(fileId);
  if (!f) { c.aviso = "⚠️ No pude descargar la foto."; return vista(c); }
  const up = await subirImagenBytes(f.bytes);
  if (!up.ok) { c.aviso = `⚠️ ${esc(up.error)}`; return vista(c); }
  c.e.coverUrl = up.url; c.e.coverAlt = c.e.title ?? "";
  await guardar(c);
  c.nuevo = true;
  c.aviso = "📷 Foto guardada como portada.";
  return pasoPortada(c);
}

// --- Sección y autor (árbol) --------------------------------------------------------------------------------

async function cats() {
  return db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}
// Descripción en palabras de la posición de la nota en la portada.
const textoLugar = (pos: number | null | undefined) => (pos == null ? "sin destacar" : pos === 0 ? "portada principal" : pos === 1 ? "segunda destacada" : `lugar ${pos + 1}`);
/** «📌 Portada del sitio: …»: dónde queda la nota en la portada (solo con permiso y con la nota ya guardada). */
async function filaPortada(c: Ctx): Promise<Boton[][]> {
  if (!c.e.articleId || !(await tienePermiso(c.userId, c.role, "portada"))) return [];
  const [a] = await db.select({ pos: articles.homePosition }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
  return [[{ texto: `📌 Portada del sitio: ${textoLugar(a?.pos)}`, dato: `d:pm:${tk(c)}` }]];
}
// Muestra las secciones para elegir la de la nota.
async function mostrarSecciones(c: Ctx) {
  const todas = await cats();
  const raices = todas.filter((x) => !x.parentId);
  const rama = c.e.ramaSeccion ? raices.find((r) => r.id === c.e.ramaSeccion) : undefined;
  const sel = todas.find((x) => x.id === c.e.categoryId);
  const cabeza = `${cab(c, "seccion")}📂 <b>Sección:</b> ${sel ? esc(sel.name) : "sin elegir"} · ✍️ ${esc(c.nombre)}\n`;
  if (rama) {
    const hijos = todas.filter((x) => x.parentId === rama.id);
    const filas: Boton[][] = [[{ texto: `✔ ${rama.name} (la sección)`, dato: `s:${rama.id}` }]];
    for (let i = 0; i < hijos.length; i += 2) filas.push(hijos.slice(i, i + 2).map((h) => ({ texto: h.name, dato: `s:${h.id}` })));
    filas.push([{ texto: "⬅️ Todas las secciones", dato: "sr:0" }]);
    return void (await mostrar(c, `${cabeza}\nSubsecciones de <b>${esc(rama.name)}</b>:`, filas));
  }
  const t = `${c.e.title} ${c.e.excerpt} ${(c.e.tags ?? []).join(" ")}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const sug = raices.filter((r) => r.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().split(/\s+/).some((w) => w.length >= 5 && t.includes(w.slice(0, Math.max(5, w.length - 2)))));
  const orden = [...sug, ...raices.filter((r) => !sug.includes(r))];
  const filas: Boton[][] = [];
  for (let i = 0; i < orden.length; i += 2) filas.push(orden.slice(i, i + 2).map((r) => ({ texto: `${sug.includes(r) ? "⭐ " : ""}${r.name}${todas.some((x) => x.parentId === r.id) ? " ›" : ""}`, dato: todas.some((x) => x.parentId === r.id) ? `sr:${r.id}` : `s:${r.id}` })));
  filas.push([{ texto: "Sin sección", dato: "s:0" }], ...(await filaPortada(c)), nav(c));
  return void (await mostrar(c, `${cabeza}Elige la sección o escribe su nombre.`, filas));
}

/** «Buscar sección o subsección…» del asistente web: escribir un nombre lista las coincidencias. */
async function buscarSeccion(c: Ctx, texto: string) {
  // Normaliza un texto para comparar: sin tildes y en minúsculas.
  const n = (x: string) => x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = n(texto.trim());
  const todas = await cats();
  const hallas = todas.filter((x) => n(x.name).includes(q)).slice(0, 10);
  if (!hallas.length) { c.aviso = `⚠️ No encontré ninguna sección con «${esc(texto.slice(0, 40))}».`; return mostrarSecciones(c); }
  const filas: Boton[][] = hallas.map((h) => [{ texto: `${h.parentId ? `${todas.find((p) => p.id === h.parentId)?.name ?? ""} › ` : ""}${h.name}`, dato: `s:${h.id}` }]);
  filas.push([{ texto: "⬅️ Todas las secciones", dato: "sr:0" }]);
  await mostrar(c, `🔎 Coincidencias para «${esc(texto.slice(0, 40))}»:`, filas);
}

// --- Gráfica con datos ---------------------------------------------------------------------------------------

const tipoActual = (c: Ctx) => (c.e.tipoGrafica as TipoGrafica | undefined) ?? "auto";
// Botones con los tipos de gráfica disponibles.
const filasTipos = (c: Ctx): Boton[][] => {
  const t = tipoActual(c);
  const b = TIPOS_GRAFICA.map((x) => ({ texto: `${t === x.id ? "● " : ""}${x.label}`, dato: `g:${x.id}` }));
  const filas: Boton[][] = [];
  for (let i = 0; i < b.length; i += 3) filas.push(b.slice(i, i + 3));
  return filas;
};

// Paso de la gráfica: pide el tema y el tipo.
async function pasoGrafica(c: Ctx) {
  const t = tipoActual(c);
  const tema = c.e.chartTopic?.trim() || c.e.title || "";
  await mostrar(c, `${cab(c, "grafica")}<b>¿Qué graficar?</b> ${tema ? esc(recorta(tema, 140)) : "<i>escríbelo en un mensaje</i>"}\n<i>Opcional · tipo: ${esc(TIPOS_GRAFICA.find((x) => x.id === t)?.label ?? "")}</i>${c.e.chartInsertada ? "\n✓ Ya está en la nota." : ""}`, [
    ...filasTipos(c),
    [{ texto: c.e.chart ? "✨ Buscar otros datos" : "✨ Generar gráfica", dato: "gg" }, { texto: "✏️ Cambiar tema", dato: "e:graficaTema" }],
    ...(c.e.chart?.pngUrl ? [[{ texto: c.e.chartInsertada ? "✅ Actualizar en la nota" : "✅ Insertar en la nota", dato: "gi" }, ...(c.e.chartInsertada ? [{ texto: "🗑️ Quitar", dato: "gq" }] : [])]] : []),
    nav(c),
  ]);
}

// Envía la imagen de la gráfica generada con sus fuentes.
async function enviarGrafica(c: Ctx) {
  const ch = c.e.chart;
  if (!ch) return;
  const spec = ch.spec as ChartSpec;
  const png = await graficaPng(spec);
  // La imagen que ves aquí es EXACTAMENTE la que queda de respaldo en la nota: se sube ahora y se guarda su URL.
  const sub = await subirImagenBytes(png);
  if (!sub.ok) { c.aviso = `⚠️ No pude guardar la imagen de la gráfica: ${esc(sub.error)}`; return pasoGrafica(c); }
  ch.pngUrl = sub.url;
  await fin(c);
  const datos = spec.labels.map((l, i) => `• ${esc(l)}: ${spec.series[0].values[i]}`).join("\n");
  await enviarFoto(c.chatId, png, `<b>${esc(spec.title)}</b>\n${esc(spec.unit)}\n\n${datos.slice(0, 600)}\n\n<i>Fuente: ${esc(ch.sourceNote)}. Verifica antes de publicar.</i>`);
  c.nuevo = true; // el panel va debajo de la gráfica
  await mostrar(c, `<b>📊 Gráfica lista</b>\nDatos de la web: <b>verifica las fuentes antes de publicar</b>. En la nota se publica la versión <b>interactiva</b> (con filtros y fondo transparente) con estos mismos datos.\n\n<blockquote expandable><b>Fuentes (${Math.min(ch.sources.length, 6)})</b>\n${ch.sources.slice(0, 6).map((s) => `🔗 <a href="${esc(s.url)}">${esc(recorta(s.title, 60))}</a>`).join("\n")}</blockquote>`, [
    [{ texto: c.e.chartInsertada ? "✅ Actualizar en la nota" : "✅ Insertar en la nota", dato: "gi" }, ...(c.e.chartInsertada ? [{ texto: "🗑️ Quitar", dato: "gq" }] : [])],
    ...filasTipos(c),
    [{ texto: "✨ Buscar otros datos", dato: "gg" }],
    nav(c),
  ]);
}

// Genera la gráfica con datos de la web y la dibuja como imagen.
async function generarGrafica(c: Ctx) {
  await escribiendo(c.chatId, "upload_photo");
  await ocupado(c, "Buscando datos y dibujando… puede tardar hasta un minuto.");
  const r = await generateChartCore(c.userId, { topic: c.e.chartTopic?.trim() || c.e.title || "", tipo: tipoActual(c), articulo: textoDeHtml(c.e.body ?? ""), section: await nombreSeccion(c) });
  if (!r.ok) { c.aviso = `⚠️ ${esc(r.error)}`; return pasoGrafica(c); }
  c.e.chart = { spec: r.chart, sourceNote: r.sourceNote, sources: r.sources };
  return enviarGrafica(c);
}

/** Cambiar el tipo redibuja la MISMA gráfica (sin volver a buscar datos). */
async function cambiarTipoGrafica(c: Ctx, tipo: TipoGrafica) {
  c.e.tipoGrafica = tipo;
  await fin(c);
  if (!c.e.chart) return pasoGrafica(c);
  const f = aplicarTipo(c.e.chart.spec as ChartSpec, tipo);
  if (!f.ok) { c.aviso = `⚠️ ${esc(f.error)}`; return pasoGrafica(c); }
  c.e.chart.spec = f.chart;
  await enviarGrafica(c);
  if (c.e.chartInsertada) { insertarGrafica(c); await guardar(c); }
}

// Patrones para retirar del cuerpo una gráfica insertada antes.
const QUITAR_GRAFICA = [/<figure class="lx-chart" data-chart="[\w-]+">[\s\S]*?<\/figure>/g, /<figure><img [^>]*alt="Gráfica:[^>]*>(?:<figcaption>[\s\S]*?<\/figcaption>)?<\/figure>/g];
// Inserta la gráfica generada (interactiva, con su imagen de respaldo) en el cuerpo de la nota.
function insertarGrafica(c: Ctx) {
  const ch = c.e.chart; if (!ch?.pngUrl) return false;
  const spec = ch.spec as ChartSpec;
  const fuente = `Fuente: ${ch.sourceNote}. Consultado en: ${ch.sources.slice(0, 3).map((x) => x.title).join(", ")}.`;
  const alt = `Gráfica: ${spec.title} (${spec.unit})`.replace(/"/g, "'");
  // En el sitio se muestra la gráfica INTERACTIVA; la imagen que viste en el chat queda dentro como respaldo (RSS, correo,
  // lectores sin JavaScript). Reemplaza la gráfica anterior para no duplicarla.
  const sinPrevia = QUITAR_GRAFICA.reduce((b, re) => b.replace(re, ""), c.e.body ?? "");
  c.e.body = `${sinPrevia}<figure class="lx-chart" data-chart="${encodeSpec(spec)}"><img src="${ch.pngUrl}" alt="${esc(alt)}"><figcaption>${esc(fuente)}</figcaption></figure>`;
  c.e.chartInsertada = true;
  return true;
}

// --- Buscadores (SEO) ----------------------------------------------------------------------------------------

async function pasoSeo(c: Ctx) {
  const a = auditoria(c);
  const mt = c.e.metaTitle || c.e.title || "";
  const md = c.e.metaDescription || c.e.excerpt || "";
  const faltan = a.items.filter((i) => !i.ok).slice(0, 2).map((i) => `• ${esc(i.text)}`).join("\n");
  const dominio = new URL(siteUrl("/")).host;
  await mostrar(c, `${cab(c, "seo", "Buscadores")}<i>${esc(dominio)} › articulo</i>\n<b><u>${esc(recorta(mt, 90))}</u></b>\n${esc(recorta(md, 200))}\n\n🔎 <b>SEO ${a.score}/100 · ${scoreLabel(a.score)}</b>${faltan ? `\n${faltan}` : "\n✅ Todo en orden."}`, [
    [{ texto: "✏️ Título SEO", dato: "e:metaTitle" }, { texto: "✏️ Descripción", dato: "e:metaDescription" }],
    ...(esIA(c) && c.e.generated ? [[regenerar(c, "seo")]] : []),
    ...botonVista(c),
    nav(c),
  ]);
}

// --- Vista previa y publicación -----------------------------------------------------------------------------

/** Vista previa: la nota completa (portada, titular, entradilla, cuerpo y gráficas) en mensajes aparte y, abajo, el panel. */
async function pasoFinal(c: Ctx) {
  const [info] = c.e.articleId
    ? await db.select({ cat: categories.name }).from(articles).leftJoin(categories, eq(articles.categoryId, categories.id)).where(eq(articles.id, c.e.articleId)).limit(1)
    : [];
  if (c.e.coverUrl) await tg("sendPhoto", { chat_id: c.chatId, photo: c.e.coverUrl, caption: `🖼️ ${c.e.coverAlt ?? ""}`.slice(0, 900) });
  await enviar(c.chatId, `━━━━━━━━━━\n${info?.cat ? `<i>${esc(info.cat.toUpperCase())}</i>\n` : ""}<b>${esc(c.e.title ?? "")}</b>\n\n<i>${esc(c.e.excerpt ?? "")}</i>\n\nPor <b>${esc(c.nombre)}</b>\n━━━━━━━━━━\n\n${cuerpoParaTelegram(c.e.body ?? "")}`);
  for (const m of (c.e.body ?? "").matchAll(/<img [^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g)) {
    await tg("sendPhoto", { chat_id: c.chatId, photo: m[1], caption: `📊 ${textoDeHtml(m[2])}`.slice(0, 900) });
  }
  c.nuevo = true;
  return panelFinal(c);
}

// Panel final: vista previa y botones para guardar, enviar a revisión, programar o publicar según los permisos.
async function panelFinal(c: Ctx) {
  const [info] = c.e.articleId ? await db.select({ estado: articles.status }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1) : [];
  const pub = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
  const ya = info?.estado === "publicado";
  await mostrar(c, `${cab(c, "final")}<b>${esc(recorta(c.e.title ?? "", 100))}</b>\n📌 ${ya ? "Publicada" : "Borrador (aún NO publicada)"}${pub ? "" : "\nTu rol no publica: envíala a revisión."}`, [
    ...(pub
      ? [[{ texto: ya ? "🚀 Guardar y actualizar" : "🚀 Publicar", dato: `f:pub:${tk(c)}` }], [{ texto: "📅 Programar", dato: `f:p:${tk(c)}` }, { texto: "💾 Guardar borrador", dato: `f:b:${tk(c)}` }]]
      : [[{ texto: "🔍 Enviar a revisión", dato: `f:r:${tk(c)}` }, { texto: "💾 Guardar borrador", dato: `f:b:${tk(c)}` }]]),
    ...botonVista(c),
    [{ texto: "⚡ Distintivos y aviso", dato: `d:m:${tk(c)}` }],
    [{ texto: "⬅️ Atrás", dato: "b:" }, { texto: "🔗 Abrir en el panel", url: enlacePanel(c) }],
  ]);
}

// --- Menú de inicio y entrada ------------------------------------------------------------------------------------

/** Telegram es solo para artículos con IA: /nueva abre directamente el primer paso del asistente. */
async function menuInicio(c: Ctx) {
  c.nuevo = true;
  c.e.modo = "ia";
  return paso(c, "tema");
}

/** Una nota ya guardada o publicada no debe contaminar la siguiente: el contexto nuevo empieza desde cero. */
function reiniciarSiTerminada(c: Ctx) {
  if (c.e.fase !== "idle" || !c.e.articleId) return;
  const ultimo = c.e.ultimoUpdate;
  const o = c.e as Record<string, unknown>;
  for (const k of Object.keys(o)) delete o[k];
  c.e.fase = "idle";
  c.e.ultimoUpdate = ultimo;
}

// Tamaño máximo de archivo que Telegram deja descargar a un bot (20 MB).
const MAX_TELEGRAM = 20 * 1024 * 1024;

/** Telegram solo deja a un bot descargar archivos de hasta 20 MB: más allá, mejor decir cómo seguir que fallar en silencio. */
const AVISO_PESADO = "⚠️ Telegram solo permite que un bot descargue archivos de hasta <b>20 MB</b>. Mándalo más corto o solo en audio, o súbelo desde el panel (allí el video no pesa: se saca el audio en tu navegador).";

// Descarga y transcribe un audio, nota de voz o video y lo agrega como material.
async function entrevista(c: Ctx, fileId: string, mime: string, nombre: string, tam?: number) {
  reiniciarSiTerminada(c);
  if (c.e.fase === "idle") { c.e.modo = "ia"; c.e.fase = "tema"; }
  if (tam && tam > MAX_TELEGRAM) { c.aviso = AVISO_PESADO; return pasoTema(c); }
  const video = mime.startsWith("video/");
  await escribiendo(c.chatId);
  await ocupado(c, `Transcribiendo ${video ? "el video" : "el audio"}… puede tardar un par de minutos.`);
  const f = await descargarArchivo(fileId);
  if (!f) { c.aviso = `⚠️ No pude descargar ${video ? "el video" : "el audio"}. Si pesa más de 20 MB, Telegram no deja que el bot lo reciba: envíalo más corto o súbelo desde el panel.`; return pasoTema(c); }
  if (f.bytes.length > MAX_TELEGRAM) { c.aviso = AVISO_PESADO; return pasoTema(c); }
  const r = await transcribirAudioBytesCore(c.userId, f.bytes, mime, nombre);
  if (!r.ok) { c.aviso = `⚠️ ${esc(r.error)}`; return pasoTema(c); }
  c.e.material = [...(c.e.material ?? []), r.material];
  c.e.options = undefined;
  c.e.enOpciones = false;
  await fin(c);
  return proponer(c); // sigue solo: propone títulos con la entrevista
}

// --- Punto de entrada -------------------------------------------------------------------------------------------

export async function procesar(u: Update): Promise<unknown> {
  const msg = u.message ?? u.callback_query?.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  const cb = u.callback_query;
  const texto = (u.message?.text ?? "").trim();

  const vinculo = await vinculoDe(chatId);
  if (!vinculo) {
    const cod = texto.replace(/^\/vincular\s*/i, "").trim().toUpperCase();
    if (/^[A-Z2-9]{6}$/.test(cod)) {
      const uid = await vincularConCodigo(cod, chatId, u.message?.from?.first_name ?? msg.chat.first_name ?? "");
      if (uid) {
        const [usr] = await db.select({ name: users.name }).from(users).where(eq(users.id, uid)).limit(1);
        return void (await enviar(chatId, `✅ ¡Vinculado! Hola, <b>${esc(usr?.name ?? "")}</b>. Escribe /nueva para crear un artículo.`));
      }
      return void (await enviar(chatId, "❌ Ese código no existe o ya venció (duran 10 minutos). Genera uno nuevo en el panel: Configuración → Telegram."));
    }
    if (cb) await responderCallback(cb.id);
    return void (await enviar(chatId, "👋 Este bot es del equipo de CONtexto Ganadero.\n\nPara usarlo, entra al panel → <b>Configuración → Telegram</b>, genera un código y envíamelo aquí (por ejemplo <code>/vincular ABC123</code>)."));
  }

  const [usr] = await db.select({ id: users.id, name: users.name, role: users.role, active: users.active }).from(users).where(eq(users.id, vinculo.userId)).limit(1);
  if (!usr || !usr.active) return void (await enviar(chatId, "Tu cuenta del panel está desactivada."));
  if (!(await tienePermiso(usr.id, usr.role, "articulos"))) return void (await enviar(chatId, "Tu cuenta no tiene permiso para redactar artículos."));

  const e = await getEstado(chatId);
  if (typeof e.ultimoUpdate === "number" && u.update_id <= e.ultimoUpdate) return; // reintento de Telegram
  e.ultimoUpdate = u.update_id;
  // Estados guardados con pasos de versiones anteriores: se tratan como «sin nota en curso».
  if (!["idle", "tema", "titulo", "resumen", "claves", "portada", "seccion", "cuerpo", "grafica", "seo", "final"].includes(e.fase)) e.fase = "idle";
  const c: Ctx = { chatId, userId: usr.id, nombre: usr.name, role: usr.role, e };
  await setEstado(chatId, e);

  if (cb) {
    await responderCallback(cb.id);
    c.mid = cb.message?.message_id;
    // Si el botón no es del panel vigente (un mensaje viejo o una tarjeta), el resultado va en un panel nuevo, abajo.
    c.nuevo = c.e.panel === undefined || (c.mid !== undefined && c.mid !== c.e.panel);
    return acciones(c, cb.data ?? "");
  }
  const m = u.message!;

  // Comandos
  if (/^\/(start|ayuda|help)\b/i.test(texto)) return void (await enviar(chatId, AYUDA));
  if (/^\/(nueva|nuevo)\b/i.test(texto)) {
    if (c.e.panel) void borrar(chatId, c.e.panel);
    void borrar(chatId, m.message_id);
    c.e = { fase: "idle", ultimoUpdate: u.update_id };
    await setEstado(chatId, c.e);
    return menuInicio(c);
  }
  if (/^\/estado\b/i.test(texto)) return estadoNota(c);
  if (/^\/cancelar\b/i.test(texto)) { await setEstado(chatId, { fase: "idle", ultimoUpdate: u.update_id }); return void (await enviar(chatId, "Listo, descartado. Envía /nueva cuando quieras. (Lo que ya estaba guardado queda como borrador en el panel.)")); }
  if (/^\/desvincular\b/i.test(texto)) { await desvincular(chatId); return void (await enviar(chatId, "Telegram desvinculado de tu cuenta.")); }

  // Archivos
  if (m.voice) return entrevista(c, m.voice.file_id, m.voice.mime_type ?? "audio/ogg", "nota-de-voz.ogg", m.voice.file_size);
  if (m.audio) return entrevista(c, m.audio.file_id, m.audio.mime_type ?? "audio/mpeg", m.audio.file_name ?? "audio.mp3", m.audio.file_size);
  if (m.video) return entrevista(c, m.video.file_id, m.video.mime_type ?? "video/mp4", m.video.file_name ?? "video.mp4", m.video.file_size);
  if (m.video_note) return entrevista(c, m.video_note.file_id, "video/mp4", "video-circular.mp4", m.video_note.file_size);
  if (m.document?.mime_type?.startsWith("audio/")) return entrevista(c, m.document.file_id, m.document.mime_type, m.document.file_name ?? "audio", m.document.file_size);
  if (m.document?.mime_type?.startsWith("video/")) return entrevista(c, m.document.file_id, m.document.mime_type, m.document.file_name ?? "video.mp4", m.document.file_size);
  if (m.photo?.length) {
    if (c.e.fase === "portada" || c.e.articleId) return fotoRecibida(c, m.photo[m.photo.length - 1].file_id);
    return void (await enviar(chatId, "Para usar una foto como portada, primero crea la nota con /nueva."));
  }
  if (!texto) return;

  // El texto que escribes se usa y se borra del chat (así solo queda el panel).
  c.entrada = m.message_id;

  // 1) Un botón pidió un dato concreto («Editar», «Escribir el mío», fecha…).
  if (c.e.espera) { await borrarEntrada(c); return textoEsperado(c, texto); }

  // 2) Si no, el texto se interpreta según el paso en que va la nota (igual que escribir en el campo del asistente web).
  switch (c.e.fase) {
    case "tema": await borrarEntrada(c); return agregarTema(c, texto);
    case "titulo": await borrarEntrada(c); await guardar(c, { title: texto.slice(0, 160) }); return pasoTitulo(c);
    case "resumen": await borrarEntrada(c); await guardar(c, { excerpt: texto }); return pasoResumen(c);
    case "cuerpo": await borrarEntrada(c); await guardar(c, { body: htmlDeTexto(texto) }); return pasoCuerpo(c);
    case "claves": {
      await borrarEntrada(c);
      const nuevos = texto.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter((t) => t && !(c.e.tags ?? []).includes(t));
      if (nuevos.length) await guardar(c, { tags: [...(c.e.tags ?? []), ...nuevos].slice(0, 12) });
      return pasoClaves(c);
    }
    case "grafica": await borrarEntrada(c); c.e.chartTopic = texto.slice(0, 300); await fin(c); return pasoGrafica(c);
    case "portada":
      await borrarEntrada(c);
      if (/^https?:\/\/\S+\.(png|jpe?g|webp|gif|avif)(\?\S*)?$/i.test(texto)) { await guardar(c, { coverUrl: texto, coverAlt: c.e.coverAlt || c.e.title || "" }); return pasoPortada(c); }
      c.aviso = "⚠️ En este paso envíame una <b>foto</b> o la <b>URL de una imagen</b>, o usa los botones.";
      return pasoPortada(c);
    case "seccion": await borrarEntrada(c); return buscarSeccion(c, texto);
    case "seo":
    case "final":
      await borrarEntrada(c);
      c.aviso = "ℹ️ Usa los botones de este paso (✏️ Editar…).";
      return vista(c);
    default: {
      // Sin nota en curso: lo que llegue es el tema de una nota nueva con IA.
      reiniciarSiTerminada(c);
      await borrarEntrada(c);
      c.e.modo = "ia";
      c.e.fase = "tema";
      c.nuevo = true;
      return agregarTema(c, texto);
    }
  }
}

/** Texto que un botón pidió explícitamente. */
async function textoEsperado(c: Ctx, texto: string) {
  const w = c.e.espera;
  c.e.espera = undefined;
  switch (w) {
    case "titulo": { await guardar(c, { title: texto.slice(0, 160) }); return c.e.fase === "tema" ? pasoEnfoques(c) : vista(c); }
    case "contexto": c.e.context = texto; c.e.ctxSel = undefined; await fin(c); return redactar(c);
    case "resumen": await guardar(c, { excerpt: texto }); return pasoResumen(c);
    case "claves": await guardar(c, { tags: texto.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12) }); return pasoClaves(c);
    case "cuerpo": await guardar(c, { body: htmlDeTexto(texto) }); return pasoCuerpo(c);
    case "metaTitle": await guardar(c, { metaTitle: texto.slice(0, 120) }); return pasoSeo(c);
    case "metaDescription": await guardar(c, { metaDescription: texto.slice(0, 300) }); return pasoSeo(c);
    case "alt": await guardar(c, { coverAlt: texto.slice(0, 300) }); return pasoPortada(c);
    case "escena": c.e.sceneTxt = texto.slice(0, 400); await fin(c); return portadaIA(c);
    case "graficaTema": c.e.chartTopic = texto.slice(0, 300); await fin(c); return pasoGrafica(c);
    case "enfoque": return pasoTema(c);
    case "busqueda": return buscarNoticias(c, texto);
    case "correccion": {
      const i = c.e.editIdx;
      if (typeof i === "number" && c.e.material?.[i]) { c.e.material[i] = { ...c.e.material[i], text: texto }; c.e.options = undefined; await fin(c); c.aviso = `✅ Texto corregido (${texto.length.toLocaleString("es-CO")} car.).`; }
      return pasoTema(c);
    }
    case "fecha": {
      const iso = parseFecha(texto);
      if (!iso) { c.aviso = "⚠️ No entendí la fecha. Ejemplos: <code>5 de octubre 8pm</code>, <code>05/10 20:00</code>, <code>mañana 7am</code>, <code>lunes 8pm</code>."; return pedir(c, "fecha", "Escribe la fecha y hora (hora de Colombia)."); }
      return programar(c, iso);
    }
    default: return;
  }
}

/** Estado real de la última nota: título, estado, firma y enlaces. */
async function estadoNota(c: Ctx) {
  if (!c.e.articleId) return void (await enviar(c.chatId, "Todavía no tienes una nota en curso. Envía /nueva."));
  const [a] = await db
    .select({ title: articles.title, status: articles.status, slug: articles.slug, scheduledFor: articles.scheduledFor, firma: authors.name })
    .from(articles).leftJoin(authors, eq(articles.authorId, authors.id)).where(eq(articles.id, c.e.articleId)).limit(1);
  if (!a) return void (await enviar(c.chatId, "No encontré esa nota."));
  const estado = a.status === "publicado" ? "✅ publicada" : a.status === "programado" ? `📅 programada para ${a.scheduledFor ? fmtHora(a.scheduledFor.toISOString()) : "?"}` : a.status === "en_revision" ? "🔍 en revisión" : "📝 borrador (no publicada)";
  const pub = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
  await enviar(c.chatId, `<b>${esc(a.title)}</b>\nEstado: ${estado}\n✍️ Firma: <b>${esc(a.firma ?? "— sin firma —")}</b>${a.status === "publicado" ? `\n🔗 ${siteUrl(`/articulo/${a.slug}`)}` : ""}`, [
    ...botonVista(c),
    [{ texto: "📌 Portada y distintivos", dato: `d:m:${tk(c)}` }],
    [{ texto: "🔗 Abrir en el panel (pide contraseña)", url: enlacePanel(c) }],
    ...(a.status !== "publicado" && pub ? [[{ texto: "🚀 Publicar ahora", dato: `f:pub:${tk(c)}` }, { texto: "📅 Programar", dato: `f:p:${tk(c)}` }]] : []),
  ]);
}

// Programa la publicación de la nota para la fecha indicada.
async function programar(c: Ctx, iso: string) {
  try {
    await guardar(c);
    if (!c.e.articleId) { c.aviso = "⚠️ No pude guardar la nota para programarla. Inténtalo de nuevo."; return vista(c); }
    await programarCore(c.e.articleId, iso);
    const [chk] = await db.select({ status: articles.status }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
    if (chk?.status !== "programado") { c.aviso = "⚠️ No pude confirmar la programación. Revisa la nota con /estado o en el panel."; return vista(c); }
    c.e.fase = "idle";
    await fin(c);
    await mostrar(c, `📅 <b>Programada</b> para ${esc(fmtHora(iso))} (hora de Colombia).\n✍️ Firma: <b>${esc(c.nombre)}</b>\nSe publica sola a esa hora (si el reloj de Supabase está activo; si no, al abrirse el sitio o el panel).${linkVista(c)}`, [[{ texto: "🔗 Abrir en el panel", url: enlacePanel(c) }]]);
  } catch (err) {
    c.aviso = `⚠️ ${esc(err instanceof Error ? err.message : "No se pudo programar.")}`;
    return vista(c);
  }
}

/** Portada y distintivos (última hora / en desarrollo): se aplican de inmediato sobre la nota guardada. */
/** Lugar de la nota en la portada del sitio (se abre desde «Sección y autor»). */
async function menuPortada(c: Ctx) {
  if (!c.e.articleId) return void (await mostrar(c, "No tengo una nota en curso. Envía /nueva para empezar."));
  const [a] = await db.select({ title: articles.title, status: articles.status, pos: articles.homePosition }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
  if (!a) return void (await mostrar(c, "No encontré esa nota."));
  if (!(await tienePermiso(c.userId, c.role, "portada"))) { c.aviso = "ℹ️ Tu cuenta no ubica notas en la portada del sitio: un editor lo hace desde el panel."; return vista(c); }
  const k = tk(c);
  const filas: Boton[][] = [[{ texto: `${a.pos === 0 ? "✅" : "📌"} Portada principal`, dato: `d:p0:${k}` }, { texto: `${a.pos === 1 ? "✅" : "📌"} Segunda destacada`, dato: `d:p1:${k}` }]];
  if (a.pos !== null) filas.push([{ texto: "✖ Quitar de la portada", dato: `d:px:${k}` }]);
  filas.push([{ texto: "⬅️ Listo", dato: `d:ok:${k}` }]);
  await mostrar(c, `📌 <b>Portada del sitio</b>\n<b>${esc(recorta(a.title, 100))}</b>\n\nLugar: <b>${textoLugar(a.pos)}</b>${a.status !== "publicado" ? "\n<i>Se verá en el sitio cuando la nota esté publicada.</i>" : ""}`, filas);
}

/** Distintivos (última hora, en desarrollo) y aviso a los lectores: van al final, junto a Publicar. */
async function menuDistintivos(c: Ctx) {
  if (!c.e.articleId) return void (await mostrar(c, "No tengo una nota en curso. Envía /nueva para empezar."));
  const [a] = await db.select({ title: articles.title, status: articles.status, b: articles.isBreaking, l: articles.isLive }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
  if (!a) return void (await mostrar(c, "No encontré esa nota."));
  const pubOk = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
  const avisosOk = await tienePermiso(c.userId, c.role, "avisos");
  if (!pubOk && !avisosOk) { c.aviso = "ℹ️ Tu rol no puede marcar distintivos ni avisar a los lectores: un editor lo hace desde el panel."; return vista(c); }
  const k = tk(c);
  const filas: Boton[][] = [];
  if (pubOk) filas.push([{ texto: `${a.b ? "✅" : "⚡"} Última hora`, dato: `d:b:${k}` }, { texto: `${a.l ? "✅" : "🔴"} En desarrollo`, dato: `d:l:${k}` }]);
  if (avisosOk && a.status === "publicado") filas.push([{ texto: "📣 Avisar a los lectores (notificación)", dato: `d:n:${k}` }]);
  filas.push([{ texto: "⬅️ Listo", dato: `d:ok:${k}` }]);
  await mostrar(c, `⚡ <b>Distintivos y aviso</b>\n<b>${esc(recorta(a.title, 100))}</b>\n\n⚡ Última hora: <b>${a.b ? "sí" : "no"}</b> · 🔴 En desarrollo: <b>${a.l ? "sí" : "no"}</b>${a.status !== "publicado" ? "\n<i>Se verán en el sitio cuando la nota esté publicada.</i>" : ""}\n\n<i>Última hora: solo se muestra la más reciente y, al publicarla, avisa por notificación a quienes tienen la app (una vez). En desarrollo pone la etiqueta «En vivo».</i>`, filas);
}

// Interpreta el dato de un botón (acción:valor:token) y ejecuta la acción correspondiente.
async function acciones(c: Ctx, d: string) {
  const [k, v = "", t = ""] = d.split(":");
  if ((k === "f" || k === "p" || k === "d") && t && !(c.e.articleId ?? "").startsWith(t)) {
    return void (await enviar(c.chatId, "Ese botón es de otra nota. Escribe /estado para ver la nota en curso."));
  }
  switch (k) {
    case "m": { // elegir modo: con IA o paso a paso (el panel de inicio se reescribe)
      const panel = c.e.panel;
      c.e = { fase: "idle", ultimoUpdate: c.e.ultimoUpdate, panel };
      c.e.modo = "ia";
      return paso(c, "tema");
    }
    case "x": { // cancelar una entrada pendiente
      c.e.espera = undefined;
      await fin(c);
      return c.e.fase === "final" ? panelFinal(c) : vista(c);
    }
    case "b": { // Atrás: al paso anterior (en las opciones del primer paso, vuelve al tema)
      if (c.e.fase === "tema" && c.e.enOpciones) { if (c.e.etapa === "enfoque") return pasoTitulos(c); c.e.enOpciones = false; return pasoTema(c); }
      const l = pasos(c);
      const i = l.indexOf(c.e.fase);
      return i > 0 ? paso(c, l[i - 1]) : undefined;
    }
    case "go": return proponer(c);
    case "gen": return redactar(c);
    case "v": { // ver el texto completo en un mensaje aparte
      if (v === "cuerpo") await enviar(c.chatId, cuerpoParaTelegram(c.e.body ?? ""));
      return;
    }
    case "d": {
      if (!c.e.articleId) return fallo(c, "No tengo una nota en curso. Envía /nueva para empezar.");
      if (v === "m") { await guardar(c); return menuDistintivos(c); }
      if (v === "pm") { await guardar(c); return menuPortada(c); }
      if (v === "n" || v === "nok") {
        if (!(await tienePermiso(c.userId, c.role, "avisos"))) { c.aviso = "⚠️ Tu cuenta no tiene permiso para enviar avisos a los lectores."; return menuDistintivos(c); }
        if (!pushConfigurado()) { c.aviso = "⚠️ Las notificaciones aún no están configuradas en el sitio (faltan las claves VAPID). Avisa al administrador."; return menuDistintivos(c); }
        const [nota] = await db.select({ title: articles.title, status: articles.status }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
        if (!nota || nota.status !== "publicado") { c.aviso = "⚠️ La nota todavía no está publicada: publícala y luego avisa a los lectores."; return menuDistintivos(c); }
        if (v === "n") {
          const n = await contarSuscriptores().catch(() => 0);
          if (!n) { c.aviso = "ℹ️ Todavía no hay lectores con notificaciones activadas."; return menuDistintivos(c); }
          const repetida = await notaYaAvisada(c.e.articleId);
          return void (await mostrar(c, `📣 <b>¿Enviar la notificación?</b>\n«${esc(recorta(nota.title, 100))}»\nLlegará a <b>${n}</b> dispositivo${n === 1 ? "" : "s"} y <b>no se puede retirar</b>.${repetida ? "\n\n⚠️ Esta nota <b>ya se avisó</b> antes; se enviaría de nuevo." : ""}`, [[{ texto: "✅ Sí, enviar", dato: `d:nok:${tk(c)}` }, { texto: "Cancelar", dato: `d:m:${tk(c)}` }]]));
        }
        const r = await avisarNota(c.e.articleId, { repetir: true, urgente: false });
        c.aviso = r.ok ? `📣 Notificación enviada a <b>${r.enviados}</b> dispositivo${r.enviados === 1 ? "" : "s"}${r.caducados ? ` (${r.caducados} caducada${r.caducados === 1 ? "" : "s"} eliminada${r.caducados === 1 ? "" : "s"})` : ""}${r.fallidos ? `, ${r.fallidos} con error` : ""}.` : `⚠️ ${esc(r.motivo)}`;
        return menuDistintivos(c);
      }
      if (v === "ok") {
        // A mitad del recorrido se vuelve al paso en curso; al terminar, se indica /estado.
        if (c.e.fase !== "idle" && pasos(c).includes(c.e.fase)) return vista(c);
        return void (await mostrar(c, "Listo. Escribe /estado para ver cómo quedó la nota."));
      }
      const pubOk = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
      const portOk = await tienePermiso(c.userId, c.role, "portada");
      const [a] = await db.select({ b: articles.isBreaking, l: articles.isLive }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
      if (!a) return fallo(c, "No encontré esa nota.");
      if ((v === "b" || v === "l") && !pubOk) { c.aviso = "⚠️ Tu rol no puede marcar distintivos."; return menuDistintivos(c); }
      if (v.startsWith("p") && !portOk) { c.aviso = "⚠️ Tu cuenta no tiene permiso para la portada."; return menuPortada(c); }
      if (v === "b") await distintivosCore(c.e.articleId, { isBreaking: !a.b });
      else if (v === "l") await distintivosCore(c.e.articleId, { isLive: !a.l });
      else if (v === "p0") await fijarPortadaCore(c.e.articleId, 0);
      else if (v === "p1") await fijarPortadaCore(c.e.articleId, 1);
      else if (v === "px") await fijarPortadaCore(c.e.articleId, null);
      return v.startsWith("p") ? menuPortada(c) : menuDistintivos(c);
    }
    case "i": { // primer paso: fuentes, ideas, noticias, material
      reiniciarSiTerminada(c);
      if (c.e.fase === "idle") { c.e.modo = "ia"; c.e.fase = "tema"; }
      switch (v) {
        case "ini": await limpiarTarjetas(c); c.e.espera = undefined; return pasoTema(c);
        case "ideas": return buscarIdeas(c);
        case "noticias": await limpiarTarjetas(c); return subNoticias(c);
        case "entrevista": return subEntrevista(c);
        case "enlaces": return subEnlaces(c);
        case "enf": return pasoTema(c);
        case "bt": await limpiarTarjetas(c); c.e.topic = undefined; c.e.material = []; c.e.refs = []; c.e.options = undefined; c.e.enOpciones = false; c.e.ideas = undefined; c.e.noticias = undefined; c.e.ideasFocus = undefined; await fin(c); return pasoTema(c);
        case "prop": return proponer(c);
        case "chg": c.e.enOpciones = false; await fin(c); return pasoTema(c);
        case "find": return buscarIdeas(c);
        case "u": {
          const idea = c.e.ideas?.[Number(t)];
          if (!idea) return fallo(c, "Esa idea ya no está: pide otras.");
          c.e.topic = `${idea.title}. ${idea.angle}`;
          c.e.options = undefined; c.e.enOpciones = false;
          await fin(c);
          return proponer(c); // sigue solo: propone títulos y enfoques con ese tema
        }
        case "nf": c.e.noticiasFiltro = (t || "todo") as NonNullable<EstadoChat["noticiasFiltro"]>; await fin(c); return mostrarNoticias(c);
        case "ns": return noticiaComoTema(c, Number(t));
        case "nr": {
          const n = c.e.noticias?.[Number(t)];
          if (!n) return;
          c.e.refs = esRef(c, n.url) ? (c.e.refs ?? []).filter((r) => r.url !== n.url) : [...(c.e.refs ?? []), { title: n.title, outlet: n.outlet, url: n.url, videoId: n.videoId }];
          await fin(c);
          if (c.mid) await editarTeclado(c.chatId, c.mid, botonesNoticia(c, Number(t)));
          return;
        }
        case "mv": {
          const m = c.e.material?.[Number(t)];
          if (!m) return fallo(c, "Ese material ya no está.");
          await enviar(c.chatId, `📎 <b>${esc(m.title)}</b>\n\n${esc(recorta(m.text, 3500))}`, [[{ texto: "✏️ Reemplazar el texto", dato: `i:mc:${t}` }, { texto: "🗑️ Quitar", dato: `i:mq:${t}` }, { texto: "✖ Cerrar", dato: "i:ini" }]]);
          return;
        }
        case "mc": c.e.editIdx = Number(t); return pedir(c, "correccion", "Envíame el texto corregido completo (reemplaza al actual).");
        case "mq": c.e.material = (c.e.material ?? []).filter((_, i) => i !== Number(t)); c.e.options = undefined; c.aviso = "🗑️ Material quitado."; await fin(c); return pasoTema(c);
        default: return;
      }
    }
    case "t": {
      if (v === "x") return pedir(c, "titulo", "Escribe el título que quieres usar (ideal entre 15 y 65 caracteres).", c.e.title);
      c.e.title = c.e.options?.titles[Number(v)] ?? c.e.title;
      await fin(c);
      return pasoEnfoques(c);
    }
    case "c": {
      if (v === "e") return pedir(c, "contexto", "Escribe el contexto o enfoque que quieres (reemplaza al elegido).", c.e.context);
      c.e.ctxSel = v === "x" ? -1 : Number(v);
      c.e.context = v === "x" ? "" : c.e.options?.contexts[Number(v)]?.text ?? "";
      await fin(c);
      return redactar(c);
    }
    case "n": {
      // En el primer paso, «Siguiente» hace lo que toca: proponer opciones y, con título elegido, generar el borrador.
      if (c.e.fase === "tema" && !c.e.generated) { if (!c.e.options) return proponer(c); if (!c.e.enOpciones) return pasoOpciones(c); return redactar(c); }
      const b = bloqueo(c);
      if (b) return fallo(c, b);
      return siguiente(c);
    }
    case "e": {
      const campo = v;
      const actual = campo === "titulo" ? c.e.title : campo === "resumen" ? c.e.excerpt : campo === "claves" ? (c.e.tags ?? []).join(", ") : campo === "cuerpo" ? textoDeHtml(c.e.body ?? "").replace(/##/g, "## ") : campo === "metaTitle" ? (c.e.metaTitle || c.e.title) : campo === "metaDescription" ? (c.e.metaDescription || c.e.excerpt) : campo === "alt" ? c.e.coverAlt : campo === "escena" ? c.e.sceneTxt : campo === "graficaTema" ? (c.e.chartTopic || c.e.title) : "";
      const pedido: Record<string, string> = {
        titulo: "Escribe el nuevo título.", resumen: "Escribe el nuevo resumen.", claves: "Escribe todas las palabras clave, separadas por comas (reemplazan a las actuales).",
        cuerpo: "Escribe el texto del cuerpo (usa «## » para intertítulos y una línea en blanco entre párrafos).", metaTitle: "Escribe el título para buscadores (ideal 15–65 caracteres).",
        metaDescription: "Escribe la descripción para buscadores (ideal 70–155 caracteres).", alt: "Escribe qué se ve en la foto (texto alternativo).",
        escena: "Describe la escena que quieres ilustrar; genero la imagen al recibirla.", graficaTema: "Escribe qué quieres graficar. Ej.: precio del novillo gordo por mes en 2026.",
      };
      if (!pedido[campo]) return;
      return pedir(c, campo as Espera, pedido[campo], actual);
    }
    case "k": { // quitar una palabra clave
      await guardar(c, { tags: (c.e.tags ?? []).filter((_, i) => i !== Number(v)) });
      return pasoClaves(c);
    }
    case "r": { // regenerar una parte (resumen, claves, cuerpo, buscadores)
      const parte: DraftPart = v === "claves" ? "tags" : v === "cuerpo" ? "body" : v === "seo" ? "seo" : "excerpt";
      await escribiendo(c.chatId);
      await ocupado(c, "Regenerando…");
      const actual = parte === "tags" ? (c.e.tags ?? []).join(", ") : parte === "body" ? c.e.body ?? "" : parte === "seo" ? `${c.e.metaTitle ?? ""}\n${c.e.metaDescription ?? ""}` : c.e.excerpt ?? "";
      const r = await regenerateDraftPartCore(c.userId, { title: c.e.title ?? "", prompt: [c.e.topic, c.e.context].filter(Boolean).join("\n\n") || materialParaPrompt(c.e.material, 8000), part: parte, current: actual, section: await nombreSeccion(c) });
      if (!r.ok) return fallo(c, esc(r.error));
      const val = r.value;
      if (val.tags) await guardar(c, { tags: val.tags.map((t) => t.toLowerCase()).slice(0, 12) });
      if (val.body) await guardar(c, { body: val.body });
      if (val.excerpt) await guardar(c, { excerpt: val.excerpt });
      if (val.metaTitle) await guardar(c, { metaTitle: val.metaTitle });
      if (val.metaDescription) await guardar(c, { metaDescription: val.metaDescription });
      return vista(c);
    }
    case "sr": { c.e.ramaSeccion = v === "0" ? undefined : v; await fin(c); return mostrarSecciones(c); }
    case "s": {
      await guardar(c, { categoryId: v === "0" ? undefined : v, ramaSeccion: undefined });
      return siguiente(c);
    }
    case "g": return cambiarTipoGrafica(c, (v || "auto") as TipoGrafica);
    case "gg": return generarGrafica(c);
    case "gi": {
      if (!insertarGrafica(c)) return fallo(c, "Primero genera la gráfica.");
      await guardar(c);
      c.aviso = "✅ Gráfica insertada en la nota.";
      return pasoGrafica(c);
    }
    case "gq": {
      c.e.body = QUITAR_GRAFICA.reduce((b, re) => b.replace(re, ""), c.e.body ?? "");
      c.e.chartInsertada = false;
      await guardar(c);
      c.aviso = "🗑️ Gráfica quitada de la nota.";
      return pasoGrafica(c);
    }
    case "ph": {
      if (v === "g") return portadaIA(c);
      if (v === "q") { c.e.coverUrl = undefined; c.e.coverAlt = undefined; await guardar(c); c.aviso = "🗑️ Foto quitada: se usará una ilustración con el nombre de la sección."; return pasoPortada(c); }
      return siguiente(c);
    }
    case "f": return finales(c, v);
    case "p": {
      if (v === "otra") return pedir(c, "fecha", "Escribe la fecha y hora (hora de Colombia). Ej.: <code>5 de octubre 8pm</code>, <code>05/10 20:00</code>, <code>mañana 7am</code> o <code>lunes 8pm</code>.");
      const iso = v === "lunes" ? proximoLunes8pm() : parseFecha(v === "man_am" ? "mañana 7:00" : "mañana 20:00");
      return iso ? programar(c, iso) : undefined;
    }
    default: return;
  }
}

// Acciones finales: guardar, enviar a revisión, programar y publicar, con confirmación y permisos.
async function finales(c: Ctx, v: string) {
  if (!c.e.articleId && !c.e.title) return void (await mostrar(c, "No tengo una nota en curso. Envía /nueva para empezar."));
  await guardar(c);
  if (!c.e.articleId) return fallo(c, "No pude guardar la nota. Inténtalo de nuevo o ábrela en el panel.");
  if (v === "b") { c.e.fase = "idle"; await fin(c); return void (await mostrar(c, `💾 Queda como <b>borrador</b> (no está publicada).\n✍️ Firma: <b>${esc(c.nombre)}</b>${linkVista(c)}`, [[{ texto: "🔗 Abrir en el panel", url: enlacePanel(c) }]])); }
  if (v === "r") { await enviarARevisionCore(c.e.articleId!); c.e.fase = "idle"; await fin(c); return void (await mostrar(c, `🔍 Enviada a <b>revisión</b>: un editor puede publicarla.\n✍️ Firma: <b>${esc(c.nombre)}</b>${linkVista(c)}`, [[{ texto: "🔗 Abrir en el panel", url: enlacePanel(c) }]])); }
  const pub = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
  if (!pub) return fallo(c, "Tu cuenta no tiene permiso para publicar ni programar. Puedes enviarla a revisión.");
  if (v === "p") {
    // Lista de comprobación, como en «Programar la publicación» del asistente web.
    const a = auditoria(c);
    // Marca ✓ o ○ según se cumpla un requisito.
    const ok = (b: boolean, t: string) => `${b ? "✓" : "○"} ${t}`;
    return void (await mostrar(c, `📅 <b>Programar la publicación</b>\n<i>La nota queda guardada con todo y se publica sola a la hora elegida (hora de Colombia).</i>\n\n${[
      ok(Boolean(c.e.coverUrl), "Foto de portada"),
      ok((c.e.body ?? "").includes("data-chart="), "Gráfica con datos (si la nota tiene cifras)"),
      ok(true, "Firma (autor)"),
      ok(a.score >= 75, `Puntuación SEO ≥ 75 (ahora ${a.score})`),
    ].join("\n")}\n\n¿Cuándo se publica?`, [[{ texto: "Próximo lunes · 8:00 p. m.", dato: `p:lunes:${tk(c)}` }], [{ texto: "Mañana · 7:00 a. m.", dato: `p:man_am:${tk(c)}` }, { texto: "Mañana · 8:00 p. m.", dato: `p:man_pm:${tk(c)}` }], [{ texto: "Otra fecha…", dato: `p:otra:${tk(c)}` }], [{ texto: "⬅️ Atrás", dato: "x:" }]]));
  }
  if (v === "pub") return void (await mostrar(c, `⚠️ ¿Publicar <b>ahora</b> «${esc(recorta(c.e.title ?? "", 100))}»?\nSaldrá en el sitio de inmediato.`, [[{ texto: "✅ Sí, publicar", dato: `f:ok:${tk(c)}` }, { texto: "Cancelar", dato: "x:" }]]));
  if (v === "ok") {
    await publicarCore(c.e.articleId);
    const [a] = await db.select({ slug: articles.slug, status: articles.status, firma: authors.name }).from(articles).leftJoin(authors, eq(articles.authorId, authors.id)).where(eq(articles.id, c.e.articleId)).limit(1);
    if (!a || a.status !== "publicado") return fallo(c, "No pude confirmar la publicación. Revisa la nota con /estado o en el panel.");
    c.e.fase = "idle"; await fin(c);
    return void (await mostrar(c, `🚀 <b>Publicada.</b>\n✍️ Firma: <b>${esc(a.firma ?? c.nombre)}</b>\n🔗 ${siteUrl(`/articulo/${a.slug}`)}\n\n¿La destacamos en la portada o la marcamos como última hora?`, [[{ texto: "📌 Portada y distintivos", dato: `d:m:${tk(c)}` }]]));
  }
}
