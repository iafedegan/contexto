import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { JsonLd } from "@/components/json-ld";
import { organizationJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "CONtexto Ganadero";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl("/")),
  title: {
    default: `${SITE_NAME} — Noticias del sector ganadero colombiano`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Noticias, análisis y datos del sector ganadero y agropecuario de Colombia: mercados, regiones, sostenibilidad y política gremial.",
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": siteUrl("/feed.xml") },
  },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "es_CO" },
  robots: { index: true, follow: true, "max-image-preview": "large" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <JsonLd data={organizationJsonLd()} />
        {children}
      </body>
    </html>
  );
}
