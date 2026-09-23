import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

/**
 * robots.txt — CORRIGE el hallazgo del diagnóstico: hoy el rastreo legítimo está
 * bloqueado por error. Aquí se permite EXPLÍCITAMENTE a:
 *  - buscadores (Googlebot, Bingbot, …) vía la regla general
 *  - crawlers de plataformas de IA (GPTBot, ClaudeBot, PerplexityBot, …)
 *
 * Solo se excluye el panel editorial y los endpoints internos.
 */
export default function robots(): MetadataRoute.Robots {
  // `/vista-previa` lleva además `noindex`: son borradores con enlace firmado.
  const disallow = ["/panel", "/api/", "/buscar", "/vista-previa"];

  const aiBots = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-User",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
    "Bytespider",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...aiBots.map((ua) => ({ userAgent: ua, allow: "/", disallow })),
    ],
    // Google News exige su propio sitemap, con las 48 h más recientes.
    sitemap: [siteUrl("/sitemap.xml"), siteUrl("/news-sitemap.xml")],
    host: siteUrl("/"),
  };
}
