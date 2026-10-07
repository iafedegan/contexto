/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 */
import type { Metadata } from "next";
import { makePage } from "../_pages/observatorio";

// Se genera en cada visita y nunca en el build (lee de la caché de datos).
export const dynamic = "force-dynamic";

// Título y descripción de la página.
export const metadata: Metadata = {
  title: "Observatorio ganadero",
  description: "Precio del ganado gordo y flaco en Colombia, mes a mes y por región, con las cifras oficiales de FEDEGÁN.",
  alternates: { canonical: "/observatorio" },
};
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("es");
