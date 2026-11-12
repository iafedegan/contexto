/**
 * Variables de una franja de fondo BLANCO dentro de la portada (la tercera franja, «Lo más reciente», y las franjas por sección que alternan con
 * el fondo del tema): se reasignan los colores que usan los textos, bordes y tarjetas de dentro para que se lean sobre blanco.
 */
import type { CSSProperties } from "react";

export const VARIABLES_BLANCO = {
  "--fg": "#022327",
  "--fg-muted": "#4a6a6a",
  "--border": "rgba(2,35,39,0.14)",
  "--border-strong": "rgba(2,35,39,0.28)",
  "--surface": "#ffffff",
  "--surface-2": "#eef4f4",
  "--bg": "#ffffff",
  "--bg-2": "#f4f8f8",
  "--accent": "#8a6200",
  "--link": "#0b6b67",
  backgroundColor: "#ffffff",
  color: "#022327",
} as CSSProperties;
