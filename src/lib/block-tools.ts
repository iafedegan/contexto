/**
 * Herramientas de edición directa de los bloques (notas) de una página real:
 * un asa en la esquina inferior derecha para agrandar y, en la portada,
 * arrastrar el bloque entero para cambiarlo de sitio. Trabajan sobre el DOM
 * ya pintado (el lienzo del editor o la vista previa en pestaña nueva), sin
 * tocar los componentes de cada plantilla.
 */
export type BlockToolsOptions = {
  /** Se llama al soltar el asa: alto mínimo y, en cuadrículas, columnas ocupadas. */
  onResize: (slug: string, patch: { height?: number; colSpan?: number; widthPct?: number }) => void;
  /** Se llama al soltar un bloque de la portada sobre otro (índices de posición). */
  onMove: (from: number, to: number) => void;
  /** Para saber si el documento sigue siendo el actual (el lienzo se recarga). */
  isCurrent?: () => boolean;
};

// Id de la hoja de estilos de las herramientas de bloque.
const STYLE_ID = "cg-block-tools-style";

/** Quita lo que añadió una pasada anterior (para repetirla tras refrescar). */
export function cleanupBlocks(root: ParentNode) {
  root.querySelectorAll(".cg-handle").forEach((n) => n.remove());
  root.querySelectorAll("[data-cg-block]").forEach((n) => n.removeAttribute("data-cg-block"));
}

// Añade a cada bloque del lienzo los controles de edición, entre ellos el asa para cambiar su alto arrastrando.
export function enhanceBlocks(doc: Document, root: ParentNode, opts: BlockToolsOptions) {
  cleanupBlocks(root);
  if (!doc.getElementById(STYLE_ID)) {
    const st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      // Medidas en función de --cg-inv (1 / escala del lienzo): el asa mide lo mismo en pantalla aunque la portada se vea reducida.
      ".cg-handle{position:absolute;right:calc(-8px*var(--cg-inv,1));bottom:calc(-8px*var(--cg-inv,1));width:calc(18px*var(--cg-inv,1));height:calc(18px*var(--cg-inv,1));border-radius:calc(5px*var(--cg-inv,1));background:#84a21f;border:calc(2px*var(--cg-inv,1)) solid #fff;cursor:nwse-resize;z-index:60;box-shadow:0 1px 4px rgba(0,0,0,.45)}" +
      "[data-cg-block]{position:relative}[data-cg-block]:hover{outline:calc(1px*var(--cg-inv,1)) dashed #84a21f;outline-offset:calc(2px*var(--cg-inv,1))}" +
      ".cg-over{outline:3px dashed #c9a227!important;outline-offset:3px}";
    doc.head.appendChild(st);
  }

  // Un bloque por nota: el envoltorio de la portada o, si no lo hay, la propia tarjeta.
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-bslug],[data-bs-root]")).filter(
    (el) => el.hasAttribute("data-bslug") || !el.closest("[data-bslug]"),
  );
  for (const el of blocks) {
    const slug = el.getAttribute("data-bslug") ?? el.getAttribute("data-bs-root");
    if (!slug) continue;
    el.setAttribute("data-cg-block", "");
    const handle = doc.createElement("span");
    handle.className = "cg-handle";
    handle.title = "Arrastra para agrandar el bloque";
    el.appendChild(handle);
    handle.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      handle.setPointerCapture(ev.pointerId);
      const r0 = el.getBoundingClientRect();
      const parent = el.parentElement;
      const cs = parent ? doc.defaultView!.getComputedStyle(parent) : null;
      const isGrid = !!cs && cs.display.includes("grid");
      const cols = isGrid ? cs!.gridTemplateColumns.split(" ").length : 1;
      const gap = isGrid ? parseFloat(cs!.columnGap) || 0 : 0;
      const colW = isGrid ? (parent!.clientWidth - gap * (cols - 1)) / cols : r0.width;
      let span: number | undefined;
      let widthPct: number | undefined;
      let h = r0.height;
      let moved = false;
      const sx = ev.clientX, sy = ev.clientY;
      const scale = r0.width / (el.offsetWidth || r0.width) || 1;
      // Mientras se arrastra: recalcula el alto mínimo del bloque.
      const move = (e: PointerEvent) => {
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) moved = true;
        h = Math.max(60, r0.height + (e.clientY - sy) / scale);
        el.style.minHeight = `${Math.round(h)}px`;
        const w = r0.width + (e.clientX - sx) / scale;
        if (isGrid) {
          span = Math.min(cols, Math.max(1, Math.round((w + gap) / (colW + gap))));
          el.style.gridColumn = `span ${span} / span ${span}`;
        } else if (parent) {
          // Lista de una columna: no hay columnas que ocupar, el ancho es un % del espacio.
          widthPct = Math.min(100, Math.max(20, Math.round((w / parent.clientWidth) * 100)));
          el.style.width = `${widthPct}%`;
        }
      };
      // Al soltar: deja de escuchar el arrastre y fija el alto solo si hubo movimiento.
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        // Un clic sin arrastrar no debe fijar medidas.
        if (!moved) return;
        opts.onResize(slug, { height: Math.round(h), ...(span ? { colSpan: span } : {}), ...(widthPct !== undefined ? { widthPct: widthPct >= 100 ? undefined : widthPct } : {}) });
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  // Arrastrar para reordenar (solo las tarjetas de la portada, que tienen posición).
  let from: number | null = null;
  for (const w of Array.from(root.querySelectorAll<HTMLElement>("[data-card-index]"))) {
    w.draggable = true;
    w.querySelectorAll("img,a").forEach((n) => ((n as HTMLElement).draggable = false));
    w.addEventListener("dragstart", (e) => {
      from = Number(w.getAttribute("data-card-index"));
      e.dataTransfer?.setData("text/plain", String(from));
    });
    w.addEventListener("dragover", (e) => {
      if (from === null) return;
      e.preventDefault();
      w.classList.add("cg-over");
    });
    w.addEventListener("dragleave", () => w.classList.remove("cg-over"));
    w.addEventListener("dragend", () => {
      from = null;
      root.querySelectorAll(".cg-over").forEach((n) => n.classList.remove("cg-over"));
    });
    w.addEventListener("drop", (e) => {
      e.preventDefault();
      w.classList.remove("cg-over");
      const to = Number(w.getAttribute("data-card-index"));
      if (from !== null && from !== to) opts.onMove(from, to);
      from = null;
    });
  }
}

