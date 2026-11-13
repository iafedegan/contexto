"use client";

import { useEffect } from "react";

/**
 * Ajusta el alto de las publicaciones incrustadas de X e Instagram a su contenido, para que no se corten. Esas páginas de incrustación avisan a la
 * ventana que las contiene cuánto miden (mensajes `postMessage`); aquí se escuchan SOLO los de sus dominios y se aplica ese alto al iframe que
 * los envió. No se carga ningún script de terceros en la nota.
 */
export function EmbedAltura() {
  useEffect(() => {
    const alAviso = (e: MessageEvent) => {
      let alto = 0;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (e.origin === "https://platform.twitter.com" || e.origin === "https://platform.x.com") {
          const r = d?.["twttr.embed"];
          if (r?.method === "twttr.private.resize") alto = Number(r.params?.[0]?.height);
        } else if (e.origin === "https://www.instagram.com") {
          if (d?.type === "MEASURE") alto = Number(d.details?.height);
        }
      } catch {
        return;
      }
      if (!Number.isFinite(alto) || alto < 80) return;
      for (const f of Array.from(document.querySelectorAll("iframe"))) {
        if (f.contentWindow === e.source) f.style.height = `${Math.ceil(alto) + 2}px`;
      }
    };
    window.addEventListener("message", alAviso);
    return () => window.removeEventListener("message", alAviso);
  }, []);
  return null;
}
