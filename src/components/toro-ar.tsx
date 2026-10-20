"use client";

import { createElement, useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

/**
 * «Toro» (la mascota del sitio) en 3D y en realidad aumentada. Usa el componente web `model-viewer`, que se carga solo en esta página:
 * en Android (Chrome con ARCore) abre la cámara con el modo WebXR o Scene Viewer, y en iPhone (Safari) usa Quick Look. En una pantalla
 * sin realidad aumentada (un computador) la cabeza se puede girar y acercar con el dedo o el ratón. El modelo (`public/modelos/toro.glb`) lo
 * genera `scripts/generar-toro-3d.mjs`.
 */
export function ToroAr() {
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  useEffect(() => {
    let vivo = true;
    import("@google/model-viewer").then(() => vivo && setEstado("listo")).catch(() => vivo && setEstado("error"));
    return () => { vivo = false; };
  }, []);

  if (estado === "error") return <p role="alert" className="text-center text-sm text-[var(--fg-muted)]">No se pudo cargar el visor 3D en este navegador. Prueba con Chrome (Android) o Safari (iPhone).</p>;
  if (estado === "cargando") return <div className="grid h-[60vh] place-items-center text-sm text-[var(--fg-muted)]" role="status">Cargando a Toro en 3D…</div>;
  return createElement(
    "model-viewer",
    {
      src: "/modelos/toro.glb",
      alt: "Toro, la mascota de CONtexto Ganadero, en 3D",
      ar: true,
      "ar-modes": "webxr scene-viewer quick-look",
      "ar-scale": "auto",
      "camera-controls": true,
      "auto-rotate": true,
      "shadow-intensity": "1.1",
      "camera-orbit": "25deg 78deg auto",
      "field-of-view": "30deg",
      exposure: "0.8",
      style: { width: "100%", height: "min(60vh, 460px)", background: "transparent", "--poster-color": "transparent" },
    },
    createElement(
      "button",
      {
        slot: "ar-button",
        type: "button",
        className: "absolute bottom-4 left-1/2 inline-flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-fg,#101611)] shadow-lg",
      },
      createElement(Smartphone, { size: 18, "aria-hidden": true }),
      " Ver en mi espacio (AR)",
    ),
  );
}
