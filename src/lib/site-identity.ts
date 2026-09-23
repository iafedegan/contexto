import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Identidad del sitio, editable desde /panel/configuracion.
 *
 * Vive en `site_settings` (no en variables de entorno) para que un editor
 * pueda cambiar el nombre o el lema sin tocar el despliegue. Las variables
 * `NEXT_PUBLIC_*` siguen sirviendo de valor inicial.
 */
export type SiteIdentity = {
  name: string;
  tagline: string;
  description: string;
  /** Dominio canónico, sin protocolo. Vacío = el de la variable de entorno. */
  domain: string;
  /** Stream de la emisora (AI-02). Vacío = no se muestra el botón de play. */
  radioStreamUrl: string;
};

export const SITE_IDENTITY_KEY = "site_identity";

export const DEFAULT_IDENTITY: SiteIdentity = {
  name: env(process.env.NEXT_PUBLIC_SITE_NAME, "CONtexto Ganadero"),
  tagline: "Periodismo del sector ganadero",
  description:
    "Noticias, análisis y datos del sector ganadero y agropecuario de Colombia: mercados, regiones, sostenibilidad y política gremial.",
  domain: "",
  radioStreamUrl: "",
};

/** `cache()`: una sola consulta por render aunque la pidan layout y páginas. */
export const getSiteIdentity = cache(async (): Promise<SiteIdentity> => {
  try {
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, SITE_IDENTITY_KEY))
      .limit(1);
    return { ...DEFAULT_IDENTITY, ...((row?.value as Partial<SiteIdentity>) ?? {}) };
  } catch {
    // Sin base de datos (build local): valores por defecto.
    return DEFAULT_IDENTITY;
  }
});
