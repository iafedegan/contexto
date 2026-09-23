import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import { JsonLd } from "@/components/json-ld";
import { organizationJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";
import { getSiteIdentity } from "@/lib/site-identity";
import "./globals.css";

/**
 * Los metadatos se generan en cada render porque el nombre, el lema y la
 * descripción los edita un administrador en /panel/configuracion; si fueran
 * un objeto estático habría que redesplegar para cambiar el título del sitio.
 */
export async function generateMetadata(): Promise<Metadata> {
  const identity = await getSiteIdentity();
  return {
  metadataBase: new URL(siteUrl("/")),
  title: {
    default: `${identity.name} — ${identity.tagline}`,
    template: `%s | ${identity.name}`,
  },
  description: identity.description,
  applicationName: identity.name,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": siteUrl("/feed.xml") },
  },
  openGraph: { type: "website", siteName: identity.name, locale: "es_CO" },
  robots: { index: true, follow: true, "max-image-preview": "large" },
  };
}

/**
 * `viewport` va separado de `metadata` (Next 15+). `maximumScale` sin límite y
 * `userScalable` activo: bloquear el zoom es un fallo de accesibilidad que
 * además penaliza en la auditoría móvil.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#05100b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={fontVariables}>
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--accent-fg)]"
        >
          Saltar al contenido
        </a>
        <JsonLd data={organizationJsonLd()} />
        {children}
      </body>
    </html>
  );
}
