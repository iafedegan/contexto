import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { fontVariables } from "./fonts";
import { JsonLd } from "@/components/json-ld";
import { organizationJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";
import { getSiteIdentity } from "@/lib/site-identity";
import { getSearchConsoleToken } from "@/lib/analytics-server";
import { PwaAvisos } from "@/components/pwa-avisos";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

/**
 * Los metadatos se generan en cada render porque el nombre, el lema y la
 * descripción los edita un administrador en /panel/configuracion; si fueran
 * un objeto estático habría que redesplegar para cambiar el título del sitio.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [identity, verificacion] = await Promise.all([
    getSiteIdentity(),
    getSearchConsoleToken().catch(() => ""),
  ]);
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
  // Imagen por defecto para portada, categorías, autor, institucionales…
  // cualquier página que no fije su propio openGraph (los artículos sí lo
  // hacen, con su portada, en articleMetadata). Sin esto compartir el sitio
  // en WhatsApp/Facebook/X no mostraba ninguna vista previa.
  openGraph: {
    type: "website",
    siteName: identity.name,
    locale: "es_CO",
    images: [{ url: siteUrl("/logo/contexto-ganadero-logo.jpg"), width: 447, height: 447, alt: identity.name }],
  },
  twitter: {
    card: "summary",
    images: [siteUrl("/logo/contexto-ganadero-logo.jpg")],
  },
  robots: { index: true, follow: true, "max-image-preview": "large" },
  // Verificación de propiedad en Search Console, si está configurada.
  ...(verificacion ? { verification: { google: verificacion } } : {}),
  // Instalable como aplicación: el manifiesto lo genera src/app/manifest.ts.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: identity.name },
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
    <html lang="es-CO" className={fontVariables} suppressHydrationWarning>
      <head>
        {/*
          Se decide el modo ANTES de pintar. Si esto se hiciera en un efecto de
          React, el lector vería un destello de fondo claro en cada carga, que
          es justo lo que hace que un modo oscuro se perciba como mal hecho.
        */}
        <Script
          id="modo-oscuro-antes-de-pintar"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('cg-modo');if(m){document.documentElement.dataset.dark=m==='oscuro'?'1':'0';}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.dataset.dark='1';}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--accent-fg)]"
        >
          Saltar al contenido
        </a>
        <JsonLd data={organizationJsonLd()} />
        <PwaRegister />
        <PwaAvisos />
        {children}
      </body>
    </html>
  );
}
