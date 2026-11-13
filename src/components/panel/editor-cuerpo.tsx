"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { BarChart3, Bold, Clapperboard, Highlighter, Italic, Link2, List, ListOrdered, Minus, MessageSquareQuote, Quote, Redo2, RemoveFormatting, Replace, Search, Strikethrough, Subscript, Superscript, Table, Underline, Undo2, Unlink, ZoomIn, ZoomOut } from "lucide-react";
import { decodeSpec, renderChartSvg, svgDataUri } from "@/lib/chart-svg";
import { escapeHtml } from "@/lib/escape";
import { FacebookIcon, InstagramIcon, LinkedinIcon, TiktokIcon, XIcon, YoutubeIcon } from "@/components/social-icons";
import { embedDeCodigo, embedHtml, incrustarEnlaces, NOMBRE_EMBED, parseEmbed, type Embed } from "@/lib/embeds";

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
  return incrustarEnlaces(expandirGraficas(html)).replace(/<figure class="(lx-chart|lx-embed)/g, '<figure contenteditable="false" class="$1');
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
  // Los videos y publicaciones incrustados se ven en el editor como bloques que no se editan por dentro: se limpian las marcas del editor.
  copia.querySelectorAll("figure.lx-embed").forEach((f) => {
    f.removeAttribute("contenteditable");
    f.classList.remove("cg-embed-sel");
  });
  // Al escribir, el navegador deja un <br> suelto en el campo vacío.
  const html = copia.innerHTML.replace(/^(<br\s*\/?>|\s)+$/i, "");
  return html;
}

