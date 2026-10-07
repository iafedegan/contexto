import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Las piezas del logo que dibujan los íconos (pestaña, iOS, PWA). Salen de `scripts/generar-logo.ts`:
 *  - `redondeado`: emblema sobre baldosa verde con esquinas redondas (pestaña y PWA «any»);
 *  - `ios`: cuadrado a sangre, que iOS recorta con su máscara;
 *  - `maskable`: cuadrado a sangre con el emblema dentro de la zona segura de los íconos «maskable».
 */
const ARCHIVOS = {
  redondeado: "contexto-ganadero-logo-512.png",
  ios: "contexto-ganadero-icon-bleed.png",
  maskable: "contexto-ganadero-maskable.png",
} as const;

// Se leen una sola vez por proceso.
const cache = new Map<string, string>();

/** La pieza como data URI PNG, para una `<img>` dentro de `next/og`. */
export function logoDataUri(pieza: keyof typeof ARCHIVOS): string {
  const archivo = ARCHIVOS[pieza];
  let uri = cache.get(archivo);
  if (!uri) {
    uri = `data:image/png;base64,${readFileSync(join(process.cwd(), "public/logo", archivo)).toString("base64")}`;
    cache.set(archivo, uri);
  }
  return uri;
}
