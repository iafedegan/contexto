/**
 * Pestañas de la barra inferior del celular y cuál está activa según la dirección. Es lógica pura (sin servidor ni
 * navegador) para poder probarla: la barra solo la pinta.
 */

/** Las cinco pestañas, de izquierda a derecha; la central es el asistente (el toro). */
export type Pestana = "inicio" | "secciones" | "asistente" | "buscar" | "boletin";

/** Idioma de la interfaz según la ruta: «/en» y todo lo que cuelga de ella es inglés. */
export function idiomaDeRuta(pathname: string): "es" | "en" {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "es";
}

/** Pestaña que corresponde a una ruta, o `null` si ninguna (p. ej. una nota o una página institucional). */
export function pestanaActiva(pathname: string): Pestana | null {
  // Sin el prefijo de idioma: «/en/buscar» y «/buscar» son la misma pestaña.
  const ruta = (idiomaDeRuta(pathname) === "en" ? pathname.slice(3) : pathname).replace(/\/+$/, "") || "/";
  if (ruta === "/") return "inicio";
  if (ruta === "/categoria" || ruta.startsWith("/categoria/")) return "secciones";
  if (ruta === "/asistente" || ruta.startsWith("/asistente/")) return "asistente";
  if (ruta === "/buscar" || ruta.startsWith("/buscar/")) return "buscar";
  if (ruta === "/boletin" || ruta.startsWith("/boletin/")) return "boletin";
  return null;
}

/** Nombre del evento con el que la barra pide al menú lateral que se abra (lo escucha `MobileNav`). */
export const EVENTO_ABRIR_MENU = "cg:abrir-menu";
