/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import type { Metadata } from "next";
import { makePage } from "../_pages/buscar";

// Se genera en cada visita y nunca en el build: prerenderizar aquí consultaba
// Supabase desde el servidor de build y el despliegue caía por timeout.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar",
  robots: { index: false, follow: true }, // resultados de búsqueda no se indexan
};
export default makePage("es");
