/**
 * Cuándo se deja indexar el sitio. Solo el dominio oficial (el de `NEXT_PUBLIC_SITE_URL`, con o sin «www») debe aparecer en los
 * buscadores: cualquier otra dirección que sirva el mismo portal (el `*.vercel.app` de producción, los despliegues de prueba) lleva
 * `X-Robots-Tag: noindex` y su `robots.txt` lo prohíbe todo, para que no compita con el dominio oficial con las mismas notas.
 */

/** Anfitrión (sin puerto ni «www.») de una dirección o de la cabecera Host; null si no se puede leer. */
function anfitrion(valor: string | null | undefined): string | null {
  const v = valor?.trim().toLowerCase();
  if (!v) return null;
  try {
    const host = v.includes("://") ? new URL(v).hostname : v.split(":")[0];
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** ¿Se permite indexar lo que se sirve en este anfitrión? `oficial` es la dirección canónica del sitio. */
export function anfitrionIndexable(hostDeLaPeticion: string | null | undefined, oficial: string): boolean {
  const pedido = anfitrion(hostDeLaPeticion);
  const canonico = anfitrion(oficial);
  if (!pedido || !canonico) return true; // sin datos no se bloquea: mejor indexable que invisible por error
  if (pedido === "localhost" || pedido === "127.0.0.1") return true;
  return pedido === canonico;
}
