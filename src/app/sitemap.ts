import type { MetadataRoute } from "next";
import { getAllCategories, getAllPublishedSlugs } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

// Sitemap dinámico. Revalida con la misma cadencia que el contenido.
export const dynamic = "force-dynamic";

// Mapa del sitio: portada, páginas institucionales, secciones, autores y notas publicadas.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: siteUrl("/observatorio"), changeFrequency: "weekly", priority: 0.5 },
    { url: siteUrl("/asistente"), changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const [slugs, cats] = await Promise.all([getAllPublishedSlugs(), getAllCategories()]);
    return [
      ...base,
      ...cats.map((c) => ({
        url: siteUrl(`/categoria/${c.slug}`),
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
      ...slugs.map((s) => ({
        url: siteUrl(`/articulo/${s.slug}`),
        lastModified: s.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return base;
  }
}
