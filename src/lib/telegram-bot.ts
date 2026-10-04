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
import { descargarArchivo, editarTeclado, enviar, enviarFoto, esc, escribiendo, responderCallback, tg, type Boton } from "@/lib/telegram";
import { getEstado, setEstado, vincularConCodigo, vinculoDe, desvincular, type EstadoChat, type Fase } from "@/lib/telegram-store";
import { signPreviewToken } from "@/lib/preview-token";
import { avisarNota, contarSuscriptores, notaYaAvisada, pushConfigurado } from "@/lib/push";
import { siteUrl } from "@/lib/utils";
import { subirImagenBytes } from "@/lib/media-upload";

/**
 * Bot de redacción por Telegram. Recorre EXACTAMENTE el mismo asistente que el panel web, con los mismos nueve pasos
 * (Título y contexto · Resumen · Palabras clave · Portada · Sección y autor · Cuerpo · Gráfica · Buscadores · Vista
 * previa), los mismos textos y las mismas opciones: ideas de la IA, buscar noticias (referenciar o usar como tema),
 * entrevista de voz, enlaces, títulos y enfoques, regenerar cada parte, distintivos, programar y publicar. Cada paso
 * se guarda como borrador en el panel. Nada se publica sin un botón de confirmación y sin el permiso de publicar.
 */

type Msg = {
  message_id: number;
  chat: { id: number; first_name?: string };
  from?: { first_name?: string };
  text?: string;
  caption?: string;
  voice?: { file_id: string; mime_type?: string };
  audio?: { file_id: string; mime_type?: string; file_name?: string };
  photo?: { file_id: string; width: number }[];
  document?: { file_id: string; mime_type?: string; file_name?: string };
};
export type Update = { update_id: number; message?: Msg; callback_query?: { id: string; data?: string; message?: Msg } };

// Mismos pasos y nombres que el asistente web (modo IA y modo manual).
const PASOS_IA: Fase[] = ["tema", "resumen", "claves", "portada", "seccion", "cuerpo", "grafica", "seo", "final"];
const PASOS_MANUAL: Fase[] = ["titulo", "resumen", "claves", "portada", "seccion", "cuerpo", "grafica", "seo", "final"];
const NOMBRE_PASO: Partial<Record<Fase, string>> = {
  tema: "Título y contexto", titulo: "Título", resumen: "Resumen", claves: "Palabras clave", portada: "Portada",
  seccion: "Sección y autor", cuerpo: "Cuerpo", grafica: "Gráfica", seo: "Buscadores", final: "Vista previa",
};
const AYUDA =
  "✍️ <b>Redactor de CONtexto Ganadero</b>\n\nEs el mismo asistente del panel, paso a paso: <b>Título y contexto · Resumen · Palabras clave · Portada · Sección y autor · Cuerpo · Gráfica · Buscadores · Vista previa</b>.\n\nEn el primer paso describes el tema (o partes de ideas de la IA, de noticias, de una entrevista de voz o de enlaces), eliges título y enfoque, y la IA redacta. Después revisas cada paso: «Me gusta», «Regenerar» o «Editar».\n\n/nueva — empezar otra nota (con IA o manual)\n/estado — ver si la última nota está publicada y quién firma\n/cancelar — descartar el flujo actual\n/ayuda — esta ayuda\n/desvincular — separar este Telegram de tu cuenta";

