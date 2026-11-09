import type { Metadata } from "next";
import { resolverRutaAntigua } from "../_pages/ruta-antigua";
import { PaginaConstruida, metadataDePagina, paginaDeLaRuta } from "../_pages/pagina-construida";

/**
 * Catch-all de baja prioridad. Primero, las páginas armadas en el panel con el constructor (`/{slug}`; las de dos tramos,
 * `/{seccion}/{pagina}`, las atiende `[seccion]/[slug]`); si no hay ninguna, resuelve las redirecciones 301 uno-a-uno de la tabla
 * `redirects` (las de taxonomía completa las hace el proxy, src/proxy.ts) o responde 404. La lógica de las rutas antiguas está en
 * `_pages/ruta-antigua.tsx`.
 *
 * NOTA: los artículos del archivo histórico viven en `articles` (con su dirección original en `legacy_path`) y se sirven en `[seccion]/[slug]`.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ path: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await paginaDeLaRuta((await params).path);
  return p ? metadataDePagina(p) : {};
}

export default async function CatchAll({ params }: Props) {
  const { path } = await params;
  const p = await paginaDeLaRuta(path);
  if (!p) return resolverRutaAntigua(path);
  return <PaginaConstruida p={p} />;
}
