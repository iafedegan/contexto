import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Identifica cada despliegue: el Service Worker se registra con esta
  // versión y así los teléfonos toman el diseño nuevo sin intervención manual.
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? process.env.VERCEL_DEPLOYMENT_ID ?? String(Date.now()),
  },
  reactStrictMode: true,

  // PGlite (Postgres embebido para el MVP local) carga WASM en tiempo de ejecución
  // y no debe pasar por el bundler del servidor.
  serverExternalPackages: ["@electric-sql/pglite"],

  // Imágenes remotas del CDN de medios. Ajustar al dominio real de assets.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.contextoganadero.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      // Solo para las imágenes de ejemplo del seed local.
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // El Service Worker debe revalidarse siempre: nunca servir una versión
        // vieja de la lógica de caché offline desde un CDN/browser cache.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  // El archivo histórico vive en el sistema legado; ninguna de sus URLs se
  // reescribe aquí. Las redirecciones 301 de taxonomía están en middleware.ts.
};

export default function (phase: string): NextConfig {
  if (phase) {
    process.env.NEXT_PHASE = phase;
  }
  return nextConfig;
}
