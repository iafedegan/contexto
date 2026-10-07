import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/theme";

// Manifiesto de la PWA: nombre, colores, íconos y modo de pantalla.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Noticias del sector ganadero colombiano`,
    short_name: SITE_NAME,
    description:
      "Noticias, análisis y datos del sector ganadero y agropecuario de Colombia.",
    // Identidad propia de la app instalada y ícono con versión: Android no reutiliza el ícono viejo del atajo de antes.
    id: "/?app=cg-2",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // El verde profundo de la baldosa del logo: la pantalla de arranque y la barra de la app no desentonan con el ícono.
    background_color: "#05100b",
    theme_color: "#05100b",
    lang: "es-CO",
    categories: ["news", "agriculture"],
    icons: [
      { src: "/api/pwa-icon?size=192&v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon?size=512&v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/api/pwa-icon?size=192&maskable=1&v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/api/pwa-icon?size=512&maskable=1&v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
