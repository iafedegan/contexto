"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

/**
 * Volver arriba (DM-05): esquina inferior derecha, donde cae el pulgar, con
 * un área de toque de 48 px. Aparece tras bajar más de una pantalla, para no
 * competir con el contenido al inicio de la página. Queda por debajo del
 * popup del sitio (z-90) para no taparlo.
 */
export function BackToTop({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={t(locale, "ui.backToTop")}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-[calc(var(--cg-barra,0px)+1rem)] right-4 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] shadow-md transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <ArrowUp aria-hidden className="h-5 w-5" />
    </button>
  );
}
