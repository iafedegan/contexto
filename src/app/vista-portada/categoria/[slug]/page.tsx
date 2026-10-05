import type { Metadata } from "next";
import { applyDraftForRequest } from "@/components/panel/home-real-preview";
import { makePage } from "@/app/(public)/_pages/categoria";

/**
 * Una sección REAL con el borrador de /panel/portada aplicado (navbar, cuerpo
 * y pie), para verla y ajustarla dentro del lienzo. Solo editores; no indexable.
 */
export const dynamic = "force-dynamic";
// Título de la página; no se indexa en buscadores.
export const metadata: Metadata = { title: "Vista previa de sección", robots: { index: false, follow: false } };

// Página de sección reutilizada para la vista previa del editor.
const Categoria = makePage("es");

// Vista previa de una sección dentro del editor de portada.
export default async function Page(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ subcategoria?: string; desde?: string; hasta?: string; pagina?: string; popup?: string }>;
}) {
  const { popup } = await props.searchParams;
  await applyDraftForRequest({ popup: popup === "1" ? "show" : "hide" });
  return <Categoria params={props.params} searchParams={props.searchParams} locale="es" />;
}
