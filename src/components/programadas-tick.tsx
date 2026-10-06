"use client";

import { useEffect } from "react";

/**
 * Avisa al servidor de que revise si hay notas programadas que ya llegaron a su hora (`/api/programadas`). Sustituye a
 * la escritura que antes ocurría al armar cada página: ahora las lecturas no escriben y la promoción tiene un solo
 * sitio. Espera unos segundos tras cargar y, como mucho, avisa una vez cada cinco minutos por navegador; el servidor
 * además la limita a una vez por minuto en todo el sitio.
 */
const CADA_MS = 5 * 60_000;

export function ProgramadasTick() {
  useEffect(() => {
    const clave = "cg:tick-programadas";
    try {
      if (Date.now() - Number(localStorage.getItem(clave) ?? 0) < CADA_MS) return;
      localStorage.setItem(clave, String(Date.now()));
    } catch {
      /* sin almacenamiento: se avisa igualmente; el servidor pone el límite */
    }
    const id = window.setTimeout(() => {
      void fetch("/api/programadas", { method: "POST", keepalive: true }).catch(() => {});
    }, 8000);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
