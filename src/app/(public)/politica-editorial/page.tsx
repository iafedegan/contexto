/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import type { Metadata } from "next";
import { makePage } from "../_pages/politica";

// Se genera en cada visita y nunca en el build: prerenderizar aquí consultaba
// Supabase desde el servidor de build y el despliegue caía por timeout.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Política editorial",
  description: "Cómo trabaja la redacción de CONtexto Ganadero: verificación, uso de asistentes de IA y atribución de autoría.",
};
export default makePage("es");
