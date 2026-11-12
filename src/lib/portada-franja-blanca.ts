/**
 * Variables de una franja de fondo BLANCO dentro de la portada (la tercera franja, «Lo más reciente», y las franjas por sección que alternan con
 * el fondo del tema): se reasignan los colores que usan los textos, bordes y tarjetas de dentro para que se lean sobre blanco.
 */
import type { CSSProperties } from "react";

export const VARIABLES_BLANCO = {
  "--fg": "#14201a",
  "--fg-muted": "#55625a",
  "--border": "rgba(20,32,26,0.14)",
  "--border-strong": "rgba(20,32,26,0.28)",
  "--surface": "#ffffff",
  "--surface-2": "#f2f5f2",
  "--bg": "#ffffff",
  "--bg-2": "#f6f8f6",
  "--accent": "#8a6a12",
  "--link": "#0f5132",
  backgroundColor: "#ffffff",
  color: "#14201a",
} as CSSProperties;
