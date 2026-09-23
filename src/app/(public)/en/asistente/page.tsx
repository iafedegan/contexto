/**
 * Ruta en inglés. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 * Por eso la versión /en no se indexa y apunta como canónica a la española.
 */
import { makePage } from "../../_pages/asistente";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assistant",
  robots: { index: false, follow: true },
};
export default makePage("en");
