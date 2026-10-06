import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";
import { AI_SEARCH_BOTS, AI_TRAINING_BOTS } from "@/lib/bots";

/**
 * robots.txt
 *  - Buscadores (Googlebot, Bingbot…): permitidos, regla general.
 *  - Buscadores de IA que citan y enlazan (ChatGPT search, Perplexity…):
 *    permitidos; traen lectores.
 *  - Crawlers que copian para ENTRENAR modelos (GPTBot, CCBot…): bloqueados.
 *    El proxy (src/proxy.ts) además los rechaza con 403, porque
 *    robots.txt es solo una petición y no todos la respetan.
 */
export default function robots(): MetadataRoute.Robots {
  // `/vista-previa` lleva además `noindex`: son borradores con enlace firmado.
  const disallow = ["/panel", "/api/", "/buscar", "/vista-previa", "/vista-portada"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...AI_SEARCH_BOTS.map((ua) => ({ userAgent: ua, allow: "/", disallow })),
      ...AI_TRAINING_BOTS.map((ua) => ({ userAgent: ua, disallow: "/" })),
    ],
    // Google News exige su propio sitemap, con las 48 h más recientes.
    sitemap: [siteUrl("/sitemap.xml"), siteUrl("/news-sitemap.xml")],
    host: siteUrl("/"),
  };
}
