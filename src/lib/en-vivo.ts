import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { DEFAULT_EN_VIVO, sanitizeEnVivo, type EnVivoConfig } from "@/lib/en-vivo-types";
import { cachear, TAG_AJUSTES } from "@/lib/data-cache";

// Clave de la fila de site_settings donde se guarda la transmisión en vivo.
export const EN_VIVO_KEY = "en_vivo";

// Fila leída de la base y cacheada entre peticiones; el panel la invalida al guardar.
const leerEnVivo = cachear(
  "en-vivo",
  async () => {
    const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, EN_VIVO_KEY)).limit(1);
    return row ? { valor: row.value } : null;
  },
  { tags: [TAG_AJUSTES], segundos: 60 },
);

/** Transmisión configurada en /panel/en-vivo; si falla la base, la portada sigue sin transmisión. */
export const getEnVivo = cache(async (): Promise<EnVivoConfig> => {
  try {
    const guardado = await leerEnVivo();
    return guardado ? sanitizeEnVivo(guardado.valor) : DEFAULT_EN_VIVO;
  } catch {
    return DEFAULT_EN_VIVO;
  }
});