const urlsEn = (t: string) => [...new Set(t.match(/https?:\/\/[^\s<>"')]+/gi) ?? [])];

function textoDeHtml(html: string): string {
  return html
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n##$1##\n")
    .replace(/<li[^>]*>/gi, "\n• ").replace(/<\/p>|<br\s*\/?>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}
/** Cuerpo de la nota → mensaje de Telegram (intertítulos en negrita). */
const cuerpoParaTelegram = (html: string) => esc(textoDeHtml(html)).replace(/##([\s\S]*?)##/g, "<b>$1</b>");
/** Texto editado por la persona → HTML de la nota («## » = intertítulo, líneas en blanco = párrafos). */
function htmlDeTexto(t: string): string {
  return t.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map((b) => {
    const e = esc(b);
    return /^##\s+/.test(b) ? `<h2>${e.replace(/^##\s+/, "")}</h2>` : `<p>${e.replace(/\n/g, "<br>")}</p>`;
  }).join("");
}
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
function proximoLunes8pm(ahora = new Date()): string {
  const co = new Date(ahora.getTime() - 5 * 3600_000);
  let dias = (1 - co.getUTCDay() + 7) % 7;
  if (dias === 0 && co.getUTCHours() >= 20) dias = 7;
  return new Date(Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate() + dias, 25)).toISOString();
}
const fmtHora = (iso: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(iso));

// -------------------------------------------------------------------------------------------------------------

type Ctx = { chatId: number; userId: string; nombre: string; role: Parameters<typeof canPublish>[0]; e: EstadoChat };

const pasos = (c: Ctx) => (c.e.modo === "manual" ? PASOS_MANUAL : PASOS_IA);
const esIA = (c: Ctx) => c.e.modo !== "manual";
/** «Atrás», como en el asistente web (no aparece en el primer paso). */
const atras = (c: Ctx): Boton[][] => (pasos(c).indexOf(c.e.fase) > 0 ? [[{ texto: "⬅️ Atrás", dato: "b:" }]] : []);

async function guardar(c: Ctx, extra: Partial<EstadoChat> = {}) {
  Object.assign(c.e, extra);
  const intentar = () => guardarBorradorCore(c.userId, {
    id: c.e.articleId, title: c.e.title ?? "", excerpt: c.e.excerpt ?? "", body: c.e.body ?? "", tags: c.e.tags ?? [],
    categoryId: c.e.categoryId, coverImageUrl: c.e.coverUrl, coverImageAlt: c.e.coverAlt, metaTitle: c.e.metaTitle, metaDescription: c.e.metaDescription,
  });
  let r = await intentar();
  // La nota enlazada al chat se borró desde el panel: se vuelve a crear con el contenido actual.
  if (!r.ok && c.e.articleId && r.error === "La nota ya no existe.") { c.e.articleId = undefined; r = await intentar(); }
  if (r.ok) c.e.articleId = r.id;
  await setEstado(c.chatId, c.e);
  if (!r.ok && !r.skipped) await enviar(c.chatId, `⚠️ No se pudo guardar la nota en el panel.\n<code>${esc(r.detalle ?? r.error ?? "error desconocido")}</code>`);
  return r;
}
const fin = (c: Ctx) => setEstado(c.chatId, c.e);
/** Los botones finales llevan el inicio del id de SU nota: un botón viejo no debe publicar otra nota. */
const tk = (c: Ctx) => (c.e.articleId ?? "").slice(0, 8);
const enlacePanel = (c: Ctx) => (c.e.articleId ? siteUrl(`/panel/articulos/${c.e.articleId}?modo=ia&paso=vista`) : siteUrl("/panel/articulos"));
/** Vista previa de la nota tal como se verá en el sitio: enlace firmado y caducable, se abre sin iniciar sesión (noindex). */
const vistaUrl = (c: Ctx) => (c.e.articleId ? siteUrl(`/vista-previa/${c.e.articleId}?t=${signPreviewToken(c.e.articleId)}`) : null);
const botonVista = (c: Ctx): Boton[][] => { const u = vistaUrl(c); return u ? [[{ texto: "👁️ Ver vista previa", url: u }]] : []; };
const linkVista = (c: Ctx) => { const u = vistaUrl(c); return u ? `\n👁️ <a href="${u}">Vista previa del artículo</a> (se abre sin contraseña)` : ""; };

const auditoria = (c: Ctx) => auditArticle({ title: c.e.title ?? "", excerpt: c.e.excerpt ?? "", body: c.e.body ?? "", metaTitle: c.e.metaTitle, metaDescription: c.e.metaDescription, tags: c.e.tags, focus: c.e.tags?.[0] || c.e.title, coverImageUrl: c.e.coverUrl ?? "", coverImageAlt: c.e.coverAlt, authorName: c.nombre });
/** Encabezado de cada paso: «Paso 4 de 9 · Portada» y, como el panel lateral del asistente web, la puntuación SEO en vivo. */
function cab(c: Ctx, f: Fase): string {
  const lista = pasos(c);
  const seo = (c.e.title ?? "").trim().length >= 5 ? ` · 🔎 SEO ${auditoria(c).score}/100` : "";
  return `<i>Paso ${lista.indexOf(f) + 1} de ${lista.length} · ${NOMBRE_PASO[f] ?? ""}${seo}</i>\n`;
}
const nombreSeccion = async (c: Ctx) => (c.e.categoryId ? (await cats()).find((x) => x.id === c.e.categoryId)?.name : undefined);

// --- Primer paso: Tema, título y contexto --------------------------------------------------------------------

type Fuente = NonNullable<EstadoChat["fuente"]>;
const TEXTO_FUENTE: Record<Fuente, string> = {
  ideas: "La IA busca en internet qué es tendencia en el sector, en Colombia y en el mundo, y te propone temas con sus fuentes.\n✏️ <i>Opcional: escribe un enfoque (p. ej. leche, exportaciones, sanidad) y pulsa «Aconséjame temas».</i>",
  noticias: "Escribe una persona, empresa o tema (p. ej. «Joaquín Manjarrés»): investiga en medios, YouTube y fuentes oficiales. Eliges cuáles <b>referenciar</b> o usar <b>como tema</b>.\n✏️ <i>Escribe aquí abajo lo que quieres investigar.</i>",
  entrevista: "Sube el audio y la IA lo transcribe. Puedes corregir el texto antes de redactar. MP3, M4A, WAV, OGG… hasta 20 MB.\n🎙️ <i>Envíame ahora la nota de voz o el archivo de audio.</i>",
  enlaces: "Pega hasta 5 enlaces (uno por línea): la IA lee cada página y redacta con palabras propias, atribuyendo.\n🔗 <i>Pega los enlaces aquí abajo.</i>",
};

async function pasoTema(c: Ctx) {
  c.e.fase = "tema";
  c.e.espera = undefined;
  await fin(c);
  const topic = (c.e.topic ?? "").trim();
  const mat = c.e.material ?? [];
  const refs = c.e.refs ?? [];
  const f = c.e.fuente;
  const L: string[] = [
    `${cab(c, "tema")}<b>Tema, título y contexto</b>`,
    "Describe el tema, o parte de una noticia, una entrevista o unos enlaces. La IA propone títulos y enfoques; tú eliges y revisas cada paso.",
    "",
    `📝 <b>Tema:</b> ${topic ? esc(topic.slice(0, 700)) : "<i>aún vacío: escríbelo aquí abajo (puedes enviar varios mensajes)</i>"}`,
  ];
  if (mat.length) L.push(`📎 <b>Material cargado (${mat.length}):</b> ${mat.map((m) => esc(m.title.slice(0, 40))).join(" · ")}`);
  if (refs.length) L.push(`📚 <b>Referencias elegidas (${refs.length}):</b> ${refs.map((r) => esc(r.outlet || r.title)).join(" · ")}. Irán enlazadas al final de la nota (los videos, además, incrustados).`);
  if (f) L.push("", `<b>${f === "ideas" ? "💡 Ideas de la IA" : f === "noticias" ? "🔎 Buscar noticias" : f === "entrevista" ? "🎙️ Entrevista de voz" : "🔗 Enlaces"}</b>`, TEXTO_FUENTE[f]);
  if (f === "ideas" && c.e.ideasFocus) L.push(`Enfoque: <b>${esc(c.e.ideasFocus)}</b>`);
  L.push("", "<i>Nada se publica sin tu revisión.</i>", "", "<b>¿PREFIERES PARTIR DE OTRA COSA?</b>");
  const pest = (id: Fuente, texto: string): Boton => ({ texto: `${f === id ? "● " : ""}${texto}`, dato: `i:${id}` });
  const filas: Boton[][] = [
    [{ texto: c.e.options ? "✨ Proponer otras opciones" : "✨ Proponer títulos y contextos", dato: "i:prop" }],
    [pest("ideas", "💡 Ideas de la IA"), pest("noticias", "🔎 Buscar noticias")],
    [pest("entrevista", "🎙️ Entrevista de voz"), pest("enlaces", "🔗 Enlaces")],
  ];
  if (f === "ideas") filas.push([{ texto: c.e.ideas ? "✨ Buscar otros temas" : "✨ Aconséjame temas", dato: "i:find" }]);
  filas.push([{ texto: "✏️ Escribir el tema", dato: "i:tema" }, { texto: "🗑️ Borrar tema", dato: "i:bt" }]);
  if (c.e.generated) filas.push([{ texto: "➡️ Siguiente (ya hay un borrador)", dato: "n:" }]);
  await enviar(c.chatId, L.join("\n"), filas);
}

/** Suma el texto al tema (como escribir en el cuadro de tema) y lee los enlaces que traiga. */
async function agregarTema(c: Ctx, texto: string) {
  const urls = urlsEn(texto);
  if (urls.length) await leerEnlaces(c, urls);
  const sinUrls = texto.replace(/https?:\/\/\S+/g, "").trim();
  if (sinUrls) c.e.topic = [c.e.topic, sinUrls].filter(Boolean).join("\n\n");
  c.e.options = undefined;
  c.e.enOpciones = false;
  return pasoTema(c);
}

async function leerEnlaces(c: Ctx, urls: string[]) {
  await escribiendo(c.chatId);
  await enviar(c.chatId, `🔗 Leyendo ${Math.min(urls.length, 5)} enlace${urls.length > 1 ? "s" : ""}…`);
  const r = await leerEnlacesCore(c.userId, { urls: urls.slice(0, 5).join("\n") });
  if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`));
  const antes = (c.e.material ?? []).length;
  c.e.material = [...(c.e.material ?? []), ...r.materiales];
  c.e.options = undefined;
  await fin(c);
  if (r.fallidos.length) await enviar(c.chatId, `⚠️ No pude leer: ${esc(r.fallidos.join(", "))}`);
  for (let i = antes; i < c.e.material.length; i++) await tarjetaMaterial(c, i);
}

async function tarjetaMaterial(c: Ctx, i: number) {
  const m = c.e.material?.[i];
  if (!m) return;
  await enviar(c.chatId, `📎 <b>${m.kind === "entrevista" ? "ENTREVISTA" : "ENLACE"}</b> · ${esc(m.title.slice(0, 80))} · ${m.text.length.toLocaleString("es-CO")} car.${m.url ? `\n${esc(m.url)}` : ""}`, [
    [{ texto: "👁️ Ver y corregir el texto", dato: `i:mv:${i}` }, { texto: "🗑️ Quitar", dato: `i:mq:${i}` }],
  ]);
}

async function buscarIdeas(c: Ctx) {
  await escribiendo(c.chatId);
  await enviar(c.chatId, "💡 Buscando tendencias en internet… puede tardar hasta un minuto.");
  const r = await suggestTopicIdeasCore(c.userId, { section: await nombreSeccion(c), focus: c.e.ideasFocus?.slice(0, 200) });
  if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`));
  c.e.ideas = r.ideas.slice(0, 8).map((i) => ({ title: i.title, angle: i.angle, why: i.why, scope: i.scope }));
  c.e.ideasFuentes = r.sources;
  await fin(c);
  const lista = c.e.ideas.map((i, k) => `<b>${k + 1}.</b> ${i.scope === "local" ? "🇨🇴 <b>COLOMBIA</b>" : "🌎 <b>INTERNACIONAL</b>"} · <b>${esc(i.title)}</b>\n${esc(i.angle)}\n<i>Tendencia: ${esc(i.why)}</i>`).join("\n\n");
  const fuentes = r.sources.length ? `\n\n<blockquote expandable><b>Fuentes consultadas (${r.sources.length})</b>\n${r.sources.slice(0, 10).map((x) => `🔗 <a href="${esc(x.url)}">${esc(x.title)}</a>`).join("\n")}</blockquote>` : "";
  await enviar(c.chatId, `💡 <b>Temas sugeridos</b>\n\n${lista}${fuentes}\n\nPulsa un tema para usarlo; luego «Proponer títulos y contextos».`, [
    c.e.ideas.map((_, k) => ({ texto: String(k + 1), dato: `i:u:${k}` })),
    [{ texto: "✨ Buscar otros temas", dato: "i:find" }],
  ]);
}

async function buscarNoticias(c: Ctx, consulta: string) {
  const q = consulta.trim();
  if (q.length < 3) return void (await enviar(c.chatId, "Escribe a quién o qué buscar (mínimo 3 caracteres)."));
  await escribiendo(c.chatId);
  await enviar(c.chatId, `🔎 Investigando «${esc(q.slice(0, 120))}» en la web… puede tardar hasta un minuto.`);
  const r = await searchNewsAboutCore(c.userId, { query: q, section: await nombreSeccion(c) });
  if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`));
  c.e.noticias = r.items.slice(0, 12);
  c.e.noticiasFiltro = "todo";
  await fin(c);
  return mostrarNoticias(c);
}

const esRef = (c: Ctx, url: string) => (c.e.refs ?? []).some((r) => r.url === url);
const botonesNoticia = (c: Ctx, k: number): Boton[][] => {
  const n = c.e.noticias?.[k];
  if (!n) return [];
  return [
    [{ texto: "✍️ Escribir sobre esto", dato: `i:ns:${k}` }, { texto: esRef(c, n.url) ? "✓ Referenciada" : n.type === "video" ? "📎 Referenciar e incrustar" : "📎 Referenciar", dato: `i:nr:${k}` }],
    [{ texto: n.type === "video" ? "▶️ Ver en YouTube ↗" : "↗ Abrir fuente", url: n.url }],
  ];
};

async function mostrarNoticias(c: Ctx) {
  const todas = c.e.noticias ?? [];
  const f = c.e.noticiasFiltro ?? "todo";
  const cuantos = (t: string) => (t === "todo" ? todas.length : todas.filter((n) => n.type === t).length);
  const etiquetas: Record<string, string> = { todo: "Todo", noticia: "Noticias", video: "Videos de YouTube", oficial: "Oficiales y redes" };
  const filtros: Boton[] = (["todo", "noticia", "video", "oficial"] as const)
    .filter((t) => t === "todo" || cuantos(t) > 0)
    .map((t) => ({ texto: `${f === t ? "● " : ""}${etiquetas[t]} (${cuantos(t)})`, dato: `i:nf:${t}` }));
  const refs = c.e.refs ?? [];
  await enviar(c.chatId, `🔎 <b>Resultados (${todas.length})</b>\nElige una noticia para <b>escribir sobre ella</b> o <b>referenciarla</b> (irá enlazada al final de la nota; los videos, incrustados).${refs.length ? `\n\n<b>Referencias elegidas (${refs.length}):</b> ${refs.map((r) => esc(r.outlet || r.title)).join(" · ")}` : ""}`, [filtros]);
  const lista = todas.map((n, k) => ({ n, k })).filter((x) => f === "todo" || x.n.type === f).slice(0, 8);
  for (const { n, k } of lista) {
    const marca = n.type === "video" ? "▶ <b>VIDEO</b> · " : n.type === "oficial" ? "🏛️ <b>OFICIAL</b> · " : "";
    await enviar(c.chatId, `${marca}<i>${esc(n.outlet)}${n.date ? ` · ${esc(n.date)}` : ""}</i>\n<b>${esc(n.title)}</b>\n${esc(n.summary)}`, botonesNoticia(c, k));
  }
}

/** «Escribir sobre esto»: la noticia pasa a ser el tema y queda referenciada. */
async function noticiaComoTema(c: Ctx, k: number) {
  const n = c.e.noticias?.[k];
  if (!n) return void (await enviar(c.chatId, "Esa noticia ya no está: busca de nuevo."));
  c.e.topic = `${n.title}. ${n.summary} (Fuente: ${n.outlet}${n.date ? `, ${n.date}` : ""}).`;
  c.e.options = undefined;
  c.e.enOpciones = false;
  if (!esRef(c, n.url)) c.e.refs = [...(c.e.refs ?? []), { title: n.title, outlet: n.outlet, url: n.url, videoId: n.videoId }];
  c.e.fuente = undefined;
  await enviar(c.chatId, "✅ Tema elegido: revisa el tema y pulsa «Proponer títulos y contextos».");
  return pasoTema(c);
}

async function proponer(c: Ctx) {
  const topic = (c.e.topic ?? "").trim();
  if (!topic && !(c.e.material?.length)) return void (await enviar(c.chatId, "Escribe de qué trata la nota (o carga una entrevista o enlaces) y vuelve a pulsar «Proponer títulos y contextos»."));
  await escribiendo(c.chatId);
  await enviar(c.chatId, "🔎 La IA está buscando títulos y contextos…");
  const r = await suggestTitlesAndContextsCore(c.userId, { topic, section: await nombreSeccion(c), material: c.e.material });
  if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`));
  c.e.options = { titles: r.titles, contexts: r.contexts };
  c.e.enOpciones = true;
  c.e.context = undefined;
  await fin(c);
  return pasoOpciones(c);
}

/** «Elige el título y el enfoque»: título y contexto en la misma pantalla, y «Generar borrador con esta selección». */
async function pasoOpciones(c: Ctx) {
  const o = c.e.options;
  if (!o) return pasoTema(c);
  const mat = c.e.material ?? [];
  await enviar(c.chatId, `${cab(c, "tema")}<b>Elige el título y el enfoque</b>\nLa IA propone varios títulos y enfoques a partir de tu material. Elige uno de cada uno (puedes editarlos) y genera el borrador.\n\n<b>Tema:</b> ${esc((c.e.topic?.trim() || mat[0]?.title || "—").slice(0, 160))}${mat.length ? ` · ${mat.length} material${mat.length > 1 ? "es" : ""} cargado${mat.length > 1 ? "s" : ""}` : ""}`, [[{ texto: "⬅️ Cambiar tema o fuente", dato: "i:chg" }]]);
  await enviar(c.chatId, `<b>1 · ELIGE UN TÍTULO</b>\n\n${o.titles.map((t, i) => `<b>${i + 1}.</b> ${esc(t)} <i>(${t.length} car.)</i>`).join("\n")}\n\n<i>Ideal entre 15 y 65 caracteres.</i>`, [
    o.titles.map((_, i) => ({ texto: String(i + 1), dato: `t:${i}` })),
    [{ texto: "✏️ O escribe el tuyo", dato: "t:x" }],
  ]);
  await enviar(c.chatId, `<b>2 · ELIGE UN CONTEXTO</b> (enfoque de la nota)\n\n${o.contexts.map((x, i) => `<b>${i + 1}. ${esc(x.label)}</b>\n${esc(x.text)}`).join("\n\n")}`, [
    o.contexts.map((_, i) => ({ texto: String(i + 1), dato: `c:${i}` })),
    [{ texto: "✏️ Ajustar el contexto", dato: "c:e" }, { texto: "Sin enfoque especial", dato: "c:x" }],
  ]);
  return resumenSeleccion(c);
}

async function resumenSeleccion(c: Ctx) {
  const t = (c.e.title ?? "").trim();
  const ctx = (c.e.context ?? "").trim();
  await enviar(c.chatId, `✅ <b>Título:</b> ${t ? `${esc(t)} <i>(${contador(t.length, 15, 65)})</i>` : "<i>— elige uno o escribe el tuyo —</i>"}\n🎯 <b>Contexto:</b> ${ctx ? esc(ctx.slice(0, 300)) : "<i>sin enfoque especial</i>"}`, [
    [{ texto: c.e.generated ? "✨ Volver a generar" : "✨ Generar borrador con esta selección", dato: "gen" }],
    ...(c.e.generated ? [[{ texto: "➡️ Siguiente (revisar el borrador)", dato: "n:" }]] : []),
    [{ texto: "⬅️ Cambiar tema o fuente", dato: "i:chg" }],
  ]);
}

async function redactar(c: Ctx) {
  const titulo = (c.e.title ?? "").trim();
  const prompt = [c.e.topic, c.e.context].filter(Boolean).join("\n\n");
  if (titulo.length < 5) return void (await enviar(c.chatId, "Escribe o elige un título de al menos 5 caracteres."));
  if (prompt.length < 20 && !(c.e.material?.length)) return void (await enviar(c.chatId, "Añade un poco más de contexto (mínimo 20 caracteres) o carga una entrevista o enlaces."));
  await escribiendo(c.chatId);
  await enviar(c.chatId, "✍️ La IA está redactando el borrador… puede tardar hasta un minuto; al terminar pasas al resumen.");
  const enlaces = (c.e.material ?? []).filter((m) => m.kind === "enlace" && m.url).map((m) => ({ title: m.title, outlet: "", url: m.url! }));
  const refs = (c.e.refs ?? []).map((r) => ({ title: r.title, outlet: r.outlet, url: r.url, videoId: r.videoId }));
  const r = await generateArticleDraftCore(c.userId, {
    title: titulo,
    prompt: prompt || "Redacta la nota a partir del material.",
    section: await nombreSeccion(c),
    material: c.e.material,
    references: [...refs, ...enlaces.filter((x) => !refs.some((y) => y.url === x.url))],
  });
  if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`));
  if (r.mode === "esquema") await enviar(c.chatId, `ℹ️ ${esc(r.note ?? "Sin clave del modelo: solo se generó un esquema.")}`);
  const d = r.draft;
  c.e.generated = true;
  await guardar(c, { title: titulo || d.title, excerpt: d.excerpt, body: d.body, tags: d.tags.map((t) => t.toLowerCase()).slice(0, 12), metaTitle: d.metaTitle, metaDescription: d.metaDescription });
  await enviar(c.chatId, "✅ Borrador listo y guardado en el panel. Revisa cada paso: «Me gusta», «Regenerar» o «Editar».");
  return paso(c, "resumen");
}

// --- Pasos 2 a 9: mismos textos y opciones que el asistente web -----------------------------------------------

const PROPUESTA = "✨ <i>Propuesta de la IA. ¿Te gusta?</i>";
/** «Me gusta · Regenerar · Editar» (modo IA con borrador) o «Siguiente · Editar». */
const revision = (c: Ctx, parte: "resumen" | "claves" | "cuerpo" | "seo", editar: string): Boton[][] =>
  esIA(c) && c.e.generated
    ? [[{ texto: "✅ Me gusta", dato: "n:" }, { texto: "🔄 Regenerar", dato: `r:${parte}` }, { texto: "✏️ Editar", dato: `e:${editar}` }]]
    : [[{ texto: "➡️ Siguiente", dato: "n:" }, { texto: "✏️ Editar", dato: `e:${editar}` }]];

async function paso(c: Ctx, f: Fase) {
  c.e.fase = f;
  c.e.espera = undefined;
  await fin(c);
  const aviso = esIA(c) && c.e.generated ? `\n${PROPUESTA}` : "";
  switch (f) {
    case "tema": return pasoTema(c);
    case "titulo": {
      c.e.espera = "titulo"; await fin(c);
      const t = c.e.title ?? "";
      return void (await enviar(c.chatId, `${cab(c, f)}<b>¿Cuál es el título?</b>\nClaro y concreto: lo que verá el lector y Google. Ideal entre 15 y 65 caracteres.\n\n${t ? `📌 ${esc(t)}\n<i>${contador(t.length, 15, 65)}</i>\n\nEscribe otro para cambiarlo.` : "✏️ <i>Escríbelo aquí abajo. Ej.: El precio del novillo gordo sube 4 % en Medellín</i>"}`, t.trim().length >= 5 ? [[{ texto: "➡️ Siguiente", dato: "n:" }]] : []));
    }
    case "resumen": {
      const x = c.e.excerpt ?? "";
      return void (await enviar(c.chatId, `${cab(c, f)}<b>Resume la noticia</b>\nDos o tres líneas que expliquen por qué importa. Es la entradilla y, por defecto, la descripción en buscadores.${aviso}\n\n${x ? esc(x) : "<i>Escríbelo aquí abajo. Ej.: La Central Ganadera reportó un alza del 4 % frente a agosto por menor oferta…</i>"}\n\n<i>${contador(x.length, 70, 155)}</i>`, [...(x ? revision(c, "resumen", "resumen") : []), ...atras(c)]));
    }
    case "claves": {
      const t = c.e.tags ?? [];
      const filas: Boton[][] = [];
      for (let i = 0; i < t.length; i += 3) filas.push(t.slice(i, i + 3).map((x, k) => ({ texto: `✖ ${x}`, dato: `k:${i + k}` })));
      return void (await enviar(c.chatId, `${cab(c, f)}<b>Palabras clave</b>\nTemas de la nota. Escribe una y envíala (o varias separadas por comas). Ayudan a relacionar artículos y al buscador interno.${aviso}\n\n🏷️ ${t.length ? t.map((x) => esc(x)).join(" · ") : "<i>aún sin palabras clave</i>"}\n<i>${t.length} de 12 · recomendado entre 3 y 6.</i>\nToca una para quitarla.`, [...filas, ...(esIA(c) && c.e.generated ? revision(c, "claves", "claves") : [[{ texto: "➡️ Siguiente", dato: "n:" }, { texto: "✏️ Reemplazar todas", dato: "e:claves" }]]), ...atras(c)]));
    }
    case "portada": return pasoPortada(c);
    case "seccion": return mostrarSecciones(c);
    case "cuerpo": {
      const b = c.e.body ?? "";
      const w = palabras(b);
      return void (await enviar(c.chatId, `${cab(c, f)}<b>Escribe el cuerpo</b>\nSepara los párrafos con una línea en blanco. Empieza una línea con «## » para un intertítulo. Las direcciones https://… se convierten en enlaces.${aviso}\n\n${b ? cuerpoParaTelegram(b) : "<i>Escríbelo aquí abajo.</i>"}\n\n<i>${w} palabras · ${Math.max(1, Math.round(w / 200))} min de lectura${w > 0 && w < 250 ? " · se recomiendan al menos 250" : ""}</i>\n📊 <i>¿La nota tiene cifras? En el siguiente paso, «Gráfica», la IA te arma una (barras, histograma, líneas, área, torta o dona) y la ves antes de insertarla.</i>`, [...(b ? revision(c, "cuerpo", "cuerpo") : []), ...botonVista(c), ...atras(c)]));
    }
    case "grafica": return pasoGrafica(c);
    case "seo": return pasoSeo(c);
    case "final": return pasoFinal(c);
    default: return;
  }
}

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

