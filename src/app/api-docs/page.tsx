import type { Metadata } from "next";
import Script from "next/script";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";
// Título y descripción de la página de documentación.
export const metadata: Metadata = {
  title: "Documentación de la API",
  description: "API pública para artículos, categorías y alta al boletín.",
  robots: { index: false, follow: true },
};

/**
 * Documentación interactiva de `/api/v1/*`, generada a partir de
 * `/api/openapi.json` con Scalar (embebido por CDN: no añade una dependencia
 * de npm a un proyecto que ya carga bastante).
 */
export default function ApiDocsPage() {
  return (
    <>
      <div
        id="api-reference"
        data-url="/api/openapi.json"
        data-configuration={JSON.stringify({
          theme: "purple",
          hideClientButton: false,
          authentication: { preferredSecurityScheme: "apiKey" },
        })}
      />
      <Script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference" strategy="afterInteractive" />
    </>
  );
}
