import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories, users } from "@/db/schema";
import { canPublish } from "@/lib/auth";
import { auditArticle, scoreLabel } from "@/lib/seo-audit";
import { encodeSpec, TIPOS_GRAFICA, type ChartSpec, type TipoGrafica } from "@/lib/chart-svg";
import {
  generateArticleDraftCore, generateChartCore, generateCoverImageCore, leerEnlacesCore, regenerateDraftPartCore,
  searchNewsAboutCore, suggestTitlesAndContextsCore, suggestTopicIdeasCore, transcribirAudioBytesCore,
} from "@/lib/ai-core";
import { distintivosCore, enviarARevisionCore, fijarPortadaCore, guardarBorradorCore, programarCore, publicarCore } from "@/lib/article-ops";
import { graficaPng } from "@/lib/chart-png";
import { materialParaPrompt } from "@/lib/material-types";
import { tienePermiso } from "@/lib/permisos-server";
import { descargarArchivo, enviar, enviarFoto, esc, escribiendo, responderCallback, tg, type Boton } from "@/lib/telegram";
import { getEstado, setEstado, vincularConCodigo, vinculoDe, desvincular, type EstadoChat, type Fase } from "@/lib/telegram-store";
import { signPreviewToken } from "@/lib/preview-token";
import { avisarNota, contarSuscriptores, notaYaAvisada, pushConfigurado } from "@/lib/push";
import { siteUrl } from "@/lib/utils";
import { subirImagenBytes } from "@/lib/media-upload";

