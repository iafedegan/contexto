/**
 * Posición del toro flotante y del cuadro del chat cuando la persona los mueve por la pantalla. Funciones puras: todo
 * en píxeles de la ventana, con (0, 0) arriba a la izquierda. Nada de esto se sale nunca de la pantalla.
 */
export type Posicion = { x: number; y: number };
export type Tamano = { w: number; h: number };

/** Distancia mínima al borde de la ventana. */
export const MARGEN = 8;

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** De qué lado del toro va el cuadro del chat (`sobre`: no cabe en ningún lado y queda encima de él). */
export type Lado = "arriba" | "abajo" | "derecha" | "izquierda" | "sobre";

/**
 * Deja el toro dentro de la ventana. Con el chat abierto (`chat`) además le reserva sitio al cuadro en el lado en que está
 * (`lado`), para que al arrastrar el toro el cuadro no se salga ni salte de un lado a otro.
 */
export function limitarPosicion(p: Posicion, ventana: Tamano, toro: Tamano, chat?: { cuadro: Tamano; lado: Lado }): Posicion {
  let minX = MARGEN;
  let maxX = ventana.w - toro.w - MARGEN;
  let minY = MARGEN;
  let maxY = ventana.h - toro.h - MARGEN;
  if (chat) {
    const { cuadro, lado } = chat;
    if (lado === "arriba") minY = Math.min(maxY, cuadro.h + 2 * MARGEN);
    else if (lado === "abajo") maxY = Math.max(minY, maxY - cuadro.h - MARGEN);
    else if (lado === "derecha") maxX = Math.max(minX, maxX - cuadro.w - MARGEN);
    else if (lado === "izquierda") minX = Math.min(maxX, cuadro.w + 2 * MARGEN);
  }
  return { x: acotar(p.x, minX, maxX), y: acotar(p.y, minY, maxY) };
}

/**
 * Dónde va el cuadro del chat respecto al toro: encima si cabe; si no, debajo; si no, a su derecha o a su izquierda; y si en
 * ningún lado cabe (ventana muy pequeña), sobre él. En los lados el borde derecho (arriba y abajo) o inferior (a los costados)
 * se alinea con el del toro, sin salirse nunca de la ventana.
 */
export function ubicarDialogo(toroEn: Posicion, ventana: Tamano, toro: Tamano, cuadro: Tamano): Posicion & { lado: Lado } {
  const xAlineada = acotar(toroEn.x + toro.w - cuadro.w, MARGEN, ventana.w - cuadro.w - MARGEN);
  if (toroEn.y - cuadro.h - MARGEN >= MARGEN) return { x: xAlineada, y: toroEn.y - cuadro.h - MARGEN, lado: "arriba" };
  if (toroEn.y + toro.h + MARGEN + cuadro.h <= ventana.h - MARGEN) return { x: xAlineada, y: toroEn.y + toro.h + MARGEN, lado: "abajo" };
  const yAlineada = acotar(toroEn.y + toro.h - cuadro.h, MARGEN, ventana.h - cuadro.h - MARGEN);
  if (toroEn.x + toro.w + MARGEN + cuadro.w <= ventana.w - MARGEN) return { x: toroEn.x + toro.w + MARGEN, y: yAlineada, lado: "derecha" };
  if (toroEn.x - cuadro.w - MARGEN >= MARGEN) return { x: toroEn.x - cuadro.w - MARGEN, y: yAlineada, lado: "izquierda" };
  return { x: xAlineada, y: yAlineada, lado: "sobre" };
}
