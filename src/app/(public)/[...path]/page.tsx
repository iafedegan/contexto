import { resolverRutaAntigua } from "../_pages/ruta-antigua";

/**
 * Catch-all de baja prioridad. Resuelve las redirecciones 301 uno-a-uno de la tabla `redirects` (las de taxonomía completa las hace el proxy,
 * src/proxy.ts). Si no hay coincidencia -> 404. La lógica está en `_pages/ruta-antigua.tsx`: la comparte la ruta de las notas migradas
 * (`[seccion]/[slug]`) cuando la dirección no es la de ninguna nota.
 *
 * NOTA: los artículos del archivo histórico viven en `articles` (con su dirección original en `legacy_path`) y se sirven en `[seccion]/[slug]`.
 */
export const dynamic = "force-dynamic";

// Rutas que no existen: aplica las redirecciones antiguas (taxonomía legada y tabla redirects) o responde 404.
export default async function CatchAll({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return resolverRutaAntigua(path);
}