/**
 * Bot de redacción por Telegram: la persona (vinculada a su cuenta del panel) manda el contexto de la noticia —texto,
 * nota de voz, enlaces— y el bot recorre el MISMO paso a paso del asistente web: títulos y enfoque, borrador,
 * resumen, palabras clave, sección, cuerpo, gráfica, portada, SEO y publicación. Cada paso se guarda como borrador
 * en el panel. Nada se publica sin un botón de confirmación y sin el permiso de publicar de esa cuenta.
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

// Mismo orden y nombres que el asistente web: Título, Resumen, Palabras clave, Sección y autor, Cuerpo, Gráfica, Portada, Buscadores, Vista previa.
const PASOS: Fase[] = ["titulo", "resumen", "claves", "seccion", "cuerpo", "grafica", "portada", "seo", "final"];
const NOMBRE_PASO: Partial<Record<Fase, string>> = {
  titulo: "Título y contexto", resumen: "Resumen", claves: "Palabras clave", seccion: "Sección y autor", cuerpo: "Cuerpo",
  grafica: "Gráfica", portada: "Portada", seo: "Buscadores", final: "Vista previa",
};
const AYUDA =
  "✍️ <b>Redactor de CONtexto Ganadero</b>\n\nEnvíame el <b>contexto de la noticia</b>: texto, una <b>nota de voz</b> (entrevista) o uno o más <b>enlaces</b>. Yo propongo títulos y enfoques, redacto el borrador y te voy mostrando cada paso para que lo apruebes o lo corrijas.\n\n/nueva — empezar otra nota (ideas de la IA, buscar noticias, entrevista de voz o enlaces)\n/estado — ver si la última nota está publicada y quién firma\n/cancelar — descartar el flujo actual\n/ayuda — esta ayuda\n/desvincular — separar este Telegram de tu cuenta";

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
const barra = (c: Ctx, f: Fase) => `Paso ${PASOS.indexOf(f) + 1} de ${PASOS.length} · ${NOMBRE_PASO[f] ?? ""}`;

async function proponer(c: Ctx) {
  await escribiendo(c.chatId);
  await enviar(c.chatId, "🔎 Analizando el contexto y preparando títulos y enfoques…");
  const r = await suggestTitlesAndContextsCore(c.userId, { topic: c.e.topic ?? "", material: c.e.material });
  if (!r.ok) return enviar(c.chatId, `⚠️ ${esc(r.error)}`);
  c.e.options = { titles: r.titles, contexts: r.contexts };
  c.e.fase = "titulos";
  await fin(c);
  const lista = r.titles.map((t, i) => `<b>${i + 1}.</b> ${esc(t)}`).join("\n");
  const filas: Boton[][] = [r.titles.map((_, i) => ({ texto: String(i + 1), dato: `t:${i}` })), [{ texto: "✏️ Escribir el mío", dato: "t:x" }]];
  await enviar(c.chatId, `📰 <b>Elige el título</b>\n\n${lista}`, filas);
}

async function mostrarEnfoques(c: Ctx) {
  const ctxs = c.e.options?.contexts ?? [];
  c.e.fase = "enfoque";
  await fin(c);
  const lista = ctxs.map((x, i) => `<b>${i + 1}. ${esc(x.label)}</b>\n${esc(x.text)}`).join("\n\n");
  await enviar(c.chatId, `🎯 <b>Elige el enfoque</b>\n\n${lista}`, [
    ctxs.map((_, i) => ({ texto: String(i + 1), dato: `c:${i}` })),
    [{ texto: "Sin enfoque especial", dato: "c:x" }],
  ]);
}

async function redactar(c: Ctx) {
  await escribiendo(c.chatId);
  await enviar(c.chatId, "✍️ Redactando el borrador… puede tardar hasta un minuto.");
  const prompt = [c.e.topic, c.e.context].filter(Boolean).join("\n\n");
  const r = await generateArticleDraftCore(c.userId, { title: c.e.title ?? "", prompt: prompt || "Redacta la nota a partir del material.", material: c.e.material, references: (c.e.material ?? []).filter((m) => m.kind === "enlace" && m.url).map((m) => ({ title: m.title, outlet: "", url: m.url! })) });
  if (!r.ok) return enviar(c.chatId, `⚠️ ${esc(r.error)}`);
  if (r.mode === "esquema") await enviar(c.chatId, `ℹ️ ${esc(r.note ?? "Sin clave del modelo: solo se generó un esquema.")}`);
  const d = r.draft;
  await guardar(c, { title: c.e.title || d.title, excerpt: d.excerpt, body: d.body, tags: d.tags.map((t) => t.toLowerCase()).slice(0, 12), metaTitle: d.metaTitle, metaDescription: d.metaDescription });
  await paso(c, "titulo");
}

// --- Un mensaje por paso, igual que el asistente web ----------------------------------------------------------

const OK_ED = (f: string, regen = true): Boton[][] => [[{ texto: "✅ Siguiente", dato: "n:" }, ...(regen ? [{ texto: "🔄 Otra", dato: `r:${f}` }] : []), { texto: "✏️ Editar", dato: `e:${f}` }]];

async function paso(c: Ctx, f: Fase) {
  c.e.fase = f;
  await fin(c);
  const cab = `<i>${barra(c, f)}</i>\n`;
  switch (f) {
    case "titulo":
      return enviar(c.chatId, `${cab}📌 <b>Título</b>\n${esc(c.e.title ?? "")}\n✍️ Firma: <b>${esc(c.nombre)}</b>\n<i>${(c.e.title ?? "").length} caracteres (ideal 15–65)</i>\n\n${c.e.articleId ? "📝 Borrador guardado en el panel." : "⚠️ Aún no está guardada en el panel."}`, OK_ED("titulo", false));
    case "resumen":
      return enviar(c.chatId, `${cab}🧾 <b>Resumen / entradilla</b>\n${esc(c.e.excerpt ?? "")}`, OK_ED("resumen"));
    case "claves":
      return enviar(c.chatId, `${cab}🏷️ <b>Palabras clave</b>\n${esc((c.e.tags ?? []).join(", ") || "—")}\n\n<b>Título SEO:</b> ${esc(c.e.metaTitle ?? "—")}\n<b>Descripción:</b> ${esc(c.e.metaDescription ?? "—")}`, OK_ED("claves"));
    case "seccion":
      return mostrarSecciones(c);
    case "cuerpo":
      return enviar(c.chatId, `${cab}📄 <b>Cuerpo de la nota</b>\n\n${cuerpoParaTelegram(c.e.body ?? "")}`, [...OK_ED("cuerpo"), ...botonVista(c)]);
    case "grafica":
      return enviar(c.chatId, `${cab}📊 <b>Gráfica con datos</b> (opcional)\n¿Quieres que la IA busque cifras y arme una gráfica? Elige el tipo:`, [
        TIPOS_GRAFICA.slice(0, 4).map((t) => ({ texto: t.label, dato: `g:${t.id}` })),
        TIPOS_GRAFICA.slice(4).map((t) => ({ texto: t.label, dato: `g:${t.id}` })),
        [{ texto: "⏭️ Omitir", dato: "n:" }],
      ]);
    case "portada":
      return enviar(c.chatId, `${cab}🖼️ <b>Foto de portada</b> (opcional)\nLa genero con IA a partir de lo que cuenta la nota (realista, estilo cine, ambientada en Colombia) o puedes <b>enviarme una foto</b> ahora.`, [[{ texto: "🎨 Generar con IA", dato: "ph:g" }, { texto: "⏭️ Omitir", dato: "n:" }]]);
    case "seo": {
      const a = auditArticle({ title: c.e.title ?? "", excerpt: c.e.excerpt ?? "", body: c.e.body ?? "", metaTitle: c.e.metaTitle, metaDescription: c.e.metaDescription, tags: c.e.tags, focus: c.e.tags?.[0] || c.e.title, coverImageUrl: c.e.coverUrl ?? "", coverImageAlt: c.e.coverAlt, authorName: c.nombre });
      const faltan = a.items.filter((i) => !i.ok).slice(0, 5).map((i) => `• ${esc(i.text)}`).join("\n");
      return enviar(c.chatId, `${cab}🔎 <b>SEO: ${a.score}/100 · ${scoreLabel(a.score)}</b>\n${a.groups.filter((g) => g.score !== null).map((g) => `${esc(g.label)}: ${g.score} %`).join("\n")}${faltan ? `\n\n<b>Por mejorar:</b>\n${faltan}` : "\n\n✅ Todo en orden."}${a.capped ? "\n\n⚠️ Falta un criterio crítico (firma, fuentes, titular o datos por confirmar): no pasa de «Bueno»." : ""}`, [[{ texto: "✅ Continuar", dato: "n:" }], ...botonVista(c)]);
    }
    case "final": {
      // Vista previa: la nota completa, como se verá en el sitio (portada, titular, entradilla, cuerpo y gráficas).
      const [info] = c.e.articleId
        ? await db.select({ cat: categories.name }).from(articles).leftJoin(categories, eq(articles.categoryId, categories.id)).where(eq(articles.id, c.e.articleId)).limit(1)
        : [];
      if (c.e.coverUrl) await tg("sendPhoto", { chat_id: c.chatId, photo: c.e.coverUrl, caption: `🖼️ ${c.e.coverAlt ?? ""}`.slice(0, 900) });
      await enviar(c.chatId, `${cab}\n━━━━━━━━━━\n${info?.cat ? `<i>${esc(info.cat.toUpperCase())}</i>\n` : ""}<b>${esc(c.e.title ?? "")}</b>\n\n<i>${esc(c.e.excerpt ?? "")}</i>\n\nPor <b>${esc(c.nombre)}</b>\n━━━━━━━━━━\n\n${cuerpoParaTelegram(c.e.body ?? "")}`);
      for (const m of (c.e.body ?? "").matchAll(/<img [^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g)) {
        await tg("sendPhoto", { chat_id: c.chatId, photo: m[1], caption: `📊 ${textoDeHtml(m[2])}`.slice(0, 900) });
      }
      const pub = canPublish(c.role) && (await tienePermiso(c.userId, c.role, "publicar"));
      const aviso = pub ? "" : `\n\nℹ️ Tu rol (<b>${esc(String(c.role))}</b>) no puede publicar ni programar: envíala a revisión y un editor la publica.`;
      return enviar(c.chatId, `🚀 <b>Todo listo</b>\n<b>${esc(c.e.title ?? "")}</b>\n✍️ <b>Firma:</b> ${esc(c.nombre)}\n📌 Estado: <b>borrador</b> (aún NO está publicada)${aviso}\n\n¿Qué hacemos?`, [
        [{ texto: "💾 Dejar en borrador", dato: `f:b:${tk(c)}` }, { texto: "🔍 A revisión", dato: `f:r:${tk(c)}` }],
        ...(pub ? [[{ texto: "📅 Programar", dato: `f:p:${tk(c)}` }, { texto: "🚀 Publicar ahora", dato: `f:pub:${tk(c)}` }]] : []),
        ...botonVista(c),
        [{ texto: "📌 Portada y distintivos", dato: `d:m:${tk(c)}` }],
        [{ texto: "🔗 Abrir en el panel (pide contraseña)", url: enlacePanel(c) }],
      ]);
    }
    default:
      return;
  }
}

async function siguiente(c: Ctx) {
  const i = PASOS.indexOf(c.e.fase);
  if (i < 0 || i >= PASOS.length - 1) return;
  return paso(c, PASOS[i + 1]);
}

// --- Sección (árbol) ------------------------------------------------------------------------------------------

async function cats() {
  return db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}
async function mostrarSecciones(c: Ctx) {
  const todas = await cats();
  const raices = todas.filter((x) => !x.parentId);
  const rama = c.e.ramaSeccion ? raices.find((r) => r.id === c.e.ramaSeccion) : undefined;
  const sel = todas.find((x) => x.id === c.e.categoryId);
  const cab = `<i>${barra(c, "seccion")}</i>\n📂 <b>Sección</b>${sel ? ` · elegida: <b>${esc(sel.name)}</b>` : ""}\nAutor: <b>${esc(c.nombre)}</b> (tu usuario)\n`;
  if (rama) {
    const hijos = todas.filter((x) => x.parentId === rama.id);
    const filas: Boton[][] = [[{ texto: `✔ ${rama.name} (sección)`, dato: `s:${rama.id}` }]];
    for (let i = 0; i < hijos.length; i += 2) filas.push(hijos.slice(i, i + 2).map((h) => ({ texto: h.name, dato: `s:${h.id}` })));
    filas.push([{ texto: "⬅️ Volver", dato: "sr:0" }]);
    return enviar(c.chatId, `${cab}\nSubsecciones de <b>${esc(rama.name)}</b>:`, filas);
  }
  const t = `${c.e.title} ${c.e.excerpt} ${(c.e.tags ?? []).join(" ")}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const sug = raices.filter((r) => r.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().split(/\s+/).some((w) => w.length >= 5 && t.includes(w.slice(0, Math.max(5, w.length - 2)))));
  const orden = [...sug, ...raices.filter((r) => !sug.includes(r))];
  const filas: Boton[][] = [];
  for (let i = 0; i < orden.length; i += 2) filas.push(orden.slice(i, i + 2).map((r) => ({ texto: `${sug.includes(r) ? "⭐ " : ""}${r.name}${todas.some((x) => x.parentId === r.id) ? " ›" : ""}`, dato: todas.some((x) => x.parentId === r.id) ? `sr:${r.id}` : `s:${r.id}` })));
  filas.push([{ texto: "Sin sección", dato: "s:0" }, { texto: "✅ Siguiente", dato: "n:" }]);
  return enviar(c.chatId, `${cab}\nElige la sección (⭐ = sugerida; «›» tiene subsecciones):`, filas);
}

// --- Gráfica / portada ---------------------------------------------------------------------------------------

async function hacerGrafica(c: Ctx, tipo: TipoGrafica) {
  await escribiendo(c.chatId, "upload_photo");
  await enviar(c.chatId, "📊 Buscando cifras en la web y dibujando la gráfica…");
  const r = await generateChartCore(c.userId, { topic: c.e.title ?? "", tipo, articulo: textoDeHtml(c.e.body ?? "") });
  if (!r.ok) return enviar(c.chatId, `⚠️ ${esc(r.error)}`, [[{ texto: "⏭️ Omitir", dato: "n:" }]]);
  const png = await graficaPng(r.chart);
  // La imagen que ves aquí es EXACTAMENTE la que se inserta en la nota: se sube ahora y se guarda su URL.
  const sub = await subirImagenBytes(png, "image/png");
  if (!sub.ok) return enviar(c.chatId, `⚠️ No pude guardar la imagen de la gráfica: ${esc(sub.error)}`, [[{ texto: "⏭️ Omitir", dato: "n:" }]]);
  c.e.chart = { spec: r.chart, sourceNote: r.sourceNote, sources: r.sources, pngUrl: sub.url };
  await fin(c);
  const datos = r.chart.labels.map((l, i) => `• ${esc(l)}: ${r.chart.series[0].values[i]}`).join("\n");
  await enviarFoto(c.chatId, png, `<b>${esc(r.chart.title)}</b>\n${esc(r.chart.unit)}\n\n${datos.slice(0, 600)}\n\n<i>Fuente: ${esc(r.sourceNote)}. Verifica antes de publicar.</i>`);
  await enviar(c.chatId, `<blockquote expandable><b>Fuentes consultadas (${Math.min(r.sources.length, 6)})</b>\n${r.sources.slice(0, 6).map((s) => `🔗 <a href="${esc(s.url)}">${esc(s.title)}</a>`).join("\n")}</blockquote>\n\nEn la nota se publica la gráfica <b>interactiva</b> (con filtros y fondo transparente) con estos mismos datos; esta imagen queda como respaldo. ¿La inserto?`, [
    [{ texto: "✅ Insertar en la nota", dato: "gi" }, { texto: "🔁 Otro tipo", dato: "gt" }],
    [{ texto: "⏭️ Omitir", dato: "n:" }],
  ]);
}
function insertarGrafica(c: Ctx) {
  const ch = c.e.chart; if (!ch?.pngUrl) return false;
  const spec = ch.spec as ChartSpec;
  const fuente = `Fuente: ${ch.sourceNote}. Consultado en: ${ch.sources.slice(0, 3).map((x) => x.title).join(", ")}.`;
  const alt = `Gráfica: ${spec.title} (${spec.unit})`.replace(/"/g, "'");
  // En el sitio se muestra la gráfica INTERACTIVA (con filtros y fondo transparente); la imagen que viste en el chat
  // queda dentro como respaldo (RSS, correo, lectores sin JavaScript). Reemplaza la gráfica anterior para no duplicarla.
  const sinPrevia = (c.e.body ?? "")
    .replace(/<figure class="lx-chart" data-chart="[\w-]+">[\s\S]*?<\/figure>/g, "")
    .replace(/<figure><img [^>]*alt="Gráfica:[^>]*>(?:<figcaption>[\s\S]*?<\/figcaption>)?<\/figure>/g, "");
  c.e.body = `${sinPrevia}<figure class="lx-chart" data-chart="${encodeSpec(spec)}"><img src="${ch.pngUrl}" alt="${esc(alt)}"><figcaption>${esc(fuente)}</figcaption></figure>`;
  return true;
}

async function portadaIA(c: Ctx) {
  await escribiendo(c.chatId, "upload_photo");
  await enviar(c.chatId, "🎨 Generando la imagen… unos 20–40 segundos.");
  const r = await generateCoverImageCore(c.userId, { title: c.e.title ?? "", excerpt: c.e.excerpt, body: c.e.body, section: undefined });
  if (!r.ok) return enviar(c.chatId, `⚠️ ${esc(r.error)}`, [[{ texto: "⏭️ Omitir", dato: "n:" }]]);
  c.e.coverUrl = r.url; c.e.coverAlt = r.alt;
  await guardar(c);
  await tg("sendPhoto", { chat_id: c.chatId, photo: r.url, caption: `🖼️ ${r.alt}`.slice(0, 900) });
  await enviar(c.chatId, "¿Te gusta esta portada? Queda marcada «imagen generada con IA».", [[{ texto: "✅ Usar", dato: "n:" }, { texto: "🔄 Otra", dato: "ph:g" }], ...botonVista(c)]);
}

// --- Menú de inicio: las mismas formas de partir que el asistente web ------------------------------------------

async function menuInicio(c: Ctx) {
  await enviar(c.chatId, "📝 <b>Nueva nota</b>\n¿Cómo quieres partir?\n\nO escríbeme directamente el tema, pega enlaces o envía una nota de voz.", [
    [{ texto: "💡 Ideas de la IA", dato: "i:ideas" }, { texto: "🔎 Buscar noticias", dato: "i:news" }],
    [{ texto: "🎙️ Entrevista de voz", dato: "i:voz" }, { texto: "🔗 Enlaces", dato: "i:links" }],
    [{ texto: "✏️ Escribir el tema", dato: "i:tema" }],
  ]);
}

async function verIdeas(c: Ctx, focus?: string) {
  await escribiendo(c.chatId);
  await enviar(c.chatId, "💡 Buscando en internet qué se está moviendo en el sector (Colombia y el mundo)…");
  const r = await suggestTopicIdeasCore(c.userId, { focus: focus?.slice(0, 200) });
  if (!r.ok) return enviar(c.chatId, `⚠️ ${esc(r.error)}`);
  c.e.ideas = r.ideas.slice(0, 6).map((i) => ({ title: i.title, angle: i.angle, why: i.why, scope: i.scope }));
  c.e.fase = "esperando_enfoque_ideas";
  await fin(c);
  const lista = c.e.ideas.map((i, k) => `<b>${k + 1}.</b> ${i.scope === "local" ? "🇨🇴" : "🌎"} ${esc(i.title)}\n<i>${esc(i.why)}</i>`).join("\n\n");
  const fuentes = r.sources.slice(0, 4).map((x) => `🔗 ${esc(x.title)}`).join("\n");
  await enviar(c.chatId, `💡 <b>Temas con fuentes</b>\n\n${lista}${fuentes ? `\n\n${fuentes}` : ""}\n\nElige uno, o escribe un enfoque (leche, exportaciones, sanidad…) para afinar la búsqueda.`, [
    c.e.ideas.map((_, k) => ({ texto: String(k + 1), dato: `i:u:${k}` })),
    [{ texto: "🔄 Otras ideas", dato: "i:ideas" }],
  ]);
}

async function buscarNoticias(c: Ctx, consulta: string) {
  await escribiendo(c.chatId);
  await enviar(c.chatId, `🔎 Buscando noticias sobre «${esc(consulta.slice(0, 120))}»…`);
  const r = await searchNewsAboutCore(c.userId, { query: consulta });
  if (!r.ok) return enviar(c.chatId, `⚠️ ${esc(r.error)}`);
  c.e.noticias = r.items.slice(0, 6).map((n) => ({ title: n.title, outlet: n.outlet, date: n.date, summary: n.summary, url: n.url }));
  await fin(c);
  const lista = c.e.noticias.map((n, k) => `<b>${k + 1}.</b> ${esc(n.title)}\n<i>${esc(n.outlet)}${n.date ? ` · ${esc(n.date)}` : ""}</i>`).join("\n\n");
  await enviar(c.chatId, `🔎 <b>Resultados</b>\n\n${lista}\n\nElige la que usarás como punto de partida (queda citada como fuente), o escribe otra búsqueda.`, [
    c.e.noticias.map((_, k) => ({ texto: String(k + 1), dato: `i:n:${k}` })),
  ]);
}

// --- Entrada de texto, voz y archivos -----------------------------------------------------------------------

/** Una nota ya guardada o publicada no debe contaminar la siguiente: el contexto nuevo empieza desde cero. */
function reiniciarSiTerminada(c: Ctx) {
  if (c.e.fase !== "idle" || !c.e.articleId) return;
  const ultimo = c.e.ultimoUpdate;
  const o = c.e as Record<string, unknown>;
  for (const k of Object.keys(o)) delete o[k];
  c.e.fase = "idle";
  c.e.ultimoUpdate = ultimo;
}

