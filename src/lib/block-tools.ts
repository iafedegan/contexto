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

const STYLE_ID = "cg-block-tools-style";

/** Quita lo que añadió una pasada anterior (para repetirla tras refrescar). */
export function cleanupBlocks(root: ParentNode) {
  root.querySelectorAll(".cg-handle").forEach((n) => n.remove());
  root.querySelectorAll("[data-cg-block]").forEach((n) => n.removeAttribute("data-cg-block"));
}

export function enhanceBlocks(doc: Document, root: ParentNode, opts: BlockToolsOptions) {
  cleanupBlocks(root);
  if (!doc.getElementById(STYLE_ID)) {
    const st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      ".cg-handle{position:absolute;right:-7px;bottom:-7px;width:16px;height:16px;border-radius:5px;background:#84a21f;border:2px solid #fff;cursor:nwse-resize;z-index:60;box-shadow:0 1px 4px rgba(0,0,0,.45)}" +
      "[data-cg-block]{position:relative}[data-cg-block]:hover{outline:1px dashed #84a21f;outline-offset:2px}" +
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
  kind: "block" | "other";
  index?: number;
  slug?: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ZoneMapData = {
  /** Identificador de la zona (`i<N>` en la portada, `s-<slug>` en secciones). */
  key: string | null;
  w: number;
  h: number;
  /** Columnas reales del contenedor ahora mismo. */
  cols: number;
  display: string;
  items: ZoneMapItem[];
};

/** Mide el contenedor que agrupa al bloque `el` y a sus hermanos, tal como se ve ahora. */
export function measureZone(el: HTMLElement): ZoneMapData | null {
  const container = el.parentElement;
  if (!container) return null;
  const view = el.ownerDocument.defaultView;
  const cs = view?.getComputedStyle(container);
  const cr = container.getBoundingClientRect();
  if (cr.width < 10) return null;
  const items: ZoneMapItem[] = [];
  let firstIndex: number | null = null;
  let firstSlug: string | null = null;
  Array.from(container.children).forEach((c, n) => {
    const child = c as HTMLElement;
    if (child.classList.contains("cg-handle")) return;
    const r = child.getBoundingClientRect();
    const idxAttr = child.getAttribute("data-card-index");
    const slug = child.getAttribute("data-bslug") ?? child.getAttribute("data-bs-root") ?? undefined;
    const isBlock = idxAttr !== null || !!slug;
    if (isBlock) {
      if (idxAttr !== null) firstIndex = firstIndex === null ? Number(idxAttr) : Math.min(firstIndex, Number(idxAttr));
      if (!firstSlug && slug) firstSlug = slug;
    }
    items.push({
      id: `${n}`,
      kind: isBlock ? "block" : "other",
      index: idxAttr !== null ? Number(idxAttr) : undefined,
      slug,
      label: (child.querySelector("h1,h2,h3,.entry-title")?.textContent ?? child.textContent ?? "").trim().slice(0, 40),
      x: r.left - cr.left,
      y: r.top - cr.top,
      w: r.width,
      h: r.height,
    });
  });
  return {
    key: firstIndex !== null ? `i${firstIndex}` : firstSlug ? `s-${firstSlug}` : null,
    w: cr.width,
    h: Math.max(cr.height, 40),
    cols: cs?.display.includes("grid") ? cs.gridTemplateColumns.split(" ").length : 1,
    display: cs?.display ?? "block",
    items,
  };
}