// --- Portada: ubicación en el sitio + imagen ---------------------------------------------------------------------

async function pasoPortada(c: Ctx) {
  const portOk = await tienePermiso(c.userId, c.role, "portada");
  const pubOk = canPublish(c.role);
  let ubic = "";
  if (c.e.articleId) {
    const [a] = await db.select({ pos: articles.homePosition, b: articles.isBreaking, l: articles.isLive }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
    if (a) ubic = `\n📍 Ahora: <b>${a.pos === null ? "sin destacar (entra por fecha)" : a.pos === 0 ? "portada principal" : a.pos === 1 ? "segunda destacada" : `posición ${a.pos + 1}`}</b> · ⚡ Última hora: <b>${a.b ? "sí" : "no"}</b> · 🔴 En desarrollo: <b>${a.l ? "sí" : "no"}</b>`;
  }
  const filas: Boton[][] = [];
  if (portOk || pubOk) filas.push([{ texto: "📌 Publicar en la portada / distintivos", dato: `d:m:${tk(c)}` }]);
  filas.push([{ texto: c.e.coverUrl ? "🎨 Generar otra con IA" : "🎨 Generar foto con IA", dato: "ph:g" }, { texto: "✏️ Describir la escena", dato: "e:escena" }]);
  if (c.e.coverUrl) filas.push([{ texto: "✏️ Texto alternativo", dato: "e:alt" }, { texto: "🗑️ Quitar la foto", dato: "ph:q" }]);
  filas.push([{ texto: "➡️ Siguiente", dato: "n:" }], ...atras(c));
  await enviar(c.chatId, `${cab(c, "portada")}<b>Portada</b>\nDónde aparece la nota en el sitio y con qué imagen. Todo es opcional.\n\n<b>¿Publicar en la portada del sitio?</b>\nPor defecto la nota entra a la portada por fecha. Aquí puedes fijarla arriba cuando se publique y marcarla como <b>Última hora</b> (avisa por notificación al publicar) o <b>En desarrollo</b> (etiqueta «En vivo»).${portOk || pubOk ? "" : "\n<i>Tu cuenta no ubica notas en la portada: un editor lo hace al publicar.</i>"}${ubic}\n\n<b>Imagen de portada</b>\n${c.e.coverUrl ? `✅ Hay una imagen${c.e.coverAlt ? `: <i>${esc(c.e.coverAlt.slice(0, 120))}</i>` : ""}` : "Sin foto: se usa una ilustración con el nombre de la sección."}\n📷 <i>Envíame una foto, pega la URL de una imagen, o genérala con IA (realista, estilo cine; no retrata personas reales y se publica rotulada «imagen generada con IA»).</i>`, filas);
}

async function portadaIA(c: Ctx) {
  await escribiendo(c.chatId, "upload_photo");
  await enviar(c.chatId, "🎨 Generando la imagen… puede tardar unos 20–40 segundos.");
  const r = await generateCoverImageCore(c.userId, { title: c.e.title ?? "", excerpt: c.e.excerpt, body: c.e.body, section: await nombreSeccion(c), scene: c.e.sceneTxt });
  if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`, [[{ texto: "➡️ Siguiente", dato: "n:" }]]));
  c.e.coverUrl = r.url; c.e.coverAlt = r.alt;
  await guardar(c);
  await tg("sendPhoto", { chat_id: c.chatId, photo: r.url, caption: `🖼️ ${r.alt}`.slice(0, 900) });
  await enviar(c.chatId, "¿Te gusta esta portada? Queda marcada «imagen generada con IA».", [[{ texto: "✅ Usar y seguir", dato: "n:" }, { texto: "🔄 Generar otra", dato: "ph:g" }], ...botonVista(c)]);
}

async function fotoRecibida(c: Ctx, fileId: string) {
  const f = await descargarArchivo(fileId);
  if (!f) return void (await enviar(c.chatId, "⚠️ No pude descargar la foto."));
  const up = await subirImagenBytes(f.bytes, "image/jpeg");
  if (!up.ok) return void (await enviar(c.chatId, `⚠️ ${esc(up.error)}`));
  c.e.coverUrl = up.url; c.e.coverAlt = c.e.title ?? "";
  await guardar(c);
  await enviar(c.chatId, "📷 Foto guardada como portada.", [[{ texto: "✅ Siguiente", dato: "n:" }, { texto: "✏️ Texto alternativo", dato: "e:alt" }]]);
}

// --- Sección y autor (árbol) --------------------------------------------------------------------------------

async function cats() {
  return db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}
async function mostrarSecciones(c: Ctx) {
  const todas = await cats();
  const raices = todas.filter((x) => !x.parentId);
  const rama = c.e.ramaSeccion ? raices.find((r) => r.id === c.e.ramaSeccion) : undefined;
  const sel = todas.find((x) => x.id === c.e.categoryId);
  const cabeza = `${cab(c, "seccion")}<b>Sección y autor</b>\nDónde se publica y quién firma. Puedes dejarlo para después.\n\n📂 <b>Sección</b>${sel ? ` · elegida: <b>${esc(sel.name)}</b>` : ""}\n<i>${raices.length} secciones · ${todas.length - raices.length} subsecciones</i>\n✍️ <b>Autor:</b> ${esc(c.nombre)} — la nota la firma quien la escribe: tu usuario. No se puede cambiar.\n`;
  if (rama) {
    const hijos = todas.filter((x) => x.parentId === rama.id);
    const filas: Boton[][] = [[{ texto: `✔ ${rama.name} (sección)`, dato: `s:${rama.id}` }]];
    for (let i = 0; i < hijos.length; i += 2) filas.push(hijos.slice(i, i + 2).map((h) => ({ texto: h.name, dato: `s:${h.id}` })));
    filas.push([{ texto: "⬅️ Volver", dato: "sr:0" }], ...atras(c));
    return void (await enviar(c.chatId, `${cabeza}\nSubsecciones de <b>${esc(rama.name)}</b>:`, filas));
  }
  const t = `${c.e.title} ${c.e.excerpt} ${(c.e.tags ?? []).join(" ")}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const sug = raices.filter((r) => r.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().split(/\s+/).some((w) => w.length >= 5 && t.includes(w.slice(0, Math.max(5, w.length - 2)))));
  const orden = [...sug, ...raices.filter((r) => !sug.includes(r))];
  const filas: Boton[][] = [];
  for (let i = 0; i < orden.length; i += 2) filas.push(orden.slice(i, i + 2).map((r) => ({ texto: `${sug.includes(r) ? "⭐ " : ""}${r.name}${todas.some((x) => x.parentId === r.id) ? " ›" : ""}`, dato: todas.some((x) => x.parentId === r.id) ? `sr:${r.id}` : `s:${r.id}` })));
  filas.push([{ texto: "Sin sección", dato: "s:0" }, { texto: "➡️ Siguiente", dato: "n:" }], ...atras(c));
  return void (await enviar(c.chatId, `${cabeza}\nElige la sección (⭐ = sugerida; «›» tiene subsecciones), o <b>escribe su nombre</b> para buscarla:`, filas));
}

/** «Buscar sección o subsección…» del asistente web: escribir un nombre lista las coincidencias. */
async function buscarSeccion(c: Ctx, texto: string) {
  const n = (x: string) => x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = n(texto.trim());
  const todas = await cats();
  const hallas = todas.filter((x) => n(x.name).includes(q)).slice(0, 12);
  if (!hallas.length) return void (await enviar(c.chatId, `No encontré ninguna sección con «${esc(texto.slice(0, 60))}». Prueba con otra palabra o elige de la lista.`));
  const filas: Boton[][] = hallas.map((h) => [{ texto: `${h.parentId ? `${todas.find((p) => p.id === h.parentId)?.name ?? ""} › ` : ""}${h.name}`, dato: `s:${h.id}` }]);
  filas.push([{ texto: "⬅️ Ver todas las secciones", dato: "sr:0" }]);
  return void (await enviar(c.chatId, `🔎 Coincidencias para «${esc(texto.slice(0, 60))}»:`, filas));
}

// --- Gráfica con datos ---------------------------------------------------------------------------------------

const tipoActual = (c: Ctx) => (c.e.tipoGrafica as TipoGrafica | undefined) ?? "auto";
const filasTipos = (c: Ctx): Boton[][] => {
  const t = tipoActual(c);
  const b = TIPOS_GRAFICA.map((x) => ({ texto: `${t === x.id ? "● " : ""}${x.label}`, dato: `g:${x.id}` }));
  const filas: Boton[][] = [];
  for (let i = 0; i < b.length; i += 3) filas.push(b.slice(i, i + 3));
  return filas;
};

async function pasoGrafica(c: Ctx) {
  const t = tipoActual(c);
  const hint = TIPOS_GRAFICA.find((x) => x.id === t)?.hint ?? "";
  const tema = c.e.chartTopic?.trim() || c.e.title || "";
  const filas: Boton[][] = [
    ...filasTipos(c),
    [{ texto: c.e.chart ? "✨ Buscar otros datos" : "✨ Generar gráfica", dato: "gg" }, { texto: "✏️ ¿Qué graficar?", dato: "e:graficaTema" }],
  ];
  if (c.e.chart?.pngUrl) filas.push([{ texto: c.e.chartInsertada ? "✅ Actualizar en la nota" : "✅ Insertar en la nota", dato: "gi" }, ...(c.e.chartInsertada ? [{ texto: "🗑️ Quitar de la nota", dato: "gq" }] : [])]);
  filas.push([{ texto: "➡️ Siguiente", dato: "n:" }], ...atras(c));
  await enviar(c.chatId, `${cab(c, "grafica")}<b>Gráfica con datos</b>\nOpcional. La IA busca cifras en la web, las dibuja y tú eliges el tipo. La ves aquí antes de insertarla en la nota.\n\n<b>¿Qué quieres graficar?</b>\n${esc(tema || "Ej.: precio del novillo gordo por mes en 2026")}\n(Escribe otro tema para cambiarlo.)\n\n<b>Tipo de gráfica:</b> ${esc(TIPOS_GRAFICA.find((x) => x.id === t)?.label ?? "")} — <i>${esc(hint)}.${c.e.chart ? " Cambiar el tipo redibuja la misma gráfica." : ""}</i>${c.e.chartInsertada ? "\n✓ Ya está en la nota." : ""}`, filas);
}

async function enviarGrafica(c: Ctx) {
  const ch = c.e.chart;
  if (!ch) return;
  const spec = ch.spec as ChartSpec;
  const png = await graficaPng(spec);
  // La imagen que ves aquí es EXACTAMENTE la que queda de respaldo en la nota: se sube ahora y se guarda su URL.
  const sub = await subirImagenBytes(png, "image/png");
  if (!sub.ok) return void (await enviar(c.chatId, `⚠️ No pude guardar la imagen de la gráfica: ${esc(sub.error)}`));
  ch.pngUrl = sub.url;
  await fin(c);
  const datos = spec.labels.map((l, i) => `• ${esc(l)}: ${spec.series[0].values[i]}`).join("\n");
  await enviarFoto(c.chatId, png, `<b>${esc(spec.title)}</b>\n${esc(spec.unit)}\n\n${datos.slice(0, 600)}\n\n<i>Fuente: ${esc(ch.sourceNote)}. Verifica antes de publicar.</i>`);
  await enviar(c.chatId, `<blockquote expandable><b>Fuentes consultadas (${Math.min(ch.sources.length, 6)})</b>\n${ch.sources.slice(0, 6).map((s) => `🔗 <a href="${esc(s.url)}">${esc(s.title)}</a>`).join("\n")}</blockquote>\n\nDatos que encontró la IA en la web: <b>verifica las fuentes antes de publicar.</b> En la nota se publica la gráfica <b>interactiva</b> (con filtros y fondo transparente) con estos mismos datos; esta imagen queda como respaldo.`, [
    [{ texto: c.e.chartInsertada ? "✅ Actualizar en la nota" : "✅ Insertar en la nota", dato: "gi" }],
    ...(c.e.chartInsertada ? [[{ texto: "🗑️ Quitar de la nota", dato: "gq" }]] : []),
    ...filasTipos(c),
    [{ texto: "✨ Buscar otros datos", dato: "gg" }, { texto: "➡️ Siguiente", dato: "n:" }],
  ]);
}

async function generarGrafica(c: Ctx) {
  await escribiendo(c.chatId, "upload_photo");
  await enviar(c.chatId, "📊 Buscando datos y dibujando…");
  const r = await generateChartCore(c.userId, { topic: c.e.chartTopic?.trim() || c.e.title || "", tipo: tipoActual(c), articulo: textoDeHtml(c.e.body ?? ""), section: await nombreSeccion(c) });
  if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`, [[{ texto: "✏️ Cambiar lo que grafico", dato: "e:graficaTema" }, { texto: "➡️ Siguiente", dato: "n:" }]]));
  c.e.chart = { spec: r.chart, sourceNote: r.sourceNote, sources: r.sources };
  return enviarGrafica(c);
}

/** Cambiar el tipo redibuja la MISMA gráfica (sin volver a buscar datos). */
async function cambiarTipoGrafica(c: Ctx, tipo: TipoGrafica) {
  c.e.tipoGrafica = tipo;
  await fin(c);
  if (!c.e.chart) return pasoGrafica(c);
  const f = aplicarTipo(c.e.chart.spec as ChartSpec, tipo);
  if (!f.ok) return void (await enviar(c.chatId, `⚠️ ${esc(f.error)}`));
  c.e.chart.spec = f.chart;
  await enviarGrafica(c);
  if (c.e.chartInsertada) { insertarGrafica(c); await guardar(c); }
}

const QUITAR_GRAFICA = [/<figure class="lx-chart" data-chart="[\w-]+">[\s\S]*?<\/figure>/g, /<figure><img [^>]*alt="Gráfica:[^>]*>(?:<figcaption>[\s\S]*?<\/figcaption>)?<\/figure>/g];
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
  const faltan = a.items.filter((i) => !i.ok).slice(0, 5).map((i) => `• ${esc(i.text)}`).join("\n");
  const dominio = new URL(siteUrl("/")).host;
  await enviar(c.chatId, `${cab(c, "seo")}<b>Cómo se verá en Google</b>\nOpcional. Si lo dejas vacío se usan el título y el resumen.\n\n<i>${esc(dominio)} › articulo</i>\n<b><u>${esc(mt)}</u></b>\n${esc(md)}\n\n<b>Título SEO:</b> <i>${contador(mt.length, 15, 65)}</i>\n<b>Descripción:</b> <i>${contador(md.length, 70, 155)}</i>${esIA(c) && c.e.generated ? `\n${PROPUESTA}` : ""}\n\n🔎 <b>SEO: ${a.score}/100 · ${scoreLabel(a.score)}</b>\n${a.groups.filter((g) => g.score !== null).map((g) => `${esc(g.label)}: ${g.score} %`).join("\n")}${faltan ? `\n\n<b>Por mejorar:</b>\n${faltan}` : "\n\n✅ Todo en orden."}${a.capped ? "\n\n⚠️ Falta un criterio crítico (firma, fuentes, titular o datos por confirmar): no pasa de «Bueno»." : ""}`, [
    [{ texto: "✏️ Título SEO", dato: "e:metaTitle" }, { texto: "✏️ Descripción", dato: "e:metaDescription" }],
    ...(esIA(c) && c.e.generated ? [[{ texto: "✅ Me gusta", dato: "n:" }, { texto: "🔄 Regenerar", dato: "r:seo" }]] : [[{ texto: "➡️ Continuar", dato: "n:" }]]),
    ...botonVista(c),
    ...atras(c),
  ]);
}

// --- Vista previa y publicación -----------------------------------------------------------------------------

async function pasoFinal(c: Ctx) {
  // Vista previa: la nota completa, como se verá en el sitio (portada, titular, entradilla, cuerpo y gráficas).
  const [info] = c.e.articleId
    ? await db.select({ cat: categories.name, estado: articles.status }).from(articles).leftJoin(categories, eq(articles.categoryId, categories.id)).where(eq(articles.id, c.e.articleId)).limit(1)
    : [];
  if (c.e.coverUrl) await tg("sendPhoto", { chat_id: c.chatId, photo: c.e.coverUrl, caption: `🖼️ ${c.e.coverAlt ?? ""}`.slice(0, 900) });
  await enviar(c.chatId, `${cab(c, "final")}<b>Así se verá en el sitio</b>\n━━━━━━━━━━\n${info?.cat ? `<i>${esc(info.cat.toUpperCase())}</i>\n` : ""}<b>${esc(c.e.title ?? "")}</b>\n\n<i>${esc(c.e.excerpt ?? "")}</i>\n\nPor <b>${esc(c.nombre)}</b>\n━━━━━━━━━━\n\n${cuerpoParaTelegram(c.e.body ?? "")}`);
  for (const m of (c.e.body ?? "").matchAll(/<img [^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g)) {
    await tg("sendPhoto", { chat_id: c.chatId, photo: m[1], caption: `📊 ${textoDeHtml(m[2])}`.slice(0, 900) });
  }
  const pub = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
  const aviso = pub ? "" : `\n\nℹ️ Tu rol (<b>${esc(String(c.role))}</b>) no puede publicar ni programar: envíala a revisión y un editor la publica.`;
  const ya = info?.estado === "publicado";
  return void (await enviar(c.chatId, `🚀 <b>Todo listo</b>\n<b>${esc(c.e.title ?? "")}</b>\n✍️ <b>Firma:</b> ${esc(c.nombre)}\n📌 Estado: <b>${ya ? "publicada" : "borrador"}</b>${ya ? "" : " (aún NO está publicada)"}${aviso}\n\n¿Qué hacemos?`, [
    ...(pub
      ? [[{ texto: "📅 Programar", dato: `f:p:${tk(c)}` }, { texto: "💾 Guardar borrador", dato: `f:b:${tk(c)}` }], [{ texto: ya ? "🚀 Guardar y actualizar" : "🚀 Publicar", dato: `f:pub:${tk(c)}` }]]
      : [[{ texto: "💾 Guardar borrador", dato: `f:b:${tk(c)}` }, { texto: "🔍 Enviar a revisión", dato: `f:r:${tk(c)}` }]]),
    ...botonVista(c),
    [{ texto: "📌 Portada y distintivos", dato: `d:m:${tk(c)}` }],
    [{ texto: "🔗 Abrir en el panel (pide contraseña)", url: enlacePanel(c) }],
    ...atras(c),
  ]));
}

// --- Menú de inicio y entrada ------------------------------------------------------------------------------------

async function menuInicio(c: Ctx) {
  await enviar(c.chatId, "📝 <b>Nuevo artículo</b>\n¿Cómo quieres crearlo?\n\n✨ <b>Con IA:</b> describes el tema (o partes de ideas, noticias, una entrevista o enlaces) y la IA propone títulos y redacta; tú revisas cada paso.\n✍️ <b>Paso a paso:</b> lo escribes tú, un paso por mensaje.\n\nTambién puedes escribirme directamente el tema, pegar enlaces o enviar una nota de voz.", [
    [{ texto: "✨ Con IA", dato: "m:ia" }, { texto: "✍️ Paso a paso", dato: "m:man" }],
  ]);
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

async function entrevista(c: Ctx, fileId: string, mime: string, nombre: string) {
  reiniciarSiTerminada(c);
  if (c.e.fase === "idle") { c.e.modo = "ia"; c.e.fase = "tema"; }
  await escribiendo(c.chatId);
  await enviar(c.chatId, "🎙️ Transcribiendo el audio… puede tardar un par de minutos.");
  const f = await descargarArchivo(fileId);
  if (!f) return void (await enviar(c.chatId, "⚠️ No pude descargar el audio."));
  if (f.bytes.length > 20 * 1024 * 1024) return void (await enviar(c.chatId, "⚠️ El audio supera 20 MB: recórtalo o envíalo por partes."));
  const r = await transcribirAudioBytesCore(c.userId, f.bytes, mime, nombre);
  if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`));
  c.e.material = [...(c.e.material ?? []), r.material];
  c.e.options = undefined;
  await fin(c);
  await tarjetaMaterial(c, c.e.material.length - 1);
  return pasoTema(c);
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
        return void (await enviar(chatId, `✅ ¡Vinculado! Hola, <b>${esc(usr?.name ?? "")}</b>. Escribe /nueva o envíame directamente el contexto de una noticia.`));
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
    return acciones(c, cb.data ?? "", cb.message?.message_id);
  }
  const m = u.message!;

  // Comandos
  if (/^\/(start|ayuda|help)\b/i.test(texto)) return void (await enviar(chatId, AYUDA));
  if (/^\/(nueva|nuevo)\b/i.test(texto)) { await setEstado(chatId, { fase: "idle", ultimoUpdate: u.update_id }); return menuInicio(c); }
  if (/^\/estado\b/i.test(texto)) return estadoNota(c);
  if (/^\/cancelar\b/i.test(texto)) { await setEstado(chatId, { fase: "idle", ultimoUpdate: u.update_id }); return void (await enviar(chatId, "Listo, descartado. Envía /nueva cuando quieras. (Lo que ya estaba guardado queda como borrador en el panel.)")); }
  if (/^\/desvincular\b/i.test(texto)) { await desvincular(chatId); return void (await enviar(chatId, "Telegram desvinculado de tu cuenta.")); }

  // Archivos
  if (m.voice) return entrevista(c, m.voice.file_id, m.voice.mime_type ?? "audio/ogg", "nota-de-voz.ogg");
  if (m.audio) return entrevista(c, m.audio.file_id, m.audio.mime_type ?? "audio/mpeg", m.audio.file_name ?? "audio.mp3");
  if (m.document?.mime_type?.startsWith("audio/")) return entrevista(c, m.document.file_id, m.document.mime_type, m.document.file_name ?? "audio");
  if (m.photo?.length) {
    if (c.e.fase === "portada" || c.e.articleId) return fotoRecibida(c, m.photo[m.photo.length - 1].file_id);
    return void (await enviar(chatId, "Para usar una foto como portada, primero crea la nota con /nueva."));
  }
  if (!texto) return;

  // 1) Un botón pidió un dato concreto («Editar», «Escribir el mío», fecha…).
  if (c.e.espera) return textoEsperado(c, texto);

  // 2) Si no, el texto se interpreta según el paso en que va la nota (igual que escribir en el campo del asistente web).
  switch (c.e.fase) {
    case "tema": return textoTema(c, texto);
    case "titulo": await guardar(c, { title: texto.slice(0, 160) }); return paso(c, "titulo");
    case "resumen": await guardar(c, { excerpt: texto }); return paso(c, "resumen");
    case "cuerpo": await guardar(c, { body: htmlDeTexto(texto) }); return paso(c, "cuerpo");
    case "claves": {
      const nuevos = texto.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter((t) => t && !(c.e.tags ?? []).includes(t));
      if (nuevos.length) await guardar(c, { tags: [...(c.e.tags ?? []), ...nuevos].slice(0, 12) });
      return paso(c, "claves");
    }
    case "grafica": c.e.chartTopic = texto.slice(0, 300); await fin(c); return pasoGrafica(c);
    case "portada":
      if (/^https?:\/\/\S+\.(png|jpe?g|webp|gif|avif)(\?\S*)?$/i.test(texto)) { await guardar(c, { coverUrl: texto, coverAlt: c.e.coverAlt || c.e.title || "" }); return pasoPortada(c); }
      return void (await enviar(chatId, "En este paso envíame una <b>foto</b>, pega la <b>URL de una imagen</b>, o usa los botones (generar con IA, describir la escena, texto alternativo)."));
    case "seccion": return buscarSeccion(c, texto);
    case "seo":
    case "final":
      return void (await enviar(chatId, "Usa los botones de este paso. Para cambiar un texto, pulsa «Editar» o vuelve al paso con /nueva si quieres empezar otra nota."));
    default: {
      // Sin nota en curso: lo que llegue es el tema de una nota nueva con IA.
      reiniciarSiTerminada(c);
      c.e.modo = "ia";
      c.e.fase = "tema";
      return agregarTema(c, texto);
    }
  }
}