async function contexto(c: Ctx, texto: string) {
  reiniciarSiTerminada(c);
  const urls = urlsEn(texto);
  if (urls.length) {
    await enviar(c.chatId, `🔗 Leyendo ${urls.length} enlace${urls.length > 1 ? "s" : ""}…`);
    const r = await leerEnlacesCore(c.userId, { urls: urls.join("\n") });
    if (r.ok) {
      c.e.material = [...(c.e.material ?? []), ...r.materiales];
      await enviar(c.chatId, `✅ Leí: ${r.materiales.map((m) => esc(m.title)).join(" · ")}${r.fallidos.length ? `\n⚠️ No pude leer: ${esc(r.fallidos.join(", "))}` : ""}`);
    } else await enviar(c.chatId, `⚠️ ${esc(r.error)}`);
  }
  const sinUrls = texto.replace(/https?:\/\/\S+/g, "").trim();
  if (sinUrls.length > 0) c.e.topic = [c.e.topic, sinUrls].filter(Boolean).join("\n\n");
  if (!c.e.topic && !(c.e.material?.length)) return enviar(c.chatId, "No encontré contexto en tu mensaje. Cuéntame de qué trata la noticia o envíame un enlace o una nota de voz.");
  c.e.fase = "idle";
  await fin(c);
  return proponer(c);
}

