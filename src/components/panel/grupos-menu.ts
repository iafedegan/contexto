"use client";

import { useSyncExternalStore } from "react";

/**
 * Qué grupos del menú del panel (Diseño, Redactor, Configuración) están desplegados. Por defecto solo el de la página en la que estás; lo que la
 * persona abre o cierra se recuerda en este navegador y se comparte entre el menú de escritorio y el del celular. Sin almacenamiento (ventana
 * privada, datos bloqueados) funciona igual, solo que sin recordar. El servidor siempre pinta el valor por defecto, así no hay desajustes al cargar.
 */
const KEY = "panel.menu.grupos";
const oyentes = new Set<() => void>();

const leer = () => {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const suscribir = (cb: () => void) => {
  oyentes.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    oyentes.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const analizar = (raw: string): Record<string, boolean> => {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

/** El grupo que contiene la página actual (el único abierto por defecto), o `null` si ninguno. */
export function grupoDe(grupos: { id: string; items: { href: string }[] }[], pathname: string): string | null {
  const coincide = (href: string) => {
    const base = href.split(/[#?]/)[0];
    return pathname === base || (base !== "/panel" && pathname.startsWith(`${base}/`)) || (base === "/panel" && pathname.startsWith("/panel/analitica"));
  };
  return grupos.find((g) => g.items.some((i) => coincide(i.href)))?.id ?? null;
}

export function useGruposMenu(grupoActual: string | null) {
  const guardado = analizar(useSyncExternalStore(suscribir, leer, () => ""));
  const abierto = (id: string) => guardado[id] ?? id === grupoActual;
  const alternar = (id: string) => {
    const nuevo = { ...guardado, [id]: !abierto(id) };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(nuevo));
    } catch {
      /* sin almacenamiento: se cambia solo hasta recargar */
    }
    oyentes.forEach((f) => f());
  };
  return { abierto, alternar };
}
