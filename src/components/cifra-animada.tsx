"use client";

import { useEffect, useRef, useState } from "react";
import { formatear, type Formato } from "@/lib/graficas";

/**
 * Una cifra que cuenta hacia arriba hasta su valor cuando entra en pantalla. El servidor ya pinta el valor final (se lee
 * sin JavaScript y no hay saltos de diseño); con «reducir movimiento» no se anima.
 */
export function CifraAnimada({ valor, formato = "entero", prefijo = "", className }: { valor: number; formato?: Formato; prefijo?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(valor);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const paso = (t: number) => {
          const p = Math.min(1, (t - t0) / 1100);
          setV(valor * (1 - Math.pow(1 - p, 3))); // frena al llegar
          if (p < 1) raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [valor]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {formatear(v, formato, prefijo)}
    </span>
  );
}
