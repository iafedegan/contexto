"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, Undo2 } from "lucide-react";
import { decodeSpec, renderChartSvg, svgDataUri } from "@/lib/chart-svg";
import { escapeHtml } from "@/lib/escape";

/**
 * Editor del cuerpo tipo procesador de texto: se escribe sobre el texto ya formateado (negrita, intertítulos, listas,
 * citas, enlaces) y no sobre el código HTML. El valor que entrega y recibe es HTML.
 *
 * Las gráficas viajan en el texto como un marcador `[[GRAFICA datos | alt | fuente]]`; aquí se ven dibujadas (bloque
 * que no se edita por dentro) y al guardar vuelven a ser el marcador.
 */

/** Marcador de gráfica → <figure>. Se aplica al cuerpo que se muestra y al que se guarda. */
const MARCADOR_GRAFICA = /(?:<p[^>]*>\s*)?\[\[GRAFICA ([\w-]+) \| ([^|\]]*) \| ([^\]]*)\]\](?:\s*<\/p>)?/g;

/** Convierte los marcadores de gráfica del cuerpo en las figuras que se dibujan. */
export function expandirGraficas(html: string): string {
  return html.replace(MARCADOR_GRAFICA, (marca, datos: string, alt: string, fuente: string) => {
    const spec = decodeSpec(datos);
    if (!spec) return marca;
    return `<figure class="lx-chart" data-chart="${datos}"><img src="${svgDataUri(renderChartSvg(spec))}" alt="${escapeHtml(alt)}" loading="lazy"><figcaption>${escapeHtml(fuente)}</figcaption></figure>`;
  });
}

/** Cuerpo guardado → HTML que se pinta en el editor (las gráficas, como bloques que no se editan por dentro). */
function paraEditor(html: string): string {
  return expandirGraficas(html).replace(/<figure class="lx-chart"/g, '<figure contenteditable="false" class="lx-chart"');
}

/** HTML del editor → cuerpo guardado: las gráficas vuelven a su marcador y se quitan los restos del editor. */
function desdeEditor(el: HTMLElement): string {
  const copia = el.cloneNode(true) as HTMLElement;
  copia.querySelectorAll("figure.lx-chart").forEach((f) => {
    const datos = f.getAttribute("data-chart") ?? "";
    const alt = f.querySelector("img")?.getAttribute("alt") ?? "";
    const fuente = f.querySelector("figcaption")?.textContent ?? "";
    f.replaceWith(copia.ownerDocument.createTextNode(`[[GRAFICA ${datos} | ${alt} | ${fuente}]]`));
  });
  // Al escribir, el navegador deja un <br> suelto en el campo vacío.
  const html = copia.innerHTML.replace(/^(<br\s*\/?>|\s)+$/i, "");
  return html;
}

// Etiquetas que se conservan al pegar desde otra página o desde Word; el resto se aplana a texto.
const PERMITIDAS = new Set(["P", "H2", "H3", "STRONG", "B", "EM", "I", "UL", "OL", "LI", "BLOCKQUOTE", "A", "BR"]);

/** HTML pegado → HTML limpio: solo estructura básica, sin estilos, clases ni scripts. */
function limpiarPegado(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const limpiar = (nodo: Node): string => {
    if (nodo.nodeType === Node.TEXT_NODE) return escapeHtml(nodo.textContent ?? "");
    if (nodo.nodeType !== Node.ELEMENT_NODE) return "";
    const el = nodo as HTMLElement;
    if (["SCRIPT", "STYLE", "META", "LINK", "HEAD"].includes(el.tagName)) return "";
    const dentro = [...el.childNodes].map(limpiar).join("");
    if (!PERMITIDAS.has(el.tagName)) return ["DIV", "TR", "SECTION", "ARTICLE"].includes(el.tagName) ? `<p>${dentro}</p>` : dentro;
    const tag = el.tagName.toLowerCase();
    if (tag === "a") {
      const href = el.getAttribute("href") ?? "";
      return /^(https?:|mailto:)/i.test(href) ? `<a href="${escapeHtml(href)}" rel="noopener">${dentro}</a>` : dentro;
    }
    if (tag === "br") return "<br>";
    // Word marca el texto en negrita con <b style="font-weight:normal">: se respeta el significado, no el nombre de la etiqueta.
    if ((tag === "b" || tag === "strong") && /font-weight:\s*(normal|400)/i.test(el.getAttribute("style") ?? "")) return dentro;
    return `<${tag}>${dentro}</${tag}>`;
  };
  return [...doc.body.childNodes].map(limpiar).join("").replace(/<p>\s*<\/p>/g, "");
}

