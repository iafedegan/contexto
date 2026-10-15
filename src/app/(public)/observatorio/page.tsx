/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 */
import type { Metadata } from "next";
import { makePage } from "../_pages/observatorio";

// Página estática: se genera en la primera visita y se sirve desde la caché global. Se regenera cada hora y, además, al instante
// cuando el cron diario detecta datos nuevos (ver /api/cron/publish-scheduled). Nunca se prerenderiza en el build.
export const revalidate = 3600;

// Título y descripción de la página.
export const metadata: Metadata = {
  title: "Observatorio ganadero",
  description: "Precio del ganado gordo y flaco en Colombia, mes a mes y por región, con las cifras oficiales de FEDEGÁN.",
  alternates: { canonical: "/observatorio" },
};
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("es");
