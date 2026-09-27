import type { NextConfig } from "next";

/**
 * Política de seguridad de contenido (CSP). Va en modo SOLO INFORME: el
 * navegador no bloquea nada, solo avisa a /api/csp-report de lo que habría
 * bloqueado. Tras unos días sin avisos legítimos (publicidad, Tag Manager…),
 * se cambia la cabecera a `Content-Security-Policy` para hacerla obligatoria.
 *
 * `'unsafe-inline'` en scripts es necesario sin nonces, y los nonces obligarían
 * a renderizar cada visita (perderíamos la caché ISR). El resto de directivas
 * sí cierran lo importante: de dónde se cargan scripts, marcos y formularios.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://challenges.cloudflare.com",
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://challenges.cloudflare.com https://www.googletagmanager.com",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ");

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
          { key: "Content-Security-Policy-Report-Only", value: CSP },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
