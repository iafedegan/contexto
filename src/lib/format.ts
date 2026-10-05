/**
 * Formatos de presentación compartidos (números de Colombia y recorte de textos). Sin `server-only`: lo usan
 * componentes de servidor y de cliente.
 */

/** Números con separadores de Colombia, sin decimales fijos. */
export const nfCO = new Intl.NumberFormat("es-CO");
/** Números de Colombia con hasta un decimal. */
export const nfCO1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
/** Números de Colombia con hasta dos decimales. */
export const nfCO2 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/** Recorta un texto a `n` caracteres añadiendo puntos suspensivos (sin dejar un espacio antes de ellos). */
export const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
