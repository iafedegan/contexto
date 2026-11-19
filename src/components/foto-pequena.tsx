"use client";

import { useEffect } from "react";

/**
 * Fotos que el sitio anterior guardó como miniatura (p. ej. el retrato de una columna, 298×380 px) y que las tarjetas anchas
 * estiran con `object-cover` hasta verse pixeladas. Cuando una foto de esas se muestra mucho más grande que sus píxeles reales
 * se le pone `data-foto-pequena` (CSS: se ve entera, sin estirarla) y su caja recibe un fondo con la misma foto desenfocada.
 * Las fotos normales y los avatares chicos nunca cumplen la condición, así que no cambian.
 *
 * El ancho real se mide cargando la misma URL en un `Image` suelto (sale de la caché, no hay descarga nueva): `naturalWidth`
 * del `<img>` con `srcset` ya viene dividido por la densidad y no sirve para esto. El optimizador de Next no amplía, así que
 * una foto de origen pequeña llega con sus píxeles originales aunque la tarjeta pida más.
 */
const ANCHO_MAX_FOTO = 400;
/** Debajo de este ancho (px de CSS) es un avatar o una miniatura a propósito, no una tarjeta. */
const ANCHO_MIN_CAJA = 300;
/** Estirada: sus píxeles reales cubren menos de esta fracción de los píxeles de pantalla que ocupa. */
const COBERTURA_MAX = 0.75;

const anchos = new Map<string, Promise<number>>();

function anchoReal(src: string): Promise<number> {
  let p = anchos.get(src);
  if (!p) {
    p = new Promise<number>((resolver) => {
      const t = new Image();
      t.onload = () => resolver(t.naturalWidth);
      t.onerror = () => resolver(0);
      t.src = src;
    });
    anchos.set(src, p);
  }
  return p;
}

async function revisar(img: HTMLImageElement) {
  const caja = img.parentElement;
  const src = img.currentSrc;
  if (!caja || !src || !img.complete || !img.naturalWidth) return;
  const ancho = img.clientWidth;
  if (ancho < ANCHO_MIN_CAJA) return;
  if (!img.hasAttribute("data-foto-pequena") && getComputedStyle(img).objectFit !== "cover") return;
  const real = await anchoReal(src);
  if (img.currentSrc !== src) return; // cambió de foto mientras se medía
  const pequena = real > 0 && real <= ANCHO_MAX_FOTO && real < img.clientWidth * (window.devicePixelRatio || 1) * COBERTURA_MAX;
  if (pequena) {
    img.setAttribute("data-foto-pequena", "");
    caja.setAttribute("data-foto-pequena-caja", "");
    caja.style.setProperty("--cg-fondo", `url(${JSON.stringify(src)})`);
  } else if (img.hasAttribute("data-foto-pequena")) {
    img.removeAttribute("data-foto-pequena");
    caja.removeAttribute("data-foto-pequena-caja");
    caja.style.removeProperty("--cg-fondo");
  }
}

function revisarTodas() {
  for (const img of Array.from(document.images)) void revisar(img);
}

export function FotoPequena() {
  useEffect(() => {
    const alCargar = (e: Event) => {
      if (e.target instanceof HTMLImageElement) void revisar(e.target);
    };
    let cuadro = 0;
    const alCambiarTamano = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(revisarTodas);
    };
    // `load` no burbujea: se escucha en la fase de captura para ver también las fotos que Next carga después.
    document.addEventListener("load", alCargar, true);
    window.addEventListener("resize", alCambiarTamano);
    revisarTodas();
    return () => {
      document.removeEventListener("load", alCargar, true);
      window.removeEventListener("resize", alCambiarTamano);
      cancelAnimationFrame(cuadro);
    };
  }, []);
  return null;
}
