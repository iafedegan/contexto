/**
 * Ruta en inglés. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 * Por eso la versión /en no se indexa y apunta como canónica a la española.
 */
import { makePage } from "../../_pages/buscar";
import type { Metadata } from "next";

// Se genera en cada visita y nunca en el build: prerenderizar aquí consultaba
// Supabase desde el servidor de build y el despliegue caía por timeout.
export const dynamic = "force-dynamic";

// Título y descripción de la página; no se indexa si así lo indica.
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("en");
