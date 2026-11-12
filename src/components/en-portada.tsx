"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { localePath, type Locale } from "@/lib/i18n";

/** ¿Estamos en la portada? (el editor de /panel/portada —su lienzo es /vista-portada— y la vista previa cuentan como portada). */
function useEsPortada(locale: Locale): boolean {
  const ruta = (usePathname() ?? "/").replace(/\/+$/, "") || "/";
  const inicio = localePath(locale, "/").replace(/\/+$/, "") || "/";
  return ruta === inicio || ruta === "/" || ruta === "/vista-portada" || ruta.startsWith("/panel") || ruta.startsWith("/vista-previa");
}

/** Dónde estaba el lector en la navegación anterior (solo en el navegador; vive mientras no se recargue la página). */
let estabaEnPortada: boolean | null = null;

/**
 * Cada página pinta su propia cabecera, así que al navegar el componente se vuelve a crear. Para que el cambio se anime, arranca en el estado
 * de la página ANTERIOR y, un instante después, pasa al de la actual: la transición de CSS hace el resto. En la primera carga (sin página
 * anterior) arranca ya en su estado, sin animación.
 */
function useEstadoAnimado(locale: Locale): boolean {
  const esPortada = useEsPortada(locale);
  const [mostrando, setMostrando] = useState(() => (typeof window !== "undefined" && estabaEnPortada !== null ? estabaEnPortada : esPortada));
  useEffect(() => {
    estabaEnPortada = esPortada;
    if (mostrando === esPortada) return;
    // Un temporizador corto y no `requestAnimationFrame`: en una pestaña en segundo plano éste se pausa y la cabecera se quedaría a medias.
    const id = setTimeout(() => setMostrando(esPortada), 40);
    return () => clearTimeout(id);
  }, [esPortada, mostrando]);
  return mostrando;
}

/**
 * El logo grande de la cabecera: se esconde con una animación (se pliega hacia arriba y se desvanece) al ir de la portada a una sección,
 * y vuelve a desplegarse al regresar. Siempre está montado, así que la transición va en los dos sentidos; ver `.cg-mastil` en globals.css.
 */
export function MastilPortada({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const esPortada = useEstadoAnimado(locale);
  return (
    <div className="cg-mastil" data-oculto={!esPortada} aria-hidden={!esPortada}>
      <div className="cg-mastil-interior">{children}</div>
    </div>
  );
}

/** El escudo de la barra verde: aparece (se ensancha y se enciende) al entrar a una sección y se esconde al volver a la portada. */
export function EscudoSecciones({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const esPortada = useEstadoAnimado(locale);
  return (
    <div className="cg-escudo" data-oculto={esPortada} aria-hidden={esPortada}>
      <div className="cg-escudo-interior">{children}</div>
    </div>
  );
}

/** El botón de inicio de la barra verde (casa sobre crema): solo en la portada; en las secciones lo reemplaza el escudo. */
export function BotonInicio({ locale, etiqueta }: { locale: Locale; etiqueta: string }) {
  const esPortada = useEsPortada(locale);
  if (!esPortada) return null;
  return (
    <a
      href={localePath(locale, "/")}
      aria-label={etiqueta}
      className="mr-2 grid size-10 place-items-center text-[#0d2318] transition-transform hover:scale-110"
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden>
        <path d="M12 3 2 12h3v8h5v-5h4v5h5v-8h3z" />
      </svg>
    </a>
  );
}
