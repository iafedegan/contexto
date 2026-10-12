/**
 * Direcciones de notas del sitio anterior: `/seccion/titulo-de-la-nota` (dos segmentos, sin ampliar). Devuelve el título final
 * (el «slug», que se conservó idéntico al migrar) o `null` si la ruta no tiene esa forma. Función pura para poder probarla.
 */
export function slugDeNotaAntigua(segmentos: string[]): string | null {
  if (segmentos.length !== 2) return null;
  const [seccion, slug] = segmentos.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(seccion)) return null;
  if (!/^[a-z0-9][a-z0-9-]{3,220}$/.test(slug)) return null;
  return slug;
}