// Etiquetas que se conservan al pegar desde otra página o desde Word; el resto se aplana a texto.
const PERMITIDAS = new Set(["P", "H2", "H3", "H4", "STRONG", "B", "EM", "I", "U", "S", "SUB", "SUP", "MARK", "UL", "OL", "LI", "BLOCKQUOTE", "A", "BR", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"]);

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

/** Pestañas de la cinta, como en Word. */
type Pestana = "inicio" | "insertar" | "revisar";
const ESTILOS: { valor: string; nombre: string }[] = [
  { valor: "p", nombre: "Párrafo" },
  { valor: "h2", nombre: "Título 2" },
  { valor: "h3", nombre: "Título 3" },
  { valor: "h4", nombre: "Título 4" },
  { valor: "blockquote", nombre: "Cita" },
  { valor: "pre", nombre: "Código" },
];
const campoCinta = "rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--accent)]";
const Sep = () => <span aria-hidden className="mx-1 h-5 w-px bg-[var(--border)]" />;

export function EditorCuerpo({
  value,
  onChange,
  placeholder,
  resumen,
  papel = false,
}: {
  /** Cuerpo en HTML. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Texto de la derecha de la barra (p. ej. «378 palabras · 2 min»). */
  resumen?: React.ReactNode;
  /** Aspecto de página de Word: sin marco propio, barra fija arriba y el desplazamiento lo da quien lo contiene. */
  papel?: boolean;
}) {
  const caja = useRef<HTMLDivElement>(null);
  // Último HTML que salió del editor: si `value` es otro, el cambio vino de fuera (p. ej. la IA reescribió) y se repinta.
  const ultimo = useRef<string | null>(null);
  const rango = useRef<Range | null>(null);
  const [pestana, setPestana] = useState<Pestana>("inicio");
  const [activos, setActivos] = useState({ bold: false, italic: false, u: false, s: false, sub: false, sup: false, mark: false, ul: false, ol: false, quote: false, bloque: "p", tabla: false });
  const [enlace, setEnlace] = useState<string | null>(null);
  // Infografía: dirección de la imagen y su pie (se piden en línea, como el enlace).
  const [infografia, setInfografia] = useState<{ url: string; pie: string } | null>(null);
  const [tabla, setTabla] = useState<{ filas: number; cols: number } | null>(null);
  // Video o publicación de una red social: dirección y ancho (% del texto) que se piden en línea; y la ya insertada que está seleccionada para cambiarle el tamaño.
  const [video, setVideo] = useState<{ url: string; ancho: number; error: string; red?: Embed["tipo"] } | null>(null);
  const [embedSel, setEmbedSel] = useState<{ ancho: number; alinear: "izq" | "centro" | "der"; alto: number | null } | null>(null);
  const embedEl = useRef<HTMLElement | null>(null);
  const [buscar, setBuscar] = useState<{ q: string; r: string; msg: string }>({ q: "", r: "", msg: "" });
  const [zoom, setZoom] = useState(100);
  const [caracteres, setCaracteres] = useState(0);

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el || value === ultimo.current) return;
    el.innerHTML = paraEditor(value);
    ultimo.current = value;
    setCaracteres((el.textContent ?? "").length);
  }, [value]);

  // Emite el HTML actual hacia fuera.
  const emitir = () => {
    const el = caja.current;
    if (!el) return;
    const html = desdeEditor(el);
    ultimo.current = html;
    setCaracteres((el.textContent ?? "").length);
    onChange(html);
  };
  const dentroDe = (n: Node | null, selector: string) => !!(n instanceof Element ? n : n?.parentElement)?.closest(selector);
  // Qué formatos tiene el punto donde está el cursor (para marcar los botones).
  const leerEstado = () => {
    const sel = window.getSelection();
    if (!sel?.anchorNode || !caja.current?.contains(sel.anchorNode)) return;
    const bloqueDe = (n: Node | null) => {
      for (let e = n instanceof Element ? n : n?.parentElement ?? null; e && e !== caja.current; e = e.parentElement) if (/^(H2|H3|H4|BLOCKQUOTE|PRE|P)$/.test(e.tagName)) return e.tagName.toLowerCase();
      return "p";
    };
    setActivos({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      u: document.queryCommandState("underline"),
      s: document.queryCommandState("strikeThrough"),
      sub: document.queryCommandState("subscript"),
      sup: document.queryCommandState("superscript"),
      mark: dentroDe(sel.anchorNode, "mark"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
      quote: dentroDe(sel.anchorNode, "blockquote"),
      bloque: bloqueDe(sel.anchorNode),
      tabla: dentroDe(sel.anchorNode, "td, th"),
    });
  };
  // Ejecuta una orden de formato y devuelve el foco al texto.
  const orden = (cmd: string, arg?: string) => {
    caja.current?.focus();
    document.execCommand(cmd, false, arg);
    emitir();
    leerEstado();
  };
  // Guarda dónde está el cursor (un campo de la cinta le quita el foco al texto) y lo restaura antes de insertar.
  const guardarRango = () => {
    const sel = window.getSelection();
    rango.current = sel && sel.rangeCount && caja.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  };
  const restaurarRango = () => {
    caja.current?.focus();
    const sel = window.getSelection();
    if (rango.current && sel) {
      sel.removeAllRanges();
      sel.addRange(rango.current);
    }
  };
  const bloque = (tag: string) => orden("formatBlock", tag);
  const alternarBloque = (tag: "blockquote") => orden("formatBlock", activos.quote ? "p" : tag);
  // Resaltado: envuelve el texto elegido en <mark> (o lo quita si ya está resaltado).
  const resaltar = () => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !caja.current?.contains(sel.anchorNode)) return;
    if (activos.mark) {
      const marca = (sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement)?.closest("mark");
      if (marca) {
        marca.replaceWith(...Array.from(marca.childNodes));
        emitir();
        leerEstado();
      }
      return;
    }
    const texto = sel.toString();
    if (texto) orden("insertHTML", `<mark>${escapeHtml(texto)}</mark>`);
  };
  // Cita destacada: el texto seleccionado (o una frase de ejemplo) en un bloque grande, con su autor debajo.
  const citaDestacada = () => {
    const sel = window.getSelection();
    const texto = sel && caja.current?.contains(sel.anchorNode) ? sel.toString().trim() : "";
    orden("insertHTML", `<blockquote class="cita-destacada"><p>${escapeHtml(texto || "Escribe aquí la frase destacada")}</p><cite>Nombre de quien lo dice</cite></blockquote><p><br></p>`);
  };
  const abrirInfografia = () => {
    guardarRango();
    setInfografia({ url: "https://", pie: "" });
  };
  // Inserta la imagen (a todo el ancho, ampliable, con su pie y fuente) donde estaba el cursor.
  const aplicarInfografia = () => {
    const datos = infografia;
    setInfografia(null);
    if (!datos || !/^https:\/\/\S+$/i.test(datos.url.trim())) return;
    restaurarRango();
    const pie = escapeHtml(datos.pie.trim() || "Imagen");
    orden("insertHTML", `<figure class="infografia"><img src="${escapeHtml(datos.url.trim())}" alt="${pie}" loading="lazy"><figcaption>${pie}</figcaption></figure><p><br></p>`);
  };
  const abrirVideo = (red?: Embed["tipo"]) => {
    guardarRango();
    setVideo({ url: "https://", ancho: 100, error: "", red });
  };
  // Inserta el video o la publicación (YouTube, Vimeo, X, Instagram, Facebook, TikTok, LinkedIn) donde estaba el cursor, ya dibujado y con el ancho elegido.
  const aplicarVideo = () => {
    const datos = video;
    if (!datos) return;
    const e = embedDeCodigo(datos.url) ?? parseEmbed(datos.url);
    if (!e) return setVideo({ ...datos, error: datos.red ? `No se reconoce el enlace de ${NOMBRE_EMBED[datos.red]}. Pega la dirección de la publicación o el código para incrustar.` : "No se reconoce el enlace. Pega uno de YouTube, Vimeo, X, Instagram, Facebook, TikTok o LinkedIn." });
    if (datos.red && e.tipo !== datos.red) return setVideo({ ...datos, error: `Ese enlace no es de ${NOMBRE_EMBED[datos.red]} (es de ${NOMBRE_EMBED[e.tipo]}).` });
    setVideo(null);
    restaurarRango();
    const html = embedHtml(e, NOMBRE_EMBED[e.tipo], { ancho: datos.ancho, pie: "Pie · Fuente" }).replace('<figure class="', '<figure contenteditable="false" class="');
    orden("insertHTML", `${html}<p><br></p>`);
  };
  // Cambia el ancho (% del texto) del video seleccionado.
  const anchoVideo = (n: number) => {
    const el = embedEl.current;
    if (!el) return;
    const ancho = Math.round(Math.min(100, Math.max(20, n)));
    if (ancho >= 100) el.removeAttribute("style");
    else el.style.width = `${ancho}%`;
    setEmbedSel((e) => (e ? { ...e, ancho } : e));
    emitir();
  };
  // Alineación del video o la publicación: a la izquierda, centrada o a la derecha del texto.
  const alinearVideo = (a: "izq" | "centro" | "der") => {
    const el = embedEl.current;
    if (!el) return;
    el.classList.remove("lx-embed-izq", "lx-embed-der");
    if (a !== "centro") el.classList.add(`lx-embed-${a}`);
    setEmbedSel((e) => (e ? { ...e, alinear: a } : e));
    emitir();
  };
  // Alto (px) de una publicación de red social (los videos mantienen su proporción 16:9).
  const altoVideo = (n: number) => {
    const el = embedEl.current;
    const f = el?.querySelector("iframe");
    if (!f) return;
    const alto = Math.round(Math.min(900, Math.max(250, n)));
    f.setAttribute("height", String(alto));
    setEmbedSel((e) => (e ? { ...e, alto } : e));
    emitir();
  };
  const quitarVideo = () => {
    embedEl.current?.remove();
    embedEl.current = null;
    setEmbedSel(null);
    emitir();
  };
  // Al hacer clic en un video del cuerpo se selecciona (sus controles salen en «Insertar»).
  const alHacerClic = (e: React.MouseEvent<HTMLDivElement>) => {
    const f = (e.target as Element).closest?.("figure.lx-embed") as HTMLElement | null;
    caja.current?.querySelectorAll("figure.cg-embed-sel").forEach((x) => x.classList.remove("cg-embed-sel"));
    if (!f) { embedEl.current = null; return setEmbedSel(null); }
    f.classList.add("cg-embed-sel");
    const m = (f.getAttribute("style") ?? "").match(/width:\s*([\d.]+)%/);
    embedEl.current = f;
    const h = f.classList.contains("lx-embed-social") ? Number(f.querySelector("iframe")?.getAttribute("height")) || 600 : null;
    setEmbedSel({ ancho: m ? Math.round(Number(m[1])) : 100, alinear: f.classList.contains("lx-embed-izq") ? "izq" : f.classList.contains("lx-embed-der") ? "der" : "centro", alto: h });
    // Que no queden abiertos los demás campos de la cinta (enlace, tabla, imagen, video nuevo).
    setEnlace(null); setTabla(null); setInfografia(null); setVideo(null);
    setPestana("insertar");
  };
  const abrirEnlace = () => {
    guardarRango();
    setEnlace("https://");
  };
  const aplicarEnlace = () => {
    const url = (enlace ?? "").trim();
    setEnlace(null);
    restaurarRango();
    if (/^(https?:\/\/|mailto:)\S+$/i.test(url) && url !== "https://") document.execCommand("createLink", false, url);
    emitir();
  };
  // Tabla: la primera fila es de encabezado.
  const aplicarTabla = () => {
    const t = tabla;
    setTabla(null);
    if (!t) return;
    restaurarRango();
    const fila = (celda: "th" | "td") => `<tr>${Array.from({ length: t.cols }, () => `<${celda}><br></${celda}>`).join("")}</tr>`;
    const cuerpo = Array.from({ length: Math.max(0, t.filas - 1) }, () => fila("td")).join("");
    orden("insertHTML", `<table><thead>${fila("th")}</thead><tbody>${cuerpo}</tbody></table><p><br></p>`);
  };
  // Operaciones sobre la tabla donde está el cursor.
  const celdaActual = () => {
    const sel = window.getSelection();
    return (sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest("td, th") as HTMLTableCellElement | null;
  };
  const sobreTabla = (op: "fila+" | "fila-" | "col+" | "col-" | "borrar") => {
    const celda = celdaActual();
    const tr = celda?.parentElement as HTMLTableRowElement | null;
    const tb = celda?.closest("table");
    if (!celda || !tr || !tb) return;
    const idx = celda.cellIndex;
    if (op === "borrar") tb.remove();
    if (op === "fila+") {
      const nueva = tr.cloneNode(true) as HTMLTableRowElement;
      nueva.querySelectorAll("th, td").forEach((c) => { const td = document.createElement("td"); td.innerHTML = "<br>"; c.replaceWith(td); });
      (tr.parentElement?.tagName === "THEAD" ? tb.tBodies[0] ?? tr.parentElement : tr.parentElement)?.insertBefore(nueva, tr.parentElement?.tagName === "THEAD" ? tb.tBodies[0]?.firstChild ?? null : tr.nextSibling);
    }
    if (op === "fila-" && tb.rows.length > 1) tr.remove();
    if (op === "col+") Array.from(tb.rows).forEach((r) => { const c = document.createElement(r.parentElement?.tagName === "THEAD" ? "th" : "td"); c.innerHTML = "<br>"; r.insertBefore(c, r.cells[idx + 1] ?? null); });
    if (op === "col-" && tr.cells.length > 1) Array.from(tb.rows).forEach((r) => r.cells[idx]?.remove());
    emitir();
    leerEstado();
  };
  // Buscar y reemplazar dentro del cuerpo.
  const siguiente = () => {
    if (!buscar.q) return;
    caja.current?.focus();
    const w = window as unknown as { find?: (q: string, cs?: boolean, back?: boolean, wrap?: boolean) => boolean };
    const hallado = w.find ? w.find(buscar.q, false, false, true) : false;
    setBuscar((b) => ({ ...b, msg: hallado ? "" : "No se encontró." }));
  };
  const reemplazarUno = () => {
    const sel = window.getSelection();
    if (buscar.q && sel && caja.current?.contains(sel.anchorNode) && sel.toString().toLowerCase() === buscar.q.toLowerCase()) orden("insertText", buscar.r);
    siguiente();
  };
  const reemplazarTodo = () => {
    const el = caja.current;
    if (!el || !buscar.q) return;
    const re = new RegExp(buscar.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let n = 0;
    const paso = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodos: Text[] = [];
    for (let t = paso.nextNode(); t; t = paso.nextNode()) nodos.push(t as Text);
    for (const t of nodos) {
      if (t.parentElement?.closest("figure.lx-chart")) continue;
      const nuevo = (t.textContent ?? "").replace(re, () => { n += 1; return buscar.r; });
      if (nuevo !== t.textContent) t.textContent = nuevo;
    }
    setBuscar((b) => ({ ...b, msg: n ? `${n} reemplazo${n === 1 ? "" : "s"}.` : "No se encontró." }));
    if (n) emitir();
  };

  const tabClase = (t: Pestana) => `rounded-t-md px-3 py-1.5 text-xs font-semibold transition ${pestana === t ? "bg-white text-[var(--accent)] shadow-[0_-1px_0_var(--border)_inset]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`;

  return (
    <div style={papel ? ({ "--surface": "#ffffff", "--bg-2": "#f3f4f3", "--surface-2": "#eceeed", "--fg": "#1b1b1b", "--fg-muted": "#5b665f", "--border": "rgba(0,0,0,0.16)", "--border-strong": "rgba(0,0,0,0.3)" } as React.CSSProperties) : undefined} className={papel ? "flex flex-col bg-white text-[#1b1b1b]" : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] focus-within:border-[var(--accent)]"}>
      {/* Cinta de herramientas por pestañas, como en Word */}
      <div className={`shrink-0 border-b border-[var(--border)] ${papel ? "sticky top-0 z-10 bg-[#f3f4f3]" : "bg-[var(--surface-2)]/40"}`}>
        <div role="tablist" aria-label="Cinta de herramientas" className="flex items-end gap-1 px-2 pt-1.5">
          <button type="button" role="tab" aria-selected={pestana === "inicio"} onClick={() => setPestana("inicio")} className={tabClase("inicio")}>Inicio</button>
          <button type="button" role="tab" aria-selected={pestana === "insertar"} onClick={() => setPestana("insertar")} className={tabClase("insertar")}>Insertar</button>
          <button type="button" role="tab" aria-selected={pestana === "revisar"} onClick={() => setPestana("revisar")} className={tabClase("revisar")}>Revisar</button>
          <span className="ml-auto pb-1 pr-1 text-xs tabular-nums text-[var(--fg-muted)]">{resumen ? <>{resumen} · </> : null}{caracteres.toLocaleString("es-CO")} caracteres</span>
        </div>
        <div role="toolbar" aria-label="Formato del texto" className="flex min-h-[2.75rem] flex-wrap items-center gap-0.5 border-t border-[var(--border)] bg-white px-2 py-1.5">
          {pestana === "inicio" && (
            <>
              <Boton titulo="Deshacer (Ctrl+Z)" onClick={() => orden("undo")}><Undo2 size={15} /></Boton>
              <Boton titulo="Rehacer" onClick={() => orden("redo")}><Redo2 size={15} /></Boton>
              <Sep />
              <select
                aria-label="Estilo del párrafo"
                value={activos.bloque}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => bloque(e.target.value)}
                className={`${campoCinta} h-8 w-32`}
              >
                {ESTILOS.map((e) => <option key={e.valor} value={e.valor}>{e.nombre}</option>)}
              </select>
              <Sep />
              <Boton titulo="Negrita (Ctrl+B)" activo={activos.bold} onClick={() => orden("bold")}><Bold size={15} /></Boton>
              <Boton titulo="Cursiva (Ctrl+I)" activo={activos.italic} onClick={() => orden("italic")}><Italic size={15} /></Boton>
              <Boton titulo="Subrayado (Ctrl+U)" activo={activos.u} onClick={() => orden("underline")}><Underline size={15} /></Boton>
              <Boton titulo="Tachado" activo={activos.s} onClick={() => orden("strikeThrough")}><Strikethrough size={15} /></Boton>
              <Boton titulo="Subíndice" activo={activos.sub} onClick={() => orden("subscript")}><Subscript size={15} /></Boton>
              <Boton titulo="Superíndice" activo={activos.sup} onClick={() => orden("superscript")}><Superscript size={15} /></Boton>
              <Boton titulo="Resaltar el texto elegido" activo={activos.mark} onClick={resaltar}><Highlighter size={15} /></Boton>
              <Sep />
              <Boton titulo="Lista con viñetas" activo={activos.ul} onClick={() => orden("insertUnorderedList")}><List size={16} /></Boton>
              <Boton titulo="Lista numerada" activo={activos.ol} onClick={() => orden("insertOrderedList")}><ListOrdered size={16} /></Boton>
              <Boton titulo="Cita textual" activo={activos.quote} onClick={() => alternarBloque("blockquote")}><Quote size={15} /></Boton>
              <Boton titulo="Cita destacada (frase grande con su autor)" onClick={citaDestacada}><MessageSquareQuote size={15} /></Boton>
              <Sep />
              <Boton titulo="Quitar formato" onClick={() => orden("removeFormat")}><RemoveFormatting size={15} /></Boton>
            </>
          )}
          {pestana === "insertar" && (
            <>
              <Boton titulo="Enlace" onClick={abrirEnlace}><Link2 size={15} /></Boton>
              <Boton titulo="Quitar enlace" onClick={() => orden("unlink")}><Unlink size={15} /></Boton>
              <Sep />
              <Boton titulo="Imagen o infografía (a todo el ancho, con su pie)" onClick={abrirInfografia}><BarChart3 size={15} /></Boton>
              <Boton titulo="Video o publicación de cualquier red (YouTube, Vimeo, X, Instagram, Facebook, TikTok, LinkedIn)" onClick={() => abrirVideo()}><Clapperboard size={15} /></Boton>
              <Sep />
              <Boton titulo="Video de YouTube" activo={video?.red === "youtube"} onClick={() => abrirVideo("youtube")}><YoutubeIcon size={16} /></Boton>
              <Boton titulo="Publicación de X" activo={video?.red === "x"} onClick={() => abrirVideo("x")}><XIcon size={15} /></Boton>
              <Boton titulo="Publicación de Instagram" activo={video?.red === "instagram"} onClick={() => abrirVideo("instagram")}><InstagramIcon size={16} /></Boton>
              <Boton titulo="Publicación de Facebook" activo={video?.red === "facebook"} onClick={() => abrirVideo("facebook")}><FacebookIcon size={16} /></Boton>
              <Boton titulo="Video de TikTok" activo={video?.red === "tiktok"} onClick={() => abrirVideo("tiktok")}><TiktokIcon size={16} /></Boton>
              <Boton titulo="Publicación de LinkedIn" activo={video?.red === "linkedin"} onClick={() => abrirVideo("linkedin")}><LinkedinIcon size={16} /></Boton>
              <Sep />
              <Boton titulo="Tabla" onClick={() => { guardarRango(); setTabla({ filas: 3, cols: 3 }); }}><Table size={15} /></Boton>
              <Boton titulo="Línea separadora" onClick={() => orden("insertHorizontalRule")}><Minus size={16} /></Boton>
              {activos.tabla && (
                <>
                  <Sep />
                  <span className="text-xs font-semibold text-[var(--fg-muted)]">Tabla:</span>
                  {([["fila+", "+ Fila"], ["fila-", "− Fila"], ["col+", "+ Columna"], ["col-", "− Columna"], ["borrar", "Borrar tabla"]] as const).map(([op, nombre]) => (
                    <button key={op} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => sobreTabla(op)} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]">{nombre}</button>
                  ))}
                </>
              )}
              {enlace !== null && (
                <span className="ml-1 flex items-center gap-1">
                  <input autoFocus value={enlace} onChange={(e) => setEnlace(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarEnlace(); } if (e.key === "Escape") setEnlace(null); }} aria-label="Dirección del enlace" className={`${campoCinta} w-56`} />
                  <button type="button" onClick={aplicarEnlace} className="lx-link text-xs font-semibold">Aplicar</button>
                </span>
              )}
              {infografia !== null && (
                <span className="ml-1 flex flex-wrap items-center gap-1">
                  <input autoFocus value={infografia.url} onChange={(e) => setInfografia({ ...infografia, url: e.target.value })} aria-label="Dirección de la imagen" placeholder="https://… (imagen)" className={`${campoCinta} w-52`} />
                  <input value={infografia.pie} onChange={(e) => setInfografia({ ...infografia, pie: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarInfografia(); } if (e.key === "Escape") setInfografia(null); }} aria-label="Pie y fuente de la imagen" placeholder="Pie y fuente" className={`${campoCinta} w-44`} />
                  <button type="button" onClick={aplicarInfografia} className="lx-link text-xs font-semibold">Insertar</button>
                </span>
              )}
              {video !== null && (
                <span className="ml-1 flex flex-wrap items-center gap-1 text-xs">
                  <input autoFocus value={video.url} onChange={(e) => setVideo({ ...video, url: e.target.value, error: "" })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarVideo(); } if (e.key === "Escape") setVideo(null); }} aria-label="Dirección del video o de la publicación" placeholder={video.red ? `Enlace o código de ${NOMBRE_EMBED[video.red]}` : "https://… (YouTube, Instagram, X, TikTok…)"} className={`${campoCinta} w-64`} />
                  <label className="flex items-center gap-1">Ancho
                    <select value={video.ancho} onChange={(e) => setVideo({ ...video, ancho: Number(e.target.value) })} className={campoCinta}>
                      {[[40, "Pequeño"], [60, "Mediano"], [80, "Grande"], [100, "Completo"]].map(([v, n]) => <option key={v} value={v}>{n} · {v}%</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={aplicarVideo} className="lx-link font-semibold">Insertar</button>
                  <span className="basis-full text-[var(--fg-muted)]">Luego haz clic sobre lo insertado para cambiar su ancho, alto (redes) y alineación.</span>
                  <button type="button" onClick={() => setVideo(null)} className="text-[var(--fg-muted)] hover:text-[var(--fg)]">Cancelar</button>
                  {video.error && <span role="alert" className="text-[var(--danger,#b4442e)]">{video.error}</span>}
                </span>
              )}
              {embedSel !== null && (
                <span className="ml-1 flex flex-wrap items-center gap-2 text-xs">
                  <Sep />
                  <span className="font-semibold text-[var(--fg-muted)]">Seleccionado (video o publicación):</span>
                  <label className="flex items-center gap-1.5">Ancho
                    <input type="range" min={20} max={100} step={5} value={embedSel.ancho} onChange={(e) => anchoVideo(Number(e.target.value))} aria-label="Ancho del video en porcentaje del texto" className="w-28 accent-[var(--accent)]" />
                    <span className="w-9 tabular-nums">{embedSel.ancho}%</span>
                  </label>
                  {embedSel.alto !== null && (
                    <label className="flex items-center gap-1.5">Alto
                      <input type="range" min={250} max={900} step={10} value={embedSel.alto} onChange={(e) => altoVideo(Number(e.target.value))} aria-label="Alto de la publicación en píxeles" className="w-28 accent-[var(--accent)]" />
                      <span className="w-12 tabular-nums">{embedSel.alto}px</span>
                    </label>
                  )}
                  <span role="group" aria-label="Alineación" className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
                    {([["izq", "Izquierda"], ["centro", "Centro"], ["der", "Derecha"]] as const).map(([v, n]) => (
                      <button key={v} type="button" aria-pressed={embedSel.alinear === v} onClick={() => alinearVideo(v)} className={`px-2 py-1 font-medium transition ${embedSel.alinear === v ? "bg-[var(--accent)] text-[var(--accent-fg,#fff)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>{n}</button>
                    ))}
                  </span>
                  <button type="button" onClick={quitarVideo} className="rounded-md border border-[var(--border)] px-2 py-1 font-medium text-[var(--fg-muted)] transition hover:border-[var(--danger,#b4442e)] hover:text-[var(--danger,#b4442e)]">Quitar</button>
                </span>
              )}
              {tabla !== null && (
                <span className="ml-1 flex flex-wrap items-center gap-1 text-xs">
                  <label className="flex items-center gap-1">Filas <input type="number" min={1} max={20} value={tabla.filas} onChange={(e) => setTabla({ ...tabla, filas: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })} className={`${campoCinta} w-14`} /></label>
                  <label className="flex items-center gap-1">Columnas <input type="number" min={1} max={8} value={tabla.cols} onChange={(e) => setTabla({ ...tabla, cols: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })} className={`${campoCinta} w-14`} /></label>
                  <button type="button" onClick={aplicarTabla} className="lx-link font-semibold">Insertar</button>
                  <button type="button" onClick={() => setTabla(null)} className="text-[var(--fg-muted)] hover:text-[var(--fg)]">Cancelar</button>
                </span>
              )}
            </>
          )}
          {pestana === "revisar" && (
            <>
              <Search size={15} aria-hidden className="text-[var(--fg-muted)]" />
              <input value={buscar.q} onChange={(e) => setBuscar({ ...buscar, q: e.target.value, msg: "" })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); siguiente(); } }} placeholder="Buscar" aria-label="Buscar en el cuerpo" className={`${campoCinta} w-36`} />
              <button type="button" onClick={siguiente} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]">Buscar siguiente</button>
              <Replace size={15} aria-hidden className="ml-1 text-[var(--fg-muted)]" />
              <input value={buscar.r} onChange={(e) => setBuscar({ ...buscar, r: e.target.value })} placeholder="Reemplazar por" aria-label="Reemplazar por" className={`${campoCinta} w-36`} />
              <button type="button" onClick={reemplazarUno} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]">Reemplazar</button>
              <button type="button" onClick={reemplazarTodo} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]">Reemplazar todo</button>
              {buscar.msg && <span role="status" className="text-xs text-[var(--fg-muted)]">{buscar.msg}</span>}
              <Sep />
              <Boton titulo="Reducir el zoom" onClick={() => setZoom((z) => Math.max(80, z - 10))}><ZoomOut size={15} /></Boton>
              <span className="w-10 text-center text-xs tabular-nums text-[var(--fg-muted)]">{zoom}%</span>
              <Boton titulo="Aumentar el zoom" onClick={() => setZoom((z) => Math.min(160, z + 10))}><ZoomIn size={15} /></Boton>
            </>
          )}
        </div>
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
        style={zoom === 100 ? undefined : { zoom: zoom / 100 }}
        onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
        onInput={emitir}
        onKeyUp={leerEstado}
        onMouseUp={leerEstado}
        onPaste={(e) => {
          // Se pega solo lo esencial (párrafos, negrita, tablas, enlaces…): nada de estilos ni colores de otra página o de Word.
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          const texto = e.clipboardData.getData("text/plain");
          // Código de incrustación (X, Instagram, TikTok, Facebook, <iframe>) o el enlace suelto de un video o publicación: se pega ya incrustado, no como texto.
          const emb = embedDeCodigo(texto) ?? embedDeCodigo(html) ?? (/^\s*https?:\/\/\S+\s*$/.test(texto) ? parseEmbed(texto) : null);
          if (emb) {
            const fig = embedHtml(emb, NOMBRE_EMBED[emb.tipo], { pie: "Pie · Fuente" }).replace('<figure class="', '<figure contenteditable="false" class="');
            document.execCommand("insertHTML", false, `${fig}<p><br></p>`);
            emitir();
            return;
          }
          const limpio = html
            ? limpiarPegado(html)
            : texto.split(/\n\s*\n/).map((t) => `<p>${escapeHtml(t.trim()).replace(/\n/g, "<br>")}</p>`).join("");
          document.execCommand("insertHTML", false, limpio);
          emitir();
        }}
        onClick={alHacerClic}
        className={`${papel ? "min-h-[20rem] px-1 py-2" : "min-h-0 flex-1 overflow-y-auto px-5 py-4"} text-base leading-relaxed outline-none empty:before:text-[var(--fg-muted)]/60 empty:before:content-[attr(data-placeholder)]
          [&_p]:my-2.5 [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:font-semibold
          [&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-6
          [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--accent)] [&_blockquote]:bg-[var(--surface-2)]/50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic
          [&_a]:text-[var(--accent)] [&_a]:underline [&_strong]:font-bold [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_u]:underline [&_s]:line-through [&_sub]:align-sub [&_sub]:text-xs [&_sup]:align-super [&_sup]:text-xs
          [&_hr]:my-5 [&_hr]:border-[var(--border)] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-[var(--surface-2)] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm
          [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:min-w-12 [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-[var(--border)] [&_th]:bg-[var(--surface-2)] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold
          [&_figure]:my-4 [&_figure_img]:mx-auto [&_figure_img]:max-h-72 [&_figcaption]:mt-1 [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:text-[var(--fg-muted)]
          [&_details]:my-3 [&_details]:rounded-md [&_details]:border [&_details]:border-[var(--border)] [&_details]:px-3 [&_details]:py-2 [&_summary]:cursor-pointer [&_summary]:text-sm [&_summary]:font-semibold
          [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:pointer-events-none [&_figure.lx-embed]:mx-auto [&_figure.lx-embed]:cursor-pointer [&_figure.lx-embed-social_iframe]:aspect-auto [&_figure.cg-embed-sel]:outline [&_figure.cg-embed-sel]:outline-2 [&_figure.cg-embed-sel]:outline-offset-4 [&_figure.cg-embed-sel]:outline-[var(--accent)]`}
      />
    </div>
  );
}