async function entrevista(c: Ctx, fileId: string, mime: string, nombre: string) {
  reiniciarSiTerminada(c);
  await escribiendo(c.chatId);
  await enviar(c.chatId, "🎙️ Transcribiendo el audio… puede tardar un par de minutos.");
  const f = await descargarArchivo(fileId);
  if (!f) return enviar(c.chatId, "⚠️ No pude descargar el audio.");
  if (f.bytes.length > 20 * 1024 * 1024) return enviar(c.chatId, "⚠️ El audio supera 20 MB: recórtalo o envíalo por partes.");
  const r = await transcribirAudioBytesCore(c.userId, f.bytes, mime, nombre);
  if (!r.ok) return enviar(c.chatId, `⚠️ ${esc(r.error)}`);
  c.e.material = [...(c.e.material ?? []), r.material];
  await fin(c);
  await enviar(c.chatId, `✅ Transcribí la entrevista (${r.material.text.length.toLocaleString("es-CO")} caracteres).\n\n<i>${esc(r.material.text.slice(0, 500))}…</i>\n\nSi quieres añadir más contexto, escríbelo; si no, sigo con los títulos.`, [[{ texto: "▶️ Proponer títulos", dato: "go" }]]);
}

async function fotoRecibida(c: Ctx, fileId: string) {
  const f = await descargarArchivo(fileId);
  if (!f) return enviar(c.chatId, "⚠️ No pude descargar la foto.");
  const up = await subirImagenBytes(f.bytes, "image/jpeg");
  if (!up.ok) return enviar(c.chatId, `⚠️ ${esc(up.error)}`);
  c.e.coverUrl = up.url; c.e.coverAlt = c.e.title ?? "";
  await guardar(c);
  await enviar(c.chatId, "📷 Foto guardada como portada.", [[{ texto: "✅ Siguiente", dato: "n:" }]]);
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
  const c: Ctx = { chatId, userId: usr.id, nombre: usr.name, role: usr.role, e };
  await setEstado(chatId, e);

  if (cb) {
    await responderCallback(cb.id);
    return acciones(c, cb.data ?? "");
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
    if (c.e.fase === "portada" || c.e.fase === "esperando_foto" || c.e.articleId) return fotoRecibida(c, m.photo[m.photo.length - 1].file_id);
    return void (await enviar(chatId, "Para usar una foto como portada, primero crea la nota con /nueva."));
  }
  if (!texto) return;

  // Texto según la fase
  switch (c.e.fase) {
    case "esperando_titulo": {
      c.e.title = texto.slice(0, 160);
      return mostrarEnfoques(c);
    }
    case "esperando_edicion": {
      const campo = c.e.edit;
      if (campo === "titulo") await guardar(c, { title: texto.slice(0, 160) });
      else if (campo === "resumen") await guardar(c, { excerpt: texto });
      else if (campo === "claves") await guardar(c, { tags: texto.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12) });
      else if (campo === "cuerpo") await guardar(c, { body: htmlDeTexto(texto) });
      return paso(c, campo === "titulo" ? "titulo" : campo === "resumen" ? "resumen" : campo === "claves" ? "claves" : "cuerpo");
    }
    case "esperando_enfoque_ideas": return verIdeas(c, texto);
    case "esperando_busqueda": return buscarNoticias(c, texto);
    case "esperando_fecha": {
      const iso = parseFecha(texto);
      if (!iso) return void (await enviar(chatId, "No entendí la fecha. Ejemplos: <code>5 de octubre 8pm</code>, <code>05/10 20:00</code>, <code>mañana 7am</code>, <code>lunes 8pm</code>."));
      return programar(c, iso);
    }
    default:
      return contexto(c, texto);
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

async function acciones(c: Ctx, d: string) {
  const [k, v = "", t = ""] = d.split(":");
  if ((k === "f" || k === "p" || k === "d") && t && !(c.e.articleId ?? "").startsWith(t)) {
    return void (await enviar(c.chatId, "Ese botón es de otra nota. Escribe /estado para ver la nota en curso."));
  }
  switch (k) {
    case "go": return proponer(c);
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
      if (v === "ok") return void (await enviar(c.chatId, "Listo. Escribe /estado para ver cómo quedó la nota."));
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
    case "i": {
      reiniciarSiTerminada(c);
      if (v === "ideas") return verIdeas(c);
      if (v === "news") { c.e.fase = "esperando_busqueda"; await fin(c); return void (await enviar(c.chatId, "🔎 ¿A quién o qué busco? Escríbelo. Ej.: <i>precio del novillo gordo en Montería</i>, <i>fiebre aftosa Colombia</i>.")); }
      if (v === "voz") { c.e.fase = "idle"; await fin(c); return void (await enviar(c.chatId, "🎙️ Envíame la <b>nota de voz</b> o el audio de la entrevista (hasta 20 MB). La transcribo y sigo con los títulos.")); }
      if (v === "links") { c.e.fase = "idle"; await fin(c); return void (await enviar(c.chatId, "🔗 Pega uno o más <b>enlaces</b> (hasta 5) de noticias o artículos. Los leo y los uso como fuentes.")); }
      if (v === "tema") { c.e.fase = "idle"; await fin(c); return void (await enviar(c.chatId, "✏️ Escribe el tema o pega el texto de la noticia.")); }
      if (v === "u") {
        const idea = c.e.ideas?.[Number(t)];
        if (!idea) return void (await enviar(c.chatId, "Esa idea ya no está. Pide otras con /nueva."));
        c.e.topic = `${idea.title}. ${idea.angle} ${idea.why}`.trim();
        c.e.fase = "idle"; await fin(c);
        return proponer(c);
      }
      if (v === "n") {
        const n = c.e.noticias?.[Number(t)];
        if (!n) return void (await enviar(c.chatId, "Esa noticia ya no está. Busca de nuevo con /nueva."));
        c.e.topic = `${n.title}. ${n.summary} (Fuente: ${n.outlet}${n.date ? `, ${n.date}` : ""}).`;
        c.e.material = [...(c.e.material ?? []), { kind: "enlace", title: n.title, text: n.summary, url: n.url }];
        c.e.fase = "idle"; await fin(c);
        return proponer(c);
      }
      return;
    }
    case "t": {
      if (v === "x") { c.e.fase = "esperando_titulo"; await fin(c); return void (await enviar(c.chatId, "✏️ Escribe el título que quieres usar.")); }
      c.e.title = c.e.options?.titles[Number(v)] ?? c.e.title;
      return mostrarEnfoques(c);
    }
    case "c": {
      c.e.context = v === "x" ? "" : c.e.options?.contexts[Number(v)]?.text ?? "";
      return redactar(c);
    }
    case "n": return siguiente(c);
    case "e": {
      c.e.fase = "esperando_edicion"; c.e.edit = v as EstadoChat["edit"]; await fin(c);
      const actual = v === "titulo" ? c.e.title : v === "resumen" ? c.e.excerpt : v === "claves" ? (c.e.tags ?? []).join(", ") : textoDeHtml(c.e.body ?? "").replace(/##/g, "## ");
      return void (await enviar(c.chatId, `✏️ Envíame el nuevo ${v === "claves" ? "conjunto de palabras clave (separadas por comas)" : v === "cuerpo" ? "texto del cuerpo (usa «## » para intertítulos y una línea en blanco entre párrafos)" : v}.\n\nActual:\n<code>${esc((actual ?? "").slice(0, 1500))}</code>`));
    }
    case "r": {
      const parte = v === "claves" ? "tags" : v === "cuerpo" ? "body" : "excerpt";
      await escribiendo(c.chatId);
      await enviar(c.chatId, "🔄 Preparando otra versión…");
      const actual = parte === "tags" ? (c.e.tags ?? []).join(", ") : parte === "body" ? c.e.body ?? "" : c.e.excerpt ?? "";
      const r = await regenerateDraftPartCore(c.userId, { title: c.e.title ?? "", prompt: [c.e.topic, c.e.context].filter(Boolean).join("\n\n") || materialParaPrompt(c.e.material, 8000), part: parte, current: actual });
      if (!r.ok) return void (await enviar(c.chatId, `⚠️ ${esc(r.error)}`));
      const val = r.value;
      if (val.tags) await guardar(c, { tags: val.tags.map((t) => t.toLowerCase()) });
      if (val.body) await guardar(c, { body: val.body });
      if (val.excerpt) await guardar(c, { excerpt: val.excerpt });
      return paso(c, v === "claves" ? "claves" : v === "cuerpo" ? "cuerpo" : "resumen");
    }
    case "sr": { c.e.ramaSeccion = v === "0" ? undefined : v; await fin(c); return mostrarSecciones(c); }
    case "s": {
      await guardar(c, { categoryId: v === "0" ? undefined : v, ramaSeccion: undefined });
      const nombre = v === "0" ? "Sin sección" : (await cats()).find((x) => x.id === v)?.name ?? "";
      await enviar(c.chatId, `📂 Sección: <b>${esc(nombre)}</b>`);
      return siguiente(c);
    }
    case "g": return hacerGrafica(c, v as TipoGrafica);
    case "gt": return paso(c, "grafica");
    case "gi": {
      if (!insertarGrafica(c)) return void (await enviar(c.chatId, "Primero genera la gráfica."));
      await guardar(c);
      await enviar(c.chatId, "✅ Gráfica insertada en la nota.", botonVista(c));
      return siguiente(c);
    }
    case "ph": {
      if (v === "g") return portadaIA(c);
      return siguiente(c);
    }
    case "f": return finales(c, v);
    case "p": {
      if (v === "otra") { c.e.fase = "esperando_fecha"; await fin(c); return void (await enviar(c.chatId, "📅 Escribe la fecha y hora (hora de Colombia). Ej.: <code>5 de octubre 8pm</code>, <code>05/10 20:00</code>, <code>mañana 7am</code> o <code>lunes 8pm</code>.")); }
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
  if (v === "p") return void (await enviar(c.chatId, "📅 ¿Cuándo se publica?", [[{ texto: "Próximo lunes · 8:00 p. m.", dato: `p:lunes:${tk(c)}` }], [{ texto: "Mañana · 7:00 a. m.", dato: `p:man_am:${tk(c)}` }, { texto: "Mañana · 8:00 p. m.", dato: `p:man_pm:${tk(c)}` }], [{ texto: "Otra fecha…", dato: `p:otra:${tk(c)}` }]]));
  if (v === "pub") return void (await enviar(c.chatId, `⚠️ ¿Publicar <b>ahora</b> «${esc(c.e.title ?? "")}»? Saldrá en el sitio de inmediato.`, [[{ texto: "✅ Sí, publicar", dato: `f:ok:${tk(c)}` }, { texto: "Cancelar", dato: `f:b:${tk(c)}` }]]));
  if (v === "ok") {
    await publicarCore(c.e.articleId);
    const [a] = await db.select({ slug: articles.slug, status: articles.status, firma: authors.name }).from(articles).leftJoin(authors, eq(articles.authorId, authors.id)).where(eq(articles.id, c.e.articleId)).limit(1);
    if (!a || a.status !== "publicado") return void (await enviar(c.chatId, "⚠️ No pude confirmar la publicación. Revisa la nota con /estado o en el panel."));
    c.e.fase = "idle"; await fin(c);
    return void (await enviar(c.chatId, `🚀 <b>Publicada.</b>\n✍️ Firma: <b>${esc(a.firma ?? c.nombre)}</b>\n🔗 ${siteUrl(`/articulo/${a.slug}`)}\n\n¿La destacamos en la portada o la marcamos como última hora?`, [[{ texto: "📌 Portada y distintivos", dato: `d:m:${tk(c)}` }]]));
  }
}
