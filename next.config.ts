import type { NextConfig } from "next";
import { cabeceraCsp } from "./src/lib/csp";

// Política de seguridad de contenido: obligatoria en producción, con válvulas por entorno (ver src/lib/csp.ts).
const CSP = cabeceraCsp();
// /api-docs (Scalar) necesita `eval` y sus tipografías: política propia, solo para esa ruta.
const CSP_DOCS = cabeceraCsp(process.env, { documentacionApi: true });

// Configuración de Next.js: cabeceras de seguridad, imágenes remotas permitidas, límite de las acciones y versión del despliegue.
const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Las acciones del servidor admiten 1 MB por defecto. En Vercel el tope real por petición es 4,5 MB, así que se declara ese
  // valor y no uno mayor que prometa lo que la plataforma no cumple: el audio de una entrevista se manda en trozos de ~3 MB y
  // los archivos grandes (hasta 25 MB) se suben directo a Storage con una dirección firmada (ver media-actions.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },

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

  // Cada página es una función de Vercel y arrastraba ~58 MB de archivos que en producción no se usan: PGlite (la base
  // embebida del modo local, 20 MB) y sharp (el optimizador de imágenes, que en Vercel corre en su propia infraestructura,
  // no dentro de la función). Una función más liviana arranca antes en frío. En producción la base es Postgres por
  // `DATABASE_URL`; sin ella el modo PGlite solo funciona en local.
  outputFileTracingExcludes: {
    "/*": ["node_modules/@electric-sql/pglite/**/*", "node_modules/sharp/**/*", "node_modules/@img/**/*"],
  },

  // Imágenes remotas del CDN de medios. Ajustar al dominio real de assets.
  images: {
    formats: ["image/avif", "image/webp"],
    // Portadas grandes (artículo a todo el ancho, carrusel): calidad 90 en vez del 75 por defecto, que se notaba blando/pixelado.
    qualities: [75, 90],
    // Sin esto, Next usa su default de 60 s: con un carrusel rotando cada
    // pocos segundos (Revista) o cualquier página donde la misma foto se
    // vea más de un minuto, el navegador la vuelve a pedir y decodificar de
    // la nada — Lighthouse lo capturaba como trabajo del hilo principal muy
    // variable entre corridas. Un día es suficiente para eliminar eso sin
    // arriesgar servir una portada vieja mucho tiempo si un editor la
    // reemplaza en la misma URL.
    minimumCacheTTL: 86400,
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
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      // La CSP va aparte para que cada ruta reciba UNA sola: todas menos /api-docs, y /api-docs con la suya.
      { source: "/((?!api-docs$).*)", headers: [{ key: CSP.key, value: CSP.value }] },
      { source: "/api-docs", headers: [{ key: CSP_DOCS.key, value: CSP_DOCS.value }] },
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
  // reescribe aquí. Las redirecciones 301 de taxonomía están en src/proxy.ts.
};

// Exporta la configuración y deja la fase actual de Next en el entorno.
export default function (phase: string): NextConfig {
  if (phase) {
    process.env.NEXT_PHASE = phase;
  }
  return nextConfig;
}
