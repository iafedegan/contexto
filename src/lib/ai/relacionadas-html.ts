/**
 * Remisiones a otras notas de CONtexto Ganadero dentro del cuerpo («Lea en CONtexto ganadero: …»). Sin `server-only`: lo usan el servidor
 * (al redactar) y el editor del panel (al insertar las notas elegidas).
 *
 * Una remisión solo vale si apunta a una nota real. El modelo, al imitar el estilo de quien escribe, inventaba remisiones con título y
 * enlace «#»: no llevaban a ningún sitio. Aquí se quitan esas, y las que sí valen se arman a partir de notas encontradas en el propio sitio.
 */
import { escapeHtml as esc } from "@/lib/escape";

/** Una nota de CONtexto Ganadero que se puede enlazar. */
export type NotaRelacionada = {
  /** `articulo`: nota propia (enlace relativo); `archivo`: del archivo histórico del medio (enlace a su dirección original). */
  kind: "articulo" | "archivo";
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
};

// «Lea en CONtexto ganadero», «Lea también en CONtexto Ganadero»…
const MARCA = String.raw`Lea\s+(?:también\s+)?en\s+CONtexto\s+ganadero`;
const ANCLA = /<a\b[^>]*>[\s\S]*?<\/a>/gi;

// Dirección de un enlace (primera del fragmento), o «» si no tiene.
const hrefDe = (a: string) => {
  const m = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(a);
  return (m?.[1] ?? m?.[2] ?? "").trim();
};
// Un enlace que no lleva a ninguna parte: vacío, «#» o `javascript:`.
const esMuerto = (a: string) => {
  const h = hrefDe(a);
  return h === "" || h === "#" || /^javascript:/i.test(h);
};
const textoDe = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
// ¿Hay algún enlace que sí lleva a algún sitio?
const tieneVivo = (html: string) => (html.match(ANCLA) ?? []).some((a) => !esMuerto(a));

/**
 * Quita las remisiones «Lea en CONtexto ganadero: …» que no llevan a ninguna parte (enlace «#» o sin enlace), tanto las que cierran un
 * párrafo entre paréntesis como las que van en una lista o en su propio párrafo, y desenlaza cualquier otro enlace muerto.
 * Las remisiones con enlace real no se tocan.
 */
export function limpiarRemisiones(html: string): string {
  let s = html ?? "";
  // 1) «… (Lea en CONtexto ganadero: <a href="#">Título</a>)» al final de una frase o párrafo.
  s = s.replace(new RegExp(String.raw`[ \t]*\(\s*${MARCA}\s*:?\s*((?:<a\b[^>]*>[\s\S]*?<\/a>|[^()<])*?)\s*\)`, "gi"), (todo, dentro: string) => (tieneVivo(dentro) ? todo : ""));
  // 2) Elementos de lista que son solo una remisión.
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (todo, dentro: string) => (new RegExp(`^\\s*\\(?\\s*${MARCA}`, "i").test(textoDe(dentro)) && !tieneVivo(dentro) ? "" : todo));
  // 3) Párrafos que son solo una remisión.
  s = s.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (todo, dentro: string) => (new RegExp(`^\\s*\\(?\\s*${MARCA}`, "i").test(textoDe(dentro)) && !tieneVivo(dentro) ? "" : todo));
  // 4) Cualquier otro enlace muerto se queda como texto.
  s = s.replace(ANCLA, (a) => (esMuerto(a) ? a.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, "") : a));
  // 5) Restos vacíos.
  return s.replace(/<(ul|ol)\b[^>]*>\s*<\/\1>/gi, "").replace(/<p\b[^>]*>\s*<\/p>/gi, "");
}

/** Cuántas remisiones «Lea en CONtexto ganadero» sin enlace real hay en el cuerpo. */
export function contarRemisionesMuertas(html: string): number {
  const limpio = limpiarRemisiones(html);
  const cuenta = (t: string) => (t.match(new RegExp(MARCA, "gi")) ?? []).length;
  return Math.max(0, cuenta(html) - cuenta(limpio));
}

// Bloque que este módulo inserta (se reconoce para poder reemplazarlo sin duplicar).
const BLOQUE = /<div class="lx-relacionadas">[\s\S]*?<\/div>/gi;

/** Las notas, como líneas «Lea en CONtexto ganadero: …» con enlace real. */
export function bloqueRelacionadas(notas: Pick<NotaRelacionada, "title" | "url">[]): string {
  if (!notas.length) return "";
  return `<div class="lx-relacionadas">${notas.map((n) => `<p>Lea en CONtexto ganadero: <a href="${esc(n.url)}">${esc(n.title)}</a></p>`).join("")}</div>`;
}

/**
 * Deja en el cuerpo solo remisiones reales: quita las muertas y el bloque anterior de relacionadas e inserta el nuevo antes de los
 * vídeos y las fuentes (o al final). Sin notas, solo limpia.
 */
export function aplicarRelacionadas(html: string, notas: Pick<NotaRelacionada, "title" | "url">[]): string {
  const nuevas = new Set(notas.flatMap((n) => [n.url, esc(n.url)]));
  // También se quita la línea suelta de una nota que ya estaba enlazada (p. ej. si el editor perdió el recuadro): así no se duplica.
  const base = limpiarRemisiones(html)
    .replace(BLOQUE, "")
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (todo, dentro: string) =>
      new RegExp(`^\\s*${MARCA}`, "i").test(textoDe(dentro)) && (dentro.match(ANCLA) ?? []).some((a) => nuevas.has(hrefDe(a))) ? "" : todo,
    );
  const bloque = bloqueRelacionadas(notas);
  if (!bloque) return base;
  const pos = base.search(/<h2>Videos relacionados<\/h2>|<details\b/i);
  return pos >= 0 ? `${base.slice(0, pos)}${bloque}${base.slice(pos)}` : `${base}${bloque}`;
}
