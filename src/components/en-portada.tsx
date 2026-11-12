"use client";

import { usePathname } from "next/navigation";
import { localePath, type Locale } from "@/lib/i18n";

/**
 * Muestra a sus hijos solo en la portada (`donde="portada"`) o solo en el resto de páginas (`donde="resto"`). La cabecera de la portada
 * usa esto: en la portada va el logo grande; al entrar a una sección se esconde y la barra verde lleva el escudo a la izquierda.
 */
export function EnPortada({ locale, donde, children }: { locale: Locale; donde: "portada" | "resto"; children: React.ReactNode }) {
  const ruta = (usePathname() ?? "/").replace(/\/+$/, "") || "/";
  const inicio = localePath(locale, "/").replace(/\/+$/, "") || "/";
  // El editor de /panel/portada y la vista previa muestran la portada tal como está en producción.
  const esPortada = ruta === inicio || ruta === "/" || ruta.startsWith("/panel") || ruta.startsWith("/vista-previa");
  return (donde === "portada") === esPortada ? <>{children}</> : null;
}
