/**
 * Ruta en inglés. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 * Por eso la versión /en no se indexa.
 */
import type { Metadata } from "next";
import { makePage } from "../../_pages/observatorio";

// Se genera en cada visita y nunca en el build (lee de la caché de datos).
export const dynamic = "force-dynamic";

// Título y descripción de la página.
export const metadata: Metadata = {
  title: "Cattle observatory",
  robots: { index: false, follow: true },
};
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("en");
