import type { Locale } from "@/lib/i18n";

/**
 * El logo grande de la cabecera (nombre, redes, fecha, radio y modo claro/oscuro): se ve SIEMPRE, en la portada y en todas las páginas.
 * Antes se plegaba al entrar a una sección; ya no. Se conserva el contenedor `.cg-mastil` (ver globals.css).
 */
export function MastilPortada({ children }: { locale?: Locale; children: React.ReactNode }) {
  return (
    <div className="cg-mastil" data-oculto={false}>
      <div className="cg-mastil-interior">{children}</div>
    </div>
  );
}

/** El escudo de la barra verde: con el logo grande siempre visible, sobra, así que queda escondido. */
export function EscudoSecciones({ children }: { locale?: Locale; children: React.ReactNode }) {
  return (
    <div className="cg-escudo" data-oculto={true} aria-hidden={true}>
      <div className="cg-escudo-interior">{children}</div>
    </div>
  );
}
