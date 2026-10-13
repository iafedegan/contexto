"use client";

import { Suspense, lazy, useEffect, useState, type ComponentType } from "react";

/**
 * Piezas que no hacen falta para pintar la página (la mascota flotante, los avisos de consentimiento, la ventana emergente…): su
 * JavaScript se descarga cuando la página ya terminó de cargar y el navegador está libre, y no en los primeros 600 ms, donde
 * compite con el CSS, las tipografías y el código que pinta el primer titular (el LCP de la portada).
 *
 * Solo sirve para piezas SIN efecto en la composición (fijas, flotantes o invisibles) y que no dependan de un evento que ocurre
 * temprano (p. ej. `beforeinstallprompt`, que por eso mantiene su carga normal).
 */

/** `true` cuando la página terminó de cargar y el navegador tiene un hueco libre (como mucho ~2,5 s después). */
function useTrasLaCarga(): boolean {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    let idle: number | undefined;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const activar = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => setListo(true), { timeout: 2500 });
      else espera = setTimeout(() => setListo(true), 800);
    };
    if (document.readyState === "complete") activar();
    else window.addEventListener("load", activar, { once: true });
    return () => {
      window.removeEventListener("load", activar);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (espera !== undefined) clearTimeout(espera);
    };
  }, []);
  return listo;
}

/** Envuelve un componente de cliente para que su código se pida solo después de la carga. */
export function diferido<P extends object>(cargar: () => Promise<ComponentType<P>>): ComponentType<P> {
  const Perezoso = lazy(() => cargar().then((componente) => ({ default: componente })));
  return function Diferido(props: P) {
    const listo = useTrasLaCarga();
    return listo ? (
      <Suspense fallback={null}>
        <Perezoso {...(props as P & React.JSX.IntrinsicAttributes)} />
      </Suspense>
    ) : null;
  };
}
