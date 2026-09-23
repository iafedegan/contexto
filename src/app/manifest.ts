import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

const SITE_NAME = env(process.env.NEXT_PUBLIC_SITE_NAME, "CONtexto Ganadero");

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Noticias del sector ganadero colombiano`,
    short_name: SITE_NAME,
    description:
      "Noticias, análisis y datos del sector ganadero y agropecuario de Colombia.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#1f6d3a",
    lang: "es-CO",
    categories: ["news", "agriculture"],
    icons: [
      { src: "/api/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/api/pwa-icon?size=192&maskable=1",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/api/pwa-icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