/** Texto en el primer paso: según la pestaña abierta es un enfoque, una búsqueda, enlaces o el propio tema. */
async function textoTema(c: Ctx, texto: string) {
  const urls = urlsEn(texto);
  if (c.e.fuente === "ideas" && !urls.length) {
    c.e.ideasFocus = texto.slice(0, 200);
    await fin(c);
    return void (await enviar(c.chatId, `✏️ Enfoque: <b>${esc(c.e.ideasFocus)}</b>. Pulsa «Aconséjame temas».`, [[{ texto: c.e.ideas ? "✨ Buscar otros temas" : "✨ Aconséjame temas", dato: "i:find" }]]));
  }
  if (c.e.fuente === "noticias" && !urls.length) return buscarNoticias(c, texto);
  if (c.e.fuente === "entrevista" && !urls.length) return void (await enviar(c.chatId, "🎙️ Esta pestaña espera un audio: envíame la nota de voz o el archivo. Para escribir el tema pulsa «✏️ Escribir el tema»."));
  return agregarTema(c, texto);
}

/** Texto que un botón pidió explícitamente. */
async function textoEsperado(c: Ctx, texto: string) {
  const w = c.e.espera;
  c.e.espera = undefined;
  switch (w) {
    case "titulo": {
      await guardar(c, { title: texto.slice(0, 160) });
      return c.e.fase === "tema" ? resumenSeleccion(c) : paso(c, c.e.fase);
    }
    case "contexto": c.e.context = texto; await fin(c); return resumenSeleccion(c);
    case "resumen": await guardar(c, { excerpt: texto }); return paso(c, "resumen");
    case "claves": await guardar(c, { tags: texto.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12) }); return paso(c, "claves");
    case "cuerpo": await guardar(c, { body: htmlDeTexto(texto) }); return paso(c, "cuerpo");
    case "metaTitle": await guardar(c, { metaTitle: texto.slice(0, 120) }); return pasoSeo(c);
    case "metaDescription": await guardar(c, { metaDescription: texto.slice(0, 300) }); return pasoSeo(c);
    case "alt": await guardar(c, { coverAlt: texto.slice(0, 300) }); return pasoPortada(c);
    case "escena": c.e.sceneTxt = texto.slice(0, 400); await fin(c); return portadaIA(c);
    case "graficaTema": c.e.chartTopic = texto.slice(0, 300); await fin(c); return pasoGrafica(c);
    case "correccion": {
      const i = c.e.editIdx;
      if (typeof i === "number" && c.e.material?.[i]) { c.e.material[i] = { ...c.e.material[i], text: texto }; c.e.options = undefined; await fin(c); await enviar(c.chatId, `✅ Texto corregido (${texto.length.toLocaleString("es-CO")} car.).`); }
      return pasoTema(c);
    }
    case "fecha": {
      const iso = parseFecha(texto);
      if (!iso) { c.e.espera = "fecha"; await fin(c); return void (await enviar(c.chatId, "No entendí la fecha. Ejemplos: <code>5 de octubre 8pm</code>, <code>05/10 20:00</code>, <code>mañana 7am</code>, <code>lunes 8pm</code>.")); }
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

async function programar(c: Ctx, iso: string) {
  try {
    await guardar(c);
    if (!c.e.articleId) return void (await enviar(c.chatId, "⚠️ No pude guardar la nota para programarla. Inténtalo de nuevo."));
    await programarCore(c.e.articleId, iso);
    const [chk] = await db.select({ status: articles.status }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
    if (chk?.status !== "programado") return void (await enviar(c.chatId, "⚠️ No pude confirmar la programación. Revisa la nota con /estado o en el panel."));
    c.e.fase = "idle";
    await fin(c);
    await enviar(c.chatId, `📅 <b>Programada</b> para ${esc(fmtHora(iso))} (hora de Colombia).\n✍️ Firma: <b>${esc(c.nombre)}</b>\nSe publica sola a esa hora (si el reloj de Supabase está activo; si no, al abrirse el sitio o el panel).${linkVista(c)}\n\n🔗 ${enlacePanel(c)}`);
  } catch (err) {
    await enviar(c.chatId, `⚠️ ${esc(err instanceof Error ? err.message : "No se pudo programar.")}`);
  }
}

/** Portada y distintivos (última hora / en desarrollo): se aplican de inmediato sobre la nota guardada. */
async function menuDistintivos(c: Ctx) {
  if (!c.e.articleId) return void (await enviar(c.chatId, "No tengo una nota en curso. Envía /nueva para empezar."));
  const [a] = await db.select({ title: articles.title, status: articles.status, b: articles.isBreaking, l: articles.isLive, pos: articles.homePosition }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
  if (!a) return void (await enviar(c.chatId, "No encontré esa nota."));
  const pubOk = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
  const portOk = await tienePermiso(c.userId, c.role, "portada");
  if (!pubOk && !portOk) return void (await enviar(c.chatId, "Tu rol no puede destacar en la portada ni marcar distintivos. Un editor lo hace desde el panel."));
  const k = tk(c);
  const filas: Boton[][] = [];
  if (portOk) {
    filas.push([{ texto: `${a.pos === 0 ? "✅" : "📌"} Portada principal`, dato: `d:p0:${k}` }, { texto: `${a.pos === 1 ? "✅" : "📌"} Segunda destacada`, dato: `d:p1:${k}` }]);
    if (a.pos !== null) filas.push([{ texto: "✖ Quitar de la portada", dato: `d:px:${k}` }]);
  }
  const avisosOk = await tienePermiso(c.userId, c.role, "avisos");
  if (avisosOk && a.status === "publicado") filas.push([{ texto: "📣 Avisar a los lectores (notificación)", dato: `d:n:${k}` }]);
  if (pubOk) {
    filas.push([{ texto: `${a.b ? "✅" : "⚡"} Última hora`, dato: `d:b:${k}` }]);
    filas.push([{ texto: `${a.l ? "✅" : "🔴"} En desarrollo (En vivo)`, dato: `d:l:${k}` }]);
  }
  filas.push([{ texto: "⬅️ Listo", dato: `d:ok:${k}` }]);
  const estadoPos = a.pos === null ? "sin fijar (orden por fecha)" : a.pos === 0 ? "portada principal" : a.pos === 1 ? "segunda destacada" : `posición ${a.pos + 1}`;
  await enviar(c.chatId, `📌 <b>Portada y distintivos</b>\n<b>${esc(a.title)}</b>\nPortada: <b>${estadoPos}</b>\n⚡ Última hora: <b>${a.b ? "sí" : "no"}</b> · 🔴 En desarrollo: <b>${a.l ? "sí" : "no"}</b>${a.status !== "publicado" ? "\n\n<i>Se verá en el sitio cuando la nota esté publicada.</i>" : ""}\n\n<i>Última hora: solo se muestra la nota marcada más reciente y, al publicarla, avisa por notificación a quienes tienen la app (una sola vez). En desarrollo pone la etiqueta «En vivo» en la nota.</i>`, filas);
}

async function acciones(c: Ctx, d: string, mid?: number) {
  const [k, v = "", t = ""] = d.split(":");
  if ((k === "f" || k === "p" || k === "d") && t && !(c.e.articleId ?? "").startsWith(t)) {
    return void (await enviar(c.chatId, "Ese botón es de otra nota. Escribe /estado para ver la nota en curso."));
  }
  switch (k) {
    case "m": { // elegir modo: con IA o paso a paso
      await setEstado(c.chatId, { fase: "idle", ultimoUpdate: c.e.ultimoUpdate });
      c.e = await getEstado(c.chatId);
      c.e.modo = v === "man" ? "manual" : "ia";
      return paso(c, v === "man" ? "titulo" : "tema");
    }
    case "b": { // Atrás: al paso anterior (en las opciones del primer paso, vuelve a las fuentes)
      if (c.e.fase === "tema" && c.e.enOpciones) { c.e.enOpciones = false; await fin(c); return pasoTema(c); }
      const l = pasos(c);
      const i = l.indexOf(c.e.fase);
      return i > 0 ? paso(c, l[i - 1]) : undefined;
    }
    case "go": return proponer(c);
    case "gen": return redactar(c);
    case "d": {
      if (!c.e.articleId) return void (await enviar(c.chatId, "No tengo una nota en curso. Envía /nueva para empezar."));
      if (v === "m") { await guardar(c); return menuDistintivos(c); }
      if (v === "n" || v === "nok") {
        if (!(await tienePermiso(c.userId, c.role, "avisos"))) return void (await enviar(c.chatId, "Tu cuenta no tiene permiso para enviar avisos a los lectores."));
        if (!pushConfigurado()) return void (await enviar(c.chatId, "Las notificaciones aún no están configuradas en el sitio (faltan las claves VAPID). Avisa al administrador."));
        const [nota] = await db.select({ title: articles.title, status: articles.status }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
        if (!nota || nota.status !== "publicado") return void (await enviar(c.chatId, "La nota todavía no está publicada: publícala y luego avisa a los lectores."));
        if (v === "n") {
          const n = await contarSuscriptores().catch(() => 0);
          if (!n) return void (await enviar(c.chatId, "Todavía no hay lectores con notificaciones activadas."));
          const repetida = await notaYaAvisada(c.e.articleId);
          return void (await enviar(c.chatId, `📣 <b>¿Enviar la notificación?</b>\n«${esc(nota.title)}»\nLlegará a <b>${n}</b> dispositivo${n === 1 ? "" : "s"} y <b>no se puede retirar</b>.${repetida ? "\n\n⚠️ Esta nota <b>ya se avisó</b> antes; se enviaría de nuevo." : ""}`, [[{ texto: "✅ Sí, enviar", dato: `d:nok:${tk(c)}` }, { texto: "Cancelar", dato: `d:ok:${tk(c)}` }]]));
        }
        const r = await avisarNota(c.e.articleId, { repetir: true, urgente: false });
        return void (await enviar(c.chatId, r.ok ? `📣 Notificación enviada a <b>${r.enviados}</b> dispositivo${r.enviados === 1 ? "" : "s"}${r.caducados ? ` (${r.caducados} suscripción${r.caducados === 1 ? "" : "es"} caducada${r.caducados === 1 ? "" : "s"} eliminada${r.caducados === 1 ? "" : "s"})` : ""}${r.fallidos ? `, ${r.fallidos} con error` : ""}.` : `⚠️ ${esc(r.motivo)}`));
      }
      if (v === "ok") {
        // A mitad del recorrido se vuelve al paso en curso; al terminar, se indica /estado.
        if (c.e.fase !== "idle" && c.e.fase !== "final" && pasos(c).includes(c.e.fase)) return paso(c, c.e.fase);
        return void (await enviar(c.chatId, "Listo. Escribe /estado para ver cómo quedó la nota."));
      }
      const pubOk = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
      const portOk = await tienePermiso(c.userId, c.role, "portada");
      const [a] = await db.select({ b: articles.isBreaking, l: articles.isLive }).from(articles).where(eq(articles.id, c.e.articleId)).limit(1);
      if (!a) return void (await enviar(c.chatId, "No encontré esa nota."));
      if ((v === "b" || v === "l") && !pubOk) return void (await enviar(c.chatId, "Tu rol no puede marcar distintivos."));
      if (v.startsWith("p") && !portOk) return void (await enviar(c.chatId, "Tu cuenta no tiene permiso para la portada."));
      if (v === "b") await distintivosCore(c.e.articleId, { isBreaking: !a.b });
      else if (v === "l") await distintivosCore(c.e.articleId, { isLive: !a.l });
      else if (v === "p0") await fijarPortadaCore(c.e.articleId, 0);
      else if (v === "p1") await fijarPortadaCore(c.e.articleId, 1);
      else if (v === "px") await fijarPortadaCore(c.e.articleId, null);
      return menuDistintivos(c);
    }
    case "i": { // primer paso: pestañas de fuente, ideas, noticias, material
      reiniciarSiTerminada(c);
      if (c.e.fase === "idle") { c.e.modo = "ia"; c.e.fase = "tema"; }
      switch (v) {
        case "ideas": case "noticias": case "entrevista": case "enlaces": c.e.fuente = v; await fin(c); return pasoTema(c);
        case "tema": c.e.fuente = undefined; await fin(c); return void (await enviar(c.chatId, "✏️ Escribe el tema o pega el texto de la noticia (puedes enviar varios mensajes; se suman).", [[{ texto: "✨ Proponer títulos y contextos", dato: "i:prop" }]]));
        case "bt": c.e.topic = undefined; c.e.options = undefined; c.e.enOpciones = false; await fin(c); return pasoTema(c);
        case "prop": return proponer(c);
        case "chg": c.e.enOpciones = false; await fin(c); return pasoTema(c);
        case "find": return buscarIdeas(c);
        case "u": {
          const idea = c.e.ideas?.[Number(t)];
          if (!idea) return void (await enviar(c.chatId, "Esa idea ya no está: pide otras."));
          c.e.topic = `${idea.title}. ${idea.angle}`;
          c.e.options = undefined; c.e.enOpciones = false; c.e.fuente = undefined;
          await fin(c);
          await enviar(c.chatId, "✅ Tema elegido: revisa el tema y pulsa «Proponer títulos y contextos».");
          return pasoTema(c);
        }
        case "nf": c.e.noticiasFiltro = (t || "todo") as NonNullable<EstadoChat["noticiasFiltro"]>; await fin(c); return mostrarNoticias(c);
        case "ns": return noticiaComoTema(c, Number(t));
        case "nr": {
          const n = c.e.noticias?.[Number(t)];
          if (!n) return void (await enviar(c.chatId, "Esa noticia ya no está: busca de nuevo."));
          c.e.refs = esRef(c, n.url) ? (c.e.refs ?? []).filter((r) => r.url !== n.url) : [...(c.e.refs ?? []), { title: n.title, outlet: n.outlet, url: n.url, videoId: n.videoId }];
          await fin(c);
          if (mid) await editarTeclado(c.chatId, mid, botonesNoticia(c, Number(t)));
          return;
        }
        case "mv": {
          const m = c.e.material?.[Number(t)];
          if (!m) return void (await enviar(c.chatId, "Ese material ya no está."));
          return void (await enviar(c.chatId, `📎 <b>${esc(m.title)}</b>\n\n${esc(m.text)}`, [[{ texto: "✏️ Reemplazar el texto", dato: `i:mc:${t}` }, { texto: "🗑️ Quitar", dato: `i:mq:${t}` }]]));
        }
        case "mc": c.e.editIdx = Number(t); c.e.espera = "correccion"; await fin(c); return void (await enviar(c.chatId, "✏️ Envíame el texto corregido completo (reemplaza al actual)."));
        case "mq": c.e.material = (c.e.material ?? []).filter((_, i) => i !== Number(t)); c.e.options = undefined; await fin(c); await enviar(c.chatId, "🗑️ Material quitado."); return pasoTema(c);
        default: return;
      }
    }
    case "t": {
      if (v === "x") { c.e.espera = "titulo"; await fin(c); return void (await enviar(c.chatId, "✏️ Escribe el título que quieres usar (ideal entre 15 y 65 caracteres).")); }
      c.e.title = c.e.options?.titles[Number(v)] ?? c.e.title;
      await fin(c);
      return resumenSeleccion(c);
    }
    case "c": {
      if (v === "e") { c.e.espera = "contexto"; await fin(c); return void (await enviar(c.chatId, `✏️ Escribe el contexto o enfoque que quieres (reemplaza al elegido).${c.e.context ? `\n\nActual:\n<code>${esc(c.e.context.slice(0, 800))}</code>` : ""}`)); }
      c.e.context = v === "x" ? "" : c.e.options?.contexts[Number(v)]?.text ?? "";
      await fin(c);
      return resumenSeleccion(c);
    }
    case "n": {
      // En el primer paso, «Siguiente» hace lo que toca: proponer opciones y, con título elegido, generar el borrador.
      if (c.e.fase === "tema" && !c.e.generated) { if (!c.e.options) return proponer(c); if (!c.e.enOpciones) return pasoOpciones(c); return redactar(c); }
      const b = bloqueo(c);
      if (b) return void (await enviar(c.chatId, `⚠️ ${b}`));
      return siguiente(c);
    }
    case "e": {
      const campo = v;
      const actual = campo === "titulo" ? c.e.title : campo === "resumen" ? c.e.excerpt : campo === "claves" ? (c.e.tags ?? []).join(", ") : campo === "cuerpo" ? textoDeHtml(c.e.body ?? "").replace(/##/g, "## ") : campo === "metaTitle" ? (c.e.metaTitle || c.e.title) : campo === "metaDescription" ? (c.e.metaDescription || c.e.excerpt) : campo === "alt" ? c.e.coverAlt : campo === "escena" ? c.e.sceneTxt : campo === "graficaTema" ? (c.e.chartTopic || c.e.title) : "";
      const pedido: Record<string, string> = {
        titulo: "el nuevo título", resumen: "el nuevo resumen", claves: "el conjunto de palabras clave (separadas por comas; reemplaza a las actuales)",
        cuerpo: "el texto del cuerpo (usa «## » para intertítulos y una línea en blanco entre párrafos)", metaTitle: "el título para buscadores (ideal 15–65 caracteres)",
        metaDescription: "la descripción para buscadores (ideal 70–155 caracteres)", alt: "qué se ve en la foto (texto alternativo)",
        escena: "la escena que quieres ilustrar (si no, la IA la propone); genero la imagen al recibirla", graficaTema: "qué quieres graficar. Ej.: precio del novillo gordo por mes en 2026",
      };
      if (!pedido[campo]) return;
      c.e.espera = campo as NonNullable<EstadoChat["espera"]>;
      await fin(c);
      return void (await enviar(c.chatId, `✏️ Envíame ${pedido[campo]}.${actual ? `\n\nActual:\n<code>${esc(actual.slice(0, 1500))}</code>` : ""}`));
    }
    case "k": { // quitar una palabra clave
      const t2 = (c.e.tags ?? []).filter((_, i) => i !== Number(v));
      await guardar(c, { tags: t2 });
      return paso(c, "claves");
    }
    case "r": { // regenerar una parte (resumen, claves, cuerpo, buscadores)
      const parte: DraftPart = v === "claves" ? "tags" : v === "cuerpo" ? "body" : v === "seo" ? "seo" : "excerpt";
      await escribiendo(c.chatId);
      await enviar(c.chatId, "🔄 Regenerando…");
      const actual = parte === "tags" ? (c.e.tags ?? []).join(", ") : parte === "body" ? c.e.body ?? "" : parte === "seo" ? `${c.e.metaTitle ?? ""}\n${c.e.metaDescription ?? ""}` : c.e.excerpt ?? "";
      const r = await regenerateDraftPartCore(c.userId, { title: c.e.title ?? "", prompt: [c.e.topic, c.e.context].filter(Boolean).join("\n\n") || materialParaPrompt(c.e.material, 8000), part: parte, current: actual, section: await nombreSeccion(c) });
      if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`));
      const val = r.value;
      if (val.tags) await guardar(c, { tags: val.tags.map((t) => t.toLowerCase()).slice(0, 12) });
      if (val.body) await guardar(c, { body: val.body });
      if (val.excerpt) await guardar(c, { excerpt: val.excerpt });
      if (val.metaTitle) await guardar(c, { metaTitle: val.metaTitle });
      if (val.metaDescription) await guardar(c, { metaDescription: val.metaDescription });
      return paso(c, v === "claves" ? "claves" : v === "cuerpo" ? "cuerpo" : v === "seo" ? "seo" : "resumen");
    }
    case "sr": { c.e.ramaSeccion = v === "0" ? undefined : v; await fin(c); return mostrarSecciones(c); }
    case "s": {
      await guardar(c, { categoryId: v === "0" ? undefined : v, ramaSeccion: undefined });
      const nombre = v === "0" ? "Sin sección" : (await cats()).find((x) => x.id === v)?.name ?? "";
      await enviar(c.chatId, `📂 Sección: <b>${esc(nombre)}</b>`);
      return siguiente(c);
    }
    case "g": return cambiarTipoGrafica(c, (v || "auto") as TipoGrafica);
    case "gg": return generarGrafica(c);
    case "gi": {
      if (!insertarGrafica(c)) return void (await enviar(c.chatId, "Primero genera la gráfica."));
      await guardar(c);
      return void (await enviar(c.chatId, "✅ Gráfica insertada en la nota (✓ ya está en la nota).", [[{ texto: "➡️ Siguiente", dato: "n:" }, { texto: "🗑️ Quitar de la nota", dato: "gq" }], ...botonVista(c)]));
    }
    case "gq": {
      c.e.body = QUITAR_GRAFICA.reduce((b, re) => b.replace(re, ""), c.e.body ?? "");
      c.e.chartInsertada = false;
      await guardar(c);
      return void (await enviar(c.chatId, "🗑️ Gráfica quitada de la nota.", [[{ texto: "➡️ Siguiente", dato: "n:" }]]));
    }
    case "ph": {
      if (v === "g") return portadaIA(c);
      if (v === "q") { c.e.coverUrl = undefined; c.e.coverAlt = undefined; await guardar(c); await enviar(c.chatId, "🗑️ Foto quitada: se usará una ilustración con el nombre de la sección."); return pasoPortada(c); }
      return siguiente(c);
    }
    case "f": return finales(c, v);
    case "p": {
      if (v === "otra") { c.e.espera = "fecha"; await fin(c); return void (await enviar(c.chatId, "📅 Escribe la fecha y hora (hora de Colombia). Ej.: <code>5 de octubre 8pm</code>, <code>05/10 20:00</code>, <code>mañana 7am</code> o <code>lunes 8pm</code>.")); }
      const iso = v === "lunes" ? proximoLunes8pm() : parseFecha(v === "man_am" ? "mañana 7:00" : "mañana 20:00");
      return iso ? programar(c, iso) : undefined;
    }
    default: return;
  }
}

async function finales(c: Ctx, v: string) {
  if (!c.e.articleId && !c.e.title) return void (await enviar(c.chatId, "No tengo una nota en curso. Envía /nueva para empezar."));
  await guardar(c);
  if (!c.e.articleId) return void (await enviar(c.chatId, "⚠️ No pude guardar la nota. Inténtalo de nuevo o ábrela en el panel."));
  if (v === "b") { c.e.fase = "idle"; await fin(c); return void (await enviar(c.chatId, `💾 Queda como <b>borrador</b> (no está publicada).\n✍️ Firma: <b>${esc(c.nombre)}</b>\n${linkVista(c)}\n🔗 ${enlacePanel(c)}`)); }
  if (v === "r") { await enviarARevisionCore(c.e.articleId!); c.e.fase = "idle"; await fin(c); return void (await enviar(c.chatId, `🔍 Enviada a <b>revisión</b>: un editor puede publicarla.\n✍️ Firma: <b>${esc(c.nombre)}</b>${linkVista(c)}\n🔗 ${enlacePanel(c)}`)); }
  const pub = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
  if (!pub) return void (await enviar(c.chatId, "Tu cuenta no tiene permiso para publicar ni programar. Puedes enviarla a revisión."));
  if (v === "p") {
    // Lista de comprobación, como en «Programar la publicación» del asistente web.
    const a = auditoria(c);
    const ok = (b: boolean, t: string) => `${b ? "✓" : "○"} ${t}`;
    return void (await enviar(c.chatId, `📅 <b>Programar la publicación</b>\nLa nota queda guardada con todo (foto, gráficas, fuentes) y se publica sola a la hora elegida. Hora de Colombia.\n\n${[
      ok(Boolean(c.e.coverUrl), "Foto de portada"),
      ok((c.e.body ?? "").includes("data-chart="), "Gráfica con datos (si la nota tiene cifras)"),
      ok(true, "Firma (autor)"),
      ok(a.score >= 75, `Puntuación SEO ≥ 75 (ahora ${a.score})`),
    ].join("\n")}\n\n¿Cuándo se publica?`, [[{ texto: "Próximo lunes · 8:00 p. m.", dato: `p:lunes:${tk(c)}` }], [{ texto: "Mañana · 7:00 a. m.", dato: `p:man_am:${tk(c)}` }, { texto: "Mañana · 8:00 p. m.", dato: `p:man_pm:${tk(c)}` }], [{ texto: "Otra fecha…", dato: `p:otra:${tk(c)}` }]]));
  }
  if (v === "pub") return void (await enviar(c.chatId, `⚠️ ¿Publicar <b>ahora</b> «${esc(c.e.title ?? "")}»? Saldrá en el sitio de inmediato.`, [[{ texto: "✅ Sí, publicar", dato: `f:ok:${tk(c)}` }, { texto: "Cancelar", dato: `f:b:${tk(c)}` }]]));
  if (v === "ok") {
    await publicarCore(c.e.articleId);
    const [a] = await db.select({ slug: articles.slug, status: articles.status, firma: authors.name }).from(articles).leftJoin(authors, eq(articles.authorId, authors.id)).where(eq(articles.id, c.e.articleId)).limit(1);
    if (!a || a.status !== "publicado") return void (await enviar(c.chatId, "⚠️ No pude confirmar la publicación. Revisa la nota con /estado o en el panel."));
    c.e.fase = "idle"; await fin(c);
    return void (await enviar(c.chatId, `🚀 <b>Publicada.</b>\n✍️ Firma: <b>${esc(a.firma ?? c.nombre)}</b>\n🔗 ${siteUrl(`/articulo/${a.slug}`)}\n\n¿La destacamos en la portada o la marcamos como última hora?`, [[{ texto: "📌 Portada y distintivos", dato: `d:m:${tk(c)}` }]]));
  }
}
