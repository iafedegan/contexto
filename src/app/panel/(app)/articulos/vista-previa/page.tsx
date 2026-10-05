import type { Metadata } from "next";
import { requirePermiso } from "@/lib/auth";
import { ArticlePreviewTab } from "@/components/panel/article-preview-tab";
import { siteChrome } from "@/components/panel/site-chrome";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";
// Página que no se indexa en buscadores.
export const metadata: Metadata = { title: "Vista previa del artículo", robots: { index: false, follow: false } };

// Pestaña de vista previa del artículo (exige el permiso «articulos»).
export default async function Page() {
  await requirePermiso("articulos");
  return <ArticlePreviewTab chrome={await siteChrome()} />;
}
