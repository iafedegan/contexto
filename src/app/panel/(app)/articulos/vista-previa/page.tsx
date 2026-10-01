import type { Metadata } from "next";
import { requirePermiso } from "@/lib/auth";
import { ArticlePreviewTab } from "@/components/panel/article-preview-tab";
import { siteChrome } from "@/components/panel/site-chrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista previa del artículo", robots: { index: false, follow: false } };

export default async function Page() {
  await requirePermiso("articulos");
  return <ArticlePreviewTab chrome={await siteChrome()} />;
}
