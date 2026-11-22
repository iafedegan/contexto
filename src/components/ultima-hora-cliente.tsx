"use client";

import { usePathname } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";
import { useRecurso } from "@/lib/recurso-cliente";
import { BreakingBadge } from "@/components/live-badge";

/** Respuesta de `/api/ultima-hora`: las notas marcadas a la vista (las 8 más recientes) y la más reciente de todas. */
export type UltimaHora = { slugs: string[]; nota: { slug: string } | null };

// Dirección válida de una nota: va dentro de un selector CSS.
const SLUG = /^[a-z0-9-]+$/;

/**
 * «Última hora» se pinta en el navegador en las páginas estáticas (notas, autores): marcar o desmarcar una nota no regenera ninguna página
 * guardada, y el cambio se ve en todas apenas `/api/ultima-hora` lo refleja (la red lo guarda 30 s y el panel lo borra al cambiar la marca).
 */
function useUltimaHora(inicial?: UltimaHora): UltimaHora | null {
  const pathname = usePathname();
  const pedida = useRecurso<UltimaHora>(inicial ? null : "/api/ultima-hora", pathname);
  return inicial ?? pedida;
}

/**
 * Insignia «Última hora» en la esquina de la imagen de la tarjeta de cada nota marcada. Es CSS y no un componente porque las tarjetas se
 * pintan también desde componentes de cliente; cada tarjeta lleva su `data-bs-root` con el slug. Va en posición absoluta: no mueve nada.
 */
function estiloUltimaHora(slug: string, etiqueta: string): string {
  const texto = `⚡ ${etiqueta}`.toUpperCase().replace(/["\\\n]/g, "");
  return `[data-bs-root="${slug}"] .lx-media{position:relative;container-type:inline-size}[data-bs-root="${slug}"] .lx-media::after{content:"${texto}";position:absolute;top:.6rem;left:.6rem;z-index:5;pointer-events:none;background:var(--danger,#c0392b);color:#fff;font:700 .66rem/1 var(--font-ui,system-ui,sans-serif);letter-spacing:.14em;padding:.4rem .65rem;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.4);white-space:nowrap}@container (max-width:150px){[data-bs-root="${slug}"] .lx-media::after{content:"⚡";top:.35rem;left:.35rem;padding:.3rem .42rem;font-size:.75rem}}`;
}

/** Las insignias de las tarjetas. Con `inicial` (portada, secciones: dinámicas) salen ya en el HTML; sin él se piden al navegar. */
export function UltimaHoraInsignias({ locale, inicial }: { locale: Locale; inicial?: UltimaHora }) {
  const d = useUltimaHora(inicial);
  if (!d) return null;
  return (
    <>
      {d.slugs.filter((sl) => SLUG.test(sl)).map((sl) => (
        <style key={sl} dangerouslySetInnerHTML={{ __html: estiloUltimaHora(sl, t(locale, "breaking.label")) }} />
      ))}
    </>
  );
}

/** La insignia roja sobre la foto de la propia nota, si es la «Última hora» más reciente (quien llega por un enlace la ve de entrada). */
export function InsigniaUltimaHoraNota({ slug, locale, className }: { slug: string; locale: Locale; className?: string }) {
  const d = useUltimaHora();
  return d?.nota?.slug === slug ? <BreakingBadge locale={locale} className={className} /> : null;
}
