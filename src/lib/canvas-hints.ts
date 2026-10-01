/**
 * Pistas al pasar el ratón sobre la portada del lienzo (y de la vista previa):
 * cursor de mano, contorno y una etiqueta que dice QUÉ se edita al pulsar
 * («Cabecera · clic para editar», «Nota 2 · …»). Sin esto el lienzo no dice
 * qué se puede tocar.
 *
 * Trabaja sobre el DOM ya pintado, igual que `block-tools`. Tamaños en función
 * de `--cg-inv` (1 / escala del lienzo) para que la etiqueta mida lo mismo en
 * pantalla aunque la portada se vea reducida.
 */
export type HintLabels = {
  /** Nombre de una parte de la plantilla (`data-region`). */
  region: (id: string) => string | null;
  /** Nombre de una pieza del encabezado de sección (`data-el`). */
  piece: (id: string) => string | null;
  /** Texto para la tarjeta de la portada con este índice. */
  card: (index: number) => string;
  /** Texto para una nota de una página de sección (por slug). */
  note: (slug: string) => string | null;
};

const STYLE_ID = "cg-hints-style";
const LABEL_ID = "cg-hint";

type Target = { el: HTMLElement; text: string };

export function installCanvasHints(doc: Document, labels: HintLabels): () => void {
  if (!doc.getElementById(STYLE_ID)) {
    const st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      "[data-region],[data-card-index],[data-el],[data-bs-root]{cursor:pointer}" +
      "[data-cg-hover]{outline:calc(2px*var(--cg-inv,1)) dashed #c9a227!important;outline-offset:calc(-2px*var(--cg-inv,1))}" +
      `#${LABEL_ID}{position:fixed;z-index:2147483000;pointer-events:none;display:none;background:#33401a;color:#fff;` +
      "font:600 calc(13px*var(--cg-inv,1))/1.25 ui-sans-serif,system-ui,sans-serif;letter-spacing:0;text-transform:none;" +
      "padding:calc(4px*var(--cg-inv,1)) calc(9px*var(--cg-inv,1));border-radius:calc(7px*var(--cg-inv,1));" +
      "box-shadow:0 calc(2px*var(--cg-inv,1)) calc(8px*var(--cg-inv,1)) rgba(0,0,0,.4);white-space:nowrap;max-width:70%;overflow:hidden;text-overflow:ellipsis}" +
      `#${LABEL_ID}[data-on]{display:block}`;
    doc.head.appendChild(st);
  }
  let label = doc.getElementById(LABEL_ID) as HTMLElement | null;
  if (!label) {
    label = doc.createElement("div");
    label.id = LABEL_ID;
    label.setAttribute("aria-hidden", "true");
    doc.body.appendChild(label);
  }
  const tag = label;

  let current: HTMLElement | null = null;
  const clear = () => {
    current?.removeAttribute("data-cg-hover");
    current = null;
    tag.removeAttribute("data-on");
  };

  function find(from: Element | null): Target | null {
    if (!from) return null;
    const card = from.closest<HTMLElement>("[data-card-index]");
    if (card) return { el: card, text: labels.card(Number(card.getAttribute("data-card-index"))) };
    const root = from.closest<HTMLElement>("[data-bs-root]");
    if (root) {
      const t = labels.note(root.getAttribute("data-bs-root") ?? "");
      if (t) return { el: root, text: t };
    }
    const piece = from.closest<HTMLElement>("[data-el]");
    if (piece) {
      const t = labels.piece(piece.getAttribute("data-el") ?? "");
      if (t) return { el: piece, text: t };
    }
    const region = from.closest<HTMLElement>("[data-region]");
    if (region) {
      const t = labels.region(region.getAttribute("data-region") ?? "");
      if (t) return { el: region, text: t };
    }
    return null;
  }

  function show(t: Target) {
    if (current !== t.el) {
      current?.removeAttribute("data-cg-hover");
      t.el.setAttribute("data-cg-hover", "");
      current = t.el;
    }
    tag.textContent = `${t.text} · clic para editar`;
    tag.setAttribute("data-on", "");
    const r = t.el.getBoundingClientRect();
    const h = tag.getBoundingClientRect().height || 24;
    const vw = doc.documentElement.clientWidth;
    const left = Math.max(4, Math.min(r.left + 4, vw - tag.getBoundingClientRect().width - 4));
    // Encima del elemento si cabe; si no, dentro, pegada arriba.
    const top = r.top - h - 4 >= 2 ? r.top - h - 4 : Math.max(2, r.top + 4);
    tag.style.left = `${left}px`;
    tag.style.top = `${top}px`;
  }

  const over = (e: MouseEvent) => {
    const t = find(e.target as Element | null);
    if (!t) return clear();
    show(t);
  };
  const out = (e: MouseEvent) => {
    if (!e.relatedTarget) clear();
  };

  doc.addEventListener("mouseover", over, true);
  doc.addEventListener("mouseout", out, true);
  doc.addEventListener("scroll", clear, true);
  return () => {
    doc.removeEventListener("mouseover", over, true);
    doc.removeEventListener("mouseout", out, true);
    doc.removeEventListener("scroll", clear, true);
    clear();
    tag.remove();
  };
}
