"use client";

import { useEffect } from "react";
import { MED_EVENT, decisionMedicion, visitante } from "@/lib/medicion-cliente";

/**
 * Mide CÓMO se lee una nota, solo si la persona aceptó la medición: hasta dónde baja, cuántos segundos la tiene a la vista
 * y desde dónde llegó. Espera cinco segundos (un rebote inmediato no es una lectura, igual que el contador simple), pide un
 * código de lectura y luego manda el avance cada 15 segundos y al salir (`sendBeacon`). Con «reducir datos» del navegador
 * o sin permiso no hace nada. No guarda nada en el dispositivo más que la cookie de código del visitante.
 */
export function LectorTracker({ slug }: { slug: string }) {
  useEffect(() => {
    let fin: (() => void) | undefined;
    const arrancar = () => {
      if (fin || decisionMedicion() !== "si") return;
      const v = visitante();
      if (!v) return;
      let id = "";
      let scroll = 0;
      let segundos = 0;
      let ultimo = "";
      let activo = true;
      const q = new URLSearchParams(location.search);

      const avance = () => {
        const alto = document.documentElement.scrollHeight - innerHeight;
        const p = alto <= 0 ? 100 : Math.round(((scrollY + innerHeight) / document.documentElement.scrollHeight) * 100);
        scroll = Math.max(scroll, Math.min(100, p));
      };
      const mandar = () => {
        if (!id) return;
        const cuerpo = JSON.stringify({ a: "p", vid: v.id, id, sc: scroll, s: segundos });
        if (cuerpo === ultimo) return;
        ultimo = cuerpo;
        const enviado = navigator.sendBeacon?.("/api/lectura", new Blob([cuerpo], { type: "application/json" }));
        if (!enviado) void fetch("/api/lectura", { method: "POST", headers: { "content-type": "application/json" }, body: cuerpo, keepalive: true }).catch(() => {});
      };
      // Cuenta un segundo solo si la pestaña está a la vista y la ventana tiene el foco.
      const reloj = setInterval(() => {
        if (document.visibilityState === "visible") segundos += 1;
        if (segundos > 0 && segundos % 15 === 0) mandar();
      }, 1000);
      const alOcultar = () => document.visibilityState === "hidden" && mandar();
      const alScroll = () => avance();

      const inicio = setTimeout(async () => {
        try {
          const r = await fetch("/api/lectura", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ a: "i", vid: v.id, slug, ret: v.recurrente, us: q.get("utm_source") ?? "", um: q.get("utm_medium") ?? "", uc: q.get("utm_campaign") ?? "", ref: document.referrer }),
            keepalive: true,
          });
          const j = (await r.json()) as { id?: string };
          if (activo && j.id) {
            id = j.id;
            avance();
            mandar();
          }
        } catch {
          /* sin red: la lectura simplemente no se mide */
        }
      }, 5000);

      window.addEventListener("scroll", alScroll, { passive: true });
      document.addEventListener("visibilitychange", alOcultar);
      window.addEventListener("pagehide", mandar);
      fin = () => {
        activo = false;
        mandar();
        clearTimeout(inicio);
        clearInterval(reloj);
        window.removeEventListener("scroll", alScroll);
        document.removeEventListener("visibilitychange", alOcultar);
        window.removeEventListener("pagehide", mandar);
      };
    };
    arrancar();
    // Si la persona acepta con la nota ya abierta, empieza en ese momento; si cambia de opinión, se detiene.
    const alCambiar = () => {
      if (decisionMedicion() === "si") arrancar();
      else {
        fin?.();
        fin = undefined;
      }
    };
    window.addEventListener(MED_EVENT, alCambiar);
    return () => {
      window.removeEventListener(MED_EVENT, alCambiar);
      fin?.();
    };
  }, [slug]);

  return null;
}