// --- Mapa de la zona -------------------------------------------------------

export type ZoneMapItem = {
  id: string;
  /** block = una nota; group = un contenedor intermedio con notas dentro; other = texto suelto. */
  kind: "block" | "group" | "other";
  index?: number;
  slug?: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// Mapa de una zona del lienzo: sus medidas y los bloques que contiene, para el editor.
export type ZoneMapData = {
  /** Identificador de la zona (`i<N>u<n>` en la portada, `s-<slug>u<n>` en secciones). */
  key: string | null;
  w: number;
  h: number;
  /** Columnas reales del contenedor ahora mismo. */
  cols: number;
  display: string;
  /** Ancho (px) de cada columna y alto de cada fila, y sus separaciones. */
  colTracks: number[];
  rowTracks: number[];
  colGap: number;
  rowGap: number;
  /** Cuántos niveles se puede subir desde este contenedor. */
  canGoUp: boolean;
  items: ZoneMapItem[];
};

// Selector de los bloques editables.
const BLOCK_SEL = "[data-bslug],[data-bs-root]";
// Indica si un elemento es un bloque exterior, no anidado dentro de otro.
const isOuterBlock = (el: Element) => el.hasAttribute("data-bslug") || !el.closest("[data-bslug]");

/**
 * Mide la zona del bloque `el`: su contenedor (o el de más arriba, con `up`) y
 * todos los bloques que contiene, a cualquier profundidad, tal como se ven ahora.
 */
export function measureZone(el: HTMLElement, up = 0): ZoneMapData | null {
  let container = el.parentElement;
  for (let i = 0; i < up && container?.parentElement; i++) container = container.parentElement;
  if (!container) return null;
  const view = el.ownerDocument.defaultView;
  const cs = view?.getComputedStyle(container);
  const cr = container.getBoundingClientRect();
  if (cr.width < 10) return null;
  // Posición y tamaño de un rectángulo relativos a su contenedor.
  const rel = (r: DOMRect) => ({ x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height });
  // Título breve de un bloque, tomado de su encabezado o de su texto.
  const title = (n: Element) => (n.querySelector("h1,h2,h3,.entry-title")?.textContent ?? n.textContent ?? "").trim().slice(0, 40);

  const blocks = Array.from(container.querySelectorAll<HTMLElement>(BLOCK_SEL)).filter(isOuterBlock);
  const items: ZoneMapItem[] = [];
  blocks.forEach((b, n) => {
    const idxAttr = b.getAttribute("data-card-index");
    items.push({
      id: `b${n}`,
      kind: "block",
      index: idxAttr !== null ? Number(idxAttr) : undefined,
      slug: b.getAttribute("data-bslug") ?? b.getAttribute("data-bs-root") ?? undefined,
      label: title(b),
      ...rel(b.getBoundingClientRect()),
    });
  });
  // Hijos directos que no son bloques: grupos (contienen bloques) o texto suelto.
  Array.from(container.children).forEach((c, n) => {
    const child = c as HTMLElement;
    if (child.classList.contains("cg-handle") || child.matches(BLOCK_SEL) || child.hasAttribute("data-card-index")) return;
    const r = child.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) return; // display:contents: no ocupa caja propia
    items.push({ id: `g${n}`, kind: child.querySelector(BLOCK_SEL) ? "group" : "other", label: "", ...rel(r) });
  });

  // Identidad de la zona: primer bloque en orden del documento y su profundidad bajo el contenedor.
  let key: string | null = null;
  const first = blocks[0];
  if (first) {
    let depth = 0;
    let n: Element | null = first.parentElement;
    while (n && n !== container) {
      depth++;
      n = n.parentElement;
    }
    const idxAttr = first.getAttribute("data-card-index");
    const slug = first.getAttribute("data-bslug") ?? first.getAttribute("data-bs-root");
    const base = idxAttr !== null ? `i${idxAttr}` : slug ? `s-${slug}` : null;
    if (base && depth <= 3) key = `${base}u${depth}`;
  }

  const grid = !!cs?.display.includes("grid");
  return {
    key,
    w: cr.width,
    h: Math.max(cr.height, 40),
    cols: grid ? cs!.gridTemplateColumns.split(" ").length : 1,
    display: cs?.display ?? "block",
    colTracks: grid ? cs!.gridTemplateColumns.split(" ").map(parseFloat).filter((v) => Number.isFinite(v)) : [],
    rowTracks: grid ? cs!.gridTemplateRows.split(" ").map(parseFloat).filter((v) => Number.isFinite(v)) : [],
    colGap: parseFloat(cs?.columnGap ?? "0") || 0,
    rowGap: parseFloat(cs?.rowGap ?? "0") || 0,
    canGoUp: !!container.parentElement && !container.matches("main,[data-region=\"body\"]"),
    items,
  };
}
