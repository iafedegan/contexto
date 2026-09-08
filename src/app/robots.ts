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
  const disallow = ["/panel", "/api/", "/buscar"];

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
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}
