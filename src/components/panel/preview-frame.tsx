"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Lienzo del editor dentro de un <iframe> del ancho del dispositivo elegido.
 *
 * Sin iframe, las media queries (sm:, md:, lg:…) se evalúan contra la ventana
 * del editor, que es de escritorio: a 390 px el lienzo pintaba el diseño de
 * escritorio apretado y desbordado. Dentro del iframe el diseño «ve» 390 u
 * 834 px de pantalla y se adapta exactamente como en un móvil o una tablet.
 *
 * El contenido se monta con un portal de React (mismo árbol: estado, clics y
 * arrastrar siguen funcionando) y se copian los estilos de la página.
 */
export function PreviewFrame({
  width,
  scale,
  children,
}: {
  width: number;
  scale: number;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(600);

  // Alto disponible del contenedor (el iframe se escala; su alto real es mayor).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const set = () => setHeight(el.clientHeight);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    // Documento vacío con los mismos estilos, fuentes y modo de la página.
    doc.open();
    doc.write("<!doctype html><html><head></head><body></body></html>");
    doc.close();

    const syncStyles = () => {
      doc.head.querySelectorAll("[data-copied]").forEach((n) => n.remove());
      document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => {
        const c = n.cloneNode(true) as HTMLElement;
        c.setAttribute("data-copied", "");
        doc.head.appendChild(c);
      });
      doc.documentElement.className = document.documentElement.className;
      const dark = document.documentElement.dataset.dark;
      if (dark) doc.documentElement.dataset.dark = dark;
      else delete doc.documentElement.dataset.dark;
      doc.body.className = document.body.className;
      doc.body.style.margin = "0";
    };
    syncStyles();

    // En desarrollo los estilos cambian al editar código: se re-sincronizan.
    const mo = new MutationObserver(syncStyles);
    mo.observe(document.head, { childList: true, subtree: true });

    const root = doc.createElement("div");
    doc.body.appendChild(root);
    setMount(root);
    return () => {
      mo.disconnect();
      setMount(null);
    };
  }, []);

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden">
      <iframe
        ref={frame}
        title="Vista previa de la portada"
        className="absolute left-1/2 top-0 origin-top border-0 bg-[var(--paper)]"
        style={{
          width,
          height: height / scale,
          transform: `translateX(-50%) scale(${scale})`,
        }}
      />
      {mount && createPortal(children, mount)}
    </div>
  );
}
