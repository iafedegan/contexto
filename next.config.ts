import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
    ];
  },

  // El archivo histórico vive en el sistema legado; ninguna de sus URLs se
  // reescribe aquí. Las redirecciones 301 de taxonomía están en middleware.ts.
};

export default nextConfig;
