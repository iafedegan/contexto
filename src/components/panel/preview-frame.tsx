"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Lienzo del editor dentro de un <iframe> con la pantalla del dispositivo
 * elegido, dibujado dentro de un marco de iPhone, iPad o Mac.
 *
 * Sin iframe, las media queries (sm:, md:, lg:…) se evalúan contra la ventana
 * del editor, que es de escritorio: a 390 px se veía el diseño de escritorio
 * apretado. Dentro del iframe el diseño «ve» la pantalla real del dispositivo.
 *
 * El contenido se monta con un portal de React (mismo árbol: estado, clics y
 * arrastrar siguen funcionando) y se copian los estilos de la página.
 */

export type Device = "mac" | "ipad" | "iphone";

/** Pantallas en puntos CSS reales: iPhone 15, iPad Air (vertical), MacBook. */
export const DEVICES: Record<Device, { label: string; w: number; h: number }> = {
  iphone: { label: "iPhone", w: 390, h: 844 },
  ipad: { label: "iPad", w: 820, h: 1180 },
  mac: { label: "Mac", w: 1440, h: 900 },
};

/** Marco (bisel) de cada dispositivo, en px de pantalla ya escalada. */
const BEZEL: Record<Device, { pad: number; radius: number; screenRadius: number; base: number }> = {
  iphone: { pad: 12, radius: 52, screenRadius: 42, base: 0 },
  ipad: { pad: 18, radius: 34, screenRadius: 18, base: 0 },
  mac: { pad: 14, radius: 16, screenRadius: 4, base: 22 },
};

export type Zoom = "ajustar" | 0.75 | 1;

