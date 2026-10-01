/**
 * Herramientas de edición directa de los bloques (notas) de una página real:
 * un asa en la esquina inferior derecha para agrandar y, en la portada,
 * arrastrar el bloque entero para cambiarlo de sitio. Trabajan sobre el DOM
 * ya pintado (el lienzo del editor o la vista previa en pestaña nueva), sin
 * tocar los componentes de cada plantilla.
 */
export type BlockToolsOptions = {
  /** Se llama al soltar el asa: alto mínimo y, en cuadrículas, columnas ocupadas. */
  onResize: (slug: string, patch: { height: number; colSpan?: number }) => void;
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
      let h = r0.height;
      const sx = ev.clientX, sy = ev.clientY;
      const scale = r0.width / (el.offsetWidth || r0.width) || 1;
      const move = (e: PointerEvent) => {
        h = Math.max(60, r0.height + (e.clientY - sy) / scale);
        el.style.minHeight = `${Math.round(h)}px`;
        if (isGrid) {
          const w = r0.width + (e.clientX - sx) / scale;
          span = Math.min(cols, Math.max(1, Math.round((w + gap) / (colW + gap))));
          el.style.gridColumn = `span ${span} / span ${span}`;
        }
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        opts.onResize(slug, { height: Math.round(h), ...(span ? { colSpan: span } : {}) });
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
