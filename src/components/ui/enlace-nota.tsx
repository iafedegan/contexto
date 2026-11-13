"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * Enlace a una nota o sección que NO se precarga al entrar en pantalla, sino cuando el lector muestra intención: pasa el puntero, pone el dedo o
 * lo enfoca con el teclado. Las notas son páginas estáticas y Next las precargaba ENTERAS a medida que sus tarjetas aparecían: la portada pedía
 * decenas de notas que casi nadie iba a abrir (datos del celular gastados por nada). Con la intención, la nota sigue llegando antes del clic.
 * Es el patrón «Hover-triggered prefetch» de la guía de Next (`prefetch={activo ? null : false}`).
 */
export function EnlaceNota(props: ComponentProps<typeof Link>) {
  const [activo, setActivo] = useState(false);
  const activar = () => setActivo(true);
  return <Link {...props} prefetch={activo ? null : false} onMouseEnter={activar} onTouchStart={activar} onFocus={activar} />;
}
