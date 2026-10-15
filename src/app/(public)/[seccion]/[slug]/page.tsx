import type { Metadata } from "next";
import { getSlugPorRutaOriginal } from "@/lib/content";
import { makeMetadata, makePage } from "../../_pages/articulo";
import { resolverRutaAntigua } from "../../_pages/ruta-antigua";

/**
 * Las notas migradas del sitio anterior, en SU dirección original (`/regiones/titulo`), sin redirección: ni una URL de las que Google ya
 * tiene indexadas cambia. Si la dirección no es la de ninguna nota (una sección antigua, una nota nueva buscada por título, un error),
 * se resuelve como antes: redirecciones, categoría o 404. Las rutas con nombre propio (`/categoria/x`, `/autor/x`…) ganan a esta.
 */
export const revalidate = 3600;
// Las páginas no se generan en la compilación: se crean en la primera visita y se guardan.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ seccion: string; slug: string }> };

// Decodifica un tramo de la dirección (por si llega con %XX).
const decodificar = (t: string) => {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
};

// Dirección de la nota por su ruta original; null si ninguna nota publicada la tiene.
async function slugDeLaRuta(params: Props["params"]): Promise<{ slug: string | null; partes: string[] }> {
  const { seccion, slug } = await params;
  const partes = [decodificar(seccion), decodificar(slug)];
  const nota = await getSlugPorRutaOriginal(`/${partes.join("/")}`).catch(() => null);
  return { slug: nota, partes };
}

// Metadatos de la nota (canónica = esta misma dirección).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await slugDeLaRuta(params);
  if (!slug) return { robots: { index: false } };
  return makeMetadata("es")({ params: Promise.resolve({ slug }), desdeOriginal: true });
}

// La nota en su dirección original; si no es de ninguna nota, el comportamiento de siempre para direcciones antiguas.
export default async function Page({ params }: Props) {
  const { slug, partes } = await slugDeLaRuta(params);
  if (!slug) return resolverRutaAntigua(partes);
  return makePage("es")({ params: Promise.resolve({ slug }), desdeOriginal: true });
}
