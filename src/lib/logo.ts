/**
 * El logo de CONtexto Ganadero, dibujado en código: un monograma «Cg» geométrico —la C dorada, la g crema— sobre una
 * baldosa esmeralda. Es la ÚNICA fuente del logo: `public/logo/contexto-ganadero-logo.svg` sale de aquí
 * (`npx tsx scripts/generar-logo.ts`, con una prueba que avisa si se separan), y los íconos de la pestaña, de iOS y de la
 * PWA dibujan este mismo SVG. Sin imágenes ni tipografías: queda nítido a cualquier tamaño, de 16 px a un cartel.
 *
 * Geometría (lienzo de 100 × 100): C = arco de radio 20,5 y trazo 12 abierto ±50°; g = cuenco de radio 12, tallo a su
 * derecha y gancho de radio 9; mismo trazo en las dos letras. Las letras no se tocan: se leen enteras hasta en 16 px.
 */

/** Colores de marca del logo (esmeralda y oro de la plantilla «Esmeralda Real», más la crema del texto). */
export const LOGO_COLORES = {
  esmeralda: "#15593f",
  esmeraldaProfundo: "#04150d",
  oroClaro: "#f4d98a",
  oro: "#c8982a",
  crema: "#f8f4e7",
} as const;

/**
 * Cómo se recorta el logo:
 *  - `redondeado`: baldosa de esquinas redondas, para la pestaña, la cabecera y la PWA «any».
 *  - `completo`: cuadrado a sangre, para los íconos que el sistema recorta por su cuenta (iOS, PWA «maskable»).
 */
export type LogoFondo = "redondeado" | "completo";

/** Ajustes del dibujo. `escala` encoge solo las letras (la zona segura de los íconos «maskable» es el 80 % central). */
export type LogoOpciones = { fondo?: LogoFondo; escala?: number };

// Dos decimales bastan a cualquier tamaño y dejan el SVG corto y estable.
const n = (v: number) => String(Math.round(v * 100) / 100);

// Trazos de las letras.
const GROSOR = 12;
const C = { cx: 35.5, cy: 48, r: 20.5, apertura: (50 * Math.PI) / 180 };
const G = { cx: 68.5, cy: 54, r: 12, tallo: 73, gancho: 9, cola: 60 };

// Los dos extremos de la C, que se abre hacia la derecha.
const cx1 = C.cx + C.r * Math.cos(C.apertura);
const cyArriba = C.cy - C.r * Math.sin(C.apertura);
const cyAbajo = C.cy + C.r * Math.sin(C.apertura);
const trazoC = `M${n(cx1)} ${n(cyArriba)}A${n(C.r)} ${n(C.r)} 0 1 0 ${n(cx1)} ${n(cyAbajo)}`;
// La g: el tallo sale del borde alto del cuenco, baja y se recoge en un gancho que termina en horizontal.
const gx = G.cx + G.r;
const trazoG = `M${n(gx)} ${n(G.cy - G.r - GROSOR / 2)}V${n(G.tallo)}A${n(G.gancho)} ${n(G.gancho)} 0 0 1 ${n(gx - G.gancho)} ${n(G.tallo + G.gancho)}H${n(G.cola)}`;

/** El SVG completo del logo (documento independiente: sirve como archivo, como `<img>` y como data URI). */
export function logoSvg({ fondo = "redondeado", escala = 1 }: LogoOpciones = {}): string {
  const c = LOGO_COLORES;
  const baldosa =
    fondo === "completo"
      ? `<rect width="100" height="100" fill="url(#cg-t)"/>`
      : `<rect width="100" height="100" rx="24" fill="url(#cg-t)"/><rect x=".75" y=".75" width="98.5" height="98.5" rx="23.25" fill="none" stroke="url(#cg-b)" stroke-width="1.5"/>`;
  // El grupo se centra a ojo en la baldosa (la descendente de la g pesa abajo) y, si hace falta, se encoge desde el centro.
  const encoger = escala === 1 ? "" : `translate(50 50) scale(${n(escala)}) translate(-50 -50) `;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="CONtexto Ganadero">` +
    `<defs>` +
    `<linearGradient id="cg-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.esmeralda}"/><stop offset="1" stop-color="${c.esmeraldaProfundo}"/></linearGradient>` +
    `<linearGradient id="cg-o" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${c.oroClaro}"/><stop offset="1" stop-color="${c.oro}"/></linearGradient>` +
    `<linearGradient id="cg-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    baldosa +
    `<g transform="${encoger}translate(1.25 -4)" fill="none">` +
    `<path d="${trazoC}" stroke="url(#cg-o)" stroke-width="${GROSOR}"/>` +
    `<g stroke="${c.crema}" stroke-width="${GROSOR}"><circle cx="${n(G.cx)}" cy="${n(G.cy)}" r="${n(G.r)}"/><path d="${trazoG}"/></g>` +
    `</g></svg>`
  );
}

/** El mismo SVG como data URI, para `<img>` dentro de `next/og` (íconos de la pestaña, de iOS y de la PWA). */
export function logoDataUri(opciones?: LogoOpciones): string {
  return `data:image/svg+xml;base64,${Buffer.from(logoSvg(opciones)).toString("base64")}`;
}
