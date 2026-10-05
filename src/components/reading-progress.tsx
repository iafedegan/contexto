"use client";

import { useEffect, useState } from "react";

/** Filete de progreso de lectura, exclusivo de la plantilla de artículo. */
export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    // Calcula el avance de lectura según el desplazamiento.
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setPct(h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="absolute inset-x-0 top-0 h-[2px] bg-transparent"
      role="progressbar"
      aria-label="Progreso de lectura"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full origin-left transition-[width] duration-150 ease-out"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
        }}
      />
    </div>
  );
}