export function PreviewFrame({
  device,
  children,
  src,
  onFrameLoad,
  framed = false,
  zoom = "ajustar",
}: {
  device: Device;
  /** Contenido propio (modo edición). Se ignora si hay `src`. */
  children?: React.ReactNode;
  /** Dirección real a cargar en el marco (portada tal cual la ve el público). */
  src?: string;
  /** Se llama cada vez que carga el documento del marco (solo con `src`). */
  onFrameLoad?: (doc: Document) => void;
  /** Con marco de iPhone/iPad/Mac (decorativo, ocupa espacio) o solo la página, a todo el ancho. */
  framed?: boolean;
  /** «ajustar» llena el ancho disponible; 0.75 y 1 fijan la escala (con desplazamiento si no cabe). */
  zoom?: Zoom;
}) {
  const area = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [avail, setAvail] = useState({ w: 800, h: 600 });

  const { w, h, label } = DEVICES[device];
  const b = framed ? BEZEL[device] : { pad: 0, radius: 10, screenRadius: 8, base: 0 };

  // Espacio disponible: el dispositivo entero (pantalla + marco) debe caber.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const set = () => setAvail({ w: el.clientWidth, h: el.clientHeight });
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Con marco: todo el dispositivo debe caber (ancho y alto). Sin marco: se ajusta solo al ancho
  // y la página se desplaza dentro (como en el navegador), así el texto queda lo más grande posible.
  const fit = framed
    ? Math.min(1, (avail.w - 2 * b.pad - 24) / w, (avail.h - 2 * b.pad - b.base - 40) / h)
    : Math.min(1, (avail.w - 4) / w);
  const scale = Math.max(0.1, zoom === "ajustar" ? fit : zoom);

  useEffect(() => {
    // Con `src` el marco carga una página real: no hay nada que montar aquí.
    if (src !== undefined) return;
    const iframe = frame.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

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
    // El contenido se monta una sola vez; `src` no cambia entre modos (el editor remonta el marco).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si cambia la escala (ventana, dispositivo) sin recargar, las pistas del lienzo se ajustan.
  useEffect(() => {
    const d = frame.current?.contentDocument;
    if (d?.documentElement) d.documentElement.style.setProperty("--cg-inv", String(+(1 / scale).toFixed(3)));
  }, [scale]);

  const sw = w * scale;
  // Sin marco la pantalla llena el alto disponible (la página se desplaza dentro); con marco, la del dispositivo.
  const sh = framed ? h * scale : Math.max(240, avail.h - 36);
  const docH = framed ? h : sh / scale;

  const rotulo = `${label} · ${w}px · ${Math.round(scale * 100)} %${zoom === "ajustar" ? " (ajustado al ancho)" : ""}`;

  const pantalla = (
    <div
      className={`relative shrink-0 overflow-hidden bg-[var(--paper)] ${framed ? "" : "border border-[var(--border-strong)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)]"}`}
      style={{ width: sw, height: sh, borderRadius: b.screenRadius }}
    >
      <iframe
        ref={frame}
        src={src}
        onLoad={(e) => {
          const doc = e.currentTarget.contentDocument;
          if (src !== undefined && doc) {
            doc.documentElement.style.setProperty("--cg-inv", String(+(1 / scale).toFixed(3)));
            onFrameLoad?.(doc);
          }
        }}
        title={`Vista previa de la portada en ${label}`}
        // Fuera del orden de Tab: con el teclado se llega al menú lateral sin recorrer toda la página de dentro.
        tabIndex={-1}
        className="absolute left-0 top-0 origin-top-left border-0"
        style={{ width: w, height: docH, transform: `scale(${scale})` }}
      />
    </div>
  );

  if (!framed) {
    return (
      <div ref={area} className="flex h-full w-full flex-col items-center gap-2 overflow-auto">
        {pantalla}
        <p className="shrink-0 text-xs text-[var(--fg-muted)]">{rotulo}</p>
        {src === undefined && mount && createPortal(children, mount)}
      </div>
    );
  }

  return (
    <div ref={area} className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden">
      <div className="flex flex-col items-center">
        {/* Cuerpo del dispositivo */}
        <div
          className="relative shadow-[0_30px_60px_-25px_rgba(0,0,0,0.55)]"
          style={{
            padding: b.pad,
            borderRadius: b.radius,
            background: device === "mac" ? "linear-gradient(#2b2b2e,#1c1c1e)" : "linear-gradient(145deg,#3a3a3c,#1c1c1e)",
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.08)",
          }}
        >
          {/* Cámara: isla dinámica (iPhone), punto (iPad) o muesca (Mac). */}
          {device === "iphone" && (
            <span className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black" style={{ top: b.pad + 10 * scale, width: 110 * scale, height: 30 * scale }} />
          )}
          {device === "ipad" && (
            <span className="absolute left-1/2 top-[7px] size-1.5 -translate-x-1/2 rounded-full bg-[#0b0b0c] ring-1 ring-white/10" />
          )}
          {device === "mac" && (
            <span className="absolute left-1/2 top-[5px] size-1 -translate-x-1/2 rounded-full bg-[#3a3a3c]" />
          )}
          {pantalla}
          {/* Botones laterales del iPhone */}
          {device === "iphone" && (
            <>
              <span className="absolute -left-[3px] top-[22%] h-8 w-[3px] rounded-l bg-[#2c2c2e]" />
              <span className="absolute -left-[3px] top-[31%] h-12 w-[3px] rounded-l bg-[#2c2c2e]" />
              <span className="absolute -right-[3px] top-[28%] h-16 w-[3px] rounded-r bg-[#2c2c2e]" />
            </>
          )}
        </div>
        {/* Base del MacBook */}
        {device === "mac" && (
          <div className="relative" style={{ width: sw + 2 * b.pad + 60, height: b.base }}>
            <div className="absolute inset-x-0 top-0 h-[14px] rounded-b-[14px] bg-gradient-to-b from-[#d6d6d8] to-[#a8a8ab]" />
            <div className="absolute left-1/2 top-0 h-[6px] w-24 -translate-x-1/2 rounded-b-md bg-[#8e8e91]" />
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--fg-muted)]">{rotulo}</p>
      {src === undefined && mount && createPortal(children, mount)}
    </div>
  );
}