/** Botón de la barra: no le quita el foco ni la selección al texto. */
function Boton({ titulo, activo, onClick, children }: { titulo: string; activo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-md transition hover:bg-[var(--surface-2)] ${activo ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
    >
      {children}
    </button>
  );
}

export function EditorCuerpo({
  value,
  onChange,
  placeholder,
  resumen,
}: {
  /** Cuerpo en HTML. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Texto de la derecha de la barra (p. ej. «378 palabras · 2 min»). */
  resumen?: React.ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  // Último HTML que salió del editor: si `value` es otro, el cambio vino de fuera (p. ej. la IA reescribió) y se repinta.
  const ultimo = useRef<string | null>(null);
  const rango = useRef<Range | null>(null);
  const [activos, setActivos] = useState<{ bold: boolean; italic: boolean; ul: boolean; ol: boolean; h2: boolean; quote: boolean }>({ bold: false, italic: false, ul: false, ol: false, h2: false, quote: false });
  const [enlace, setEnlace] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el || value === ultimo.current) return;
    el.innerHTML = paraEditor(value);
    ultimo.current = value;
  }, [value]);

  // Emite el HTML actual hacia fuera.
  const emitir = () => {
    const el = caja.current;
    if (!el) return;
    const html = desdeEditor(el);
    ultimo.current = html;
    onChange(html);
  };
  // Qué formatos tiene el punto donde está el cursor (para marcar los botones).
  const leerEstado = () => {
    const sel = window.getSelection();
    if (!sel?.anchorNode || !caja.current?.contains(sel.anchorNode)) return;
    const bloque = (n: Node | null) => {
      for (let e = n instanceof Element ? n : n?.parentElement ?? null; e && e !== caja.current; e = e.parentElement) if (/^(H2|H3|BLOCKQUOTE|LI|P)$/.test(e.tagName)) return e.tagName;
      return "";
    };
    const b = bloque(sel.anchorNode);
    setActivos({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
      h2: b === "H2",
      quote: !!(sel.anchorNode instanceof Node && (sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement)?.closest("blockquote")),
    });
  };
  // Ejecuta una orden de formato y devuelve el foco al texto.
  const orden = (cmd: string, arg?: string) => {
    caja.current?.focus();
    document.execCommand(cmd, false, arg);
    emitir();
    leerEstado();
  };
  // Alterna un bloque (intertítulo o cita): si ya lo es, vuelve a párrafo.
  const bloque = (tag: "h2" | "blockquote") => {
    const clave = tag === "h2" ? activos.h2 : activos.quote;
    orden("formatBlock", clave ? "p" : tag);
  };
  // Guarda la selección antes de pedir la dirección del enlace (el campo le quita el foco al texto).
  const abrirEnlace = () => {
    const sel = window.getSelection();
    rango.current = sel && sel.rangeCount && caja.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setEnlace("https://");
  };
  // Aplica el enlace a lo que estaba seleccionado.
  const aplicarEnlace = () => {
    const url = (enlace ?? "").trim();
    setEnlace(null);
    caja.current?.focus();
    const sel = window.getSelection();
    if (rango.current && sel) {
      sel.removeAllRanges();
      sel.addRange(rango.current);
    }
    if (/^(https?:\/\/|mailto:)\S+$/i.test(url) && url !== "https://") document.execCommand("createLink", false, url);
    emitir();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] focus-within:border-[var(--accent)]">
      <div role="toolbar" aria-label="Formato del texto" className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-[var(--border)] px-2 py-1.5">
        <Boton titulo="Deshacer" onClick={() => orden("undo")}><Undo2 size={15} /></Boton>
        <Boton titulo="Rehacer" onClick={() => orden("redo")}><Redo2 size={15} /></Boton>
        <span aria-hidden className="mx-1 h-5 w-px bg-[var(--border)]" />
        <Boton titulo="Intertítulo" activo={activos.h2} onClick={() => bloque("h2")}><Heading2 size={16} /></Boton>
        <Boton titulo="Negrita (Ctrl+B)" activo={activos.bold} onClick={() => orden("bold")}><Bold size={15} /></Boton>
        <Boton titulo="Cursiva (Ctrl+I)" activo={activos.italic} onClick={() => orden("italic")}><Italic size={15} /></Boton>
        <Boton titulo="Cita textual" activo={activos.quote} onClick={() => bloque("blockquote")}><Quote size={15} /></Boton>
        <span aria-hidden className="mx-1 h-5 w-px bg-[var(--border)]" />
        <Boton titulo="Lista con viñetas" activo={activos.ul} onClick={() => orden("insertUnorderedList")}><List size={16} /></Boton>
        <Boton titulo="Lista numerada" activo={activos.ol} onClick={() => orden("insertOrderedList")}><ListOrdered size={16} /></Boton>
        <Boton titulo="Enlace" onClick={abrirEnlace}><Link2 size={15} /></Boton>
        <Boton titulo="Quitar formato" onClick={() => orden("removeFormat")}><RemoveFormatting size={15} /></Boton>
        {enlace !== null && (
          <span className="ml-1 flex items-center gap-1">
            <input
              autoFocus
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  aplicarEnlace();
                }
                if (e.key === "Escape") setEnlace(null);
              }}
              aria-label="Dirección del enlace"
              className="w-56 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
            />
            <button type="button" onClick={aplicarEnlace} className="lx-link text-xs font-semibold">Aplicar</button>
          </span>
        )}
        {resumen && <span className="ml-auto pr-1 text-xs tabular-nums text-[var(--fg-muted)]">{resumen}</span>}
      </div>
      <div
        ref={caja}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Cuerpo de la nota"
        data-placeholder={placeholder}
        spellCheck
        onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
        onInput={emitir}
        onKeyUp={leerEstado}
        onMouseUp={leerEstado}
        onPaste={(e) => {
          // Se pega solo lo esencial (párrafos, negrita, enlaces…): nada de estilos ni colores de otra página.
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          const texto = e.clipboardData.getData("text/plain");
          const limpio = html
            ? limpiarPegado(html)
            : texto.split(/\n\s*\n/).map((t) => `<p>${escapeHtml(t.trim()).replace(/\n/g, "<br>")}</p>`).join("");
          document.execCommand("insertHTML", false, limpio);
          emitir();
        }}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-base leading-relaxed outline-none empty:before:text-[var(--fg-muted)]/60 empty:before:content-[attr(data-placeholder)]
          [&_p]:my-2.5 [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold
          [&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-6
          [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--accent)] [&_blockquote]:bg-[var(--surface-2)]/50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic
          [&_a]:text-[var(--accent)] [&_a]:underline [&_strong]:font-bold
          [&_figure]:my-4 [&_figure_img]:mx-auto [&_figure_img]:max-h-72 [&_figcaption]:mt-1 [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:text-[var(--fg-muted)]
          [&_details]:my-3 [&_details]:rounded-md [&_details]:border [&_details]:border-[var(--border)] [&_details]:px-3 [&_details]:py-2 [&_summary]:cursor-pointer [&_summary]:text-sm [&_summary]:font-semibold
          [&_iframe]:aspect-video [&_iframe]:w-full"
      />
    </div>
  );
}
