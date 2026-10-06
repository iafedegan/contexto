import type { Metadata } from "next";
import { makePage } from "../_pages/politica-ia";

// Se genera en cada visita y nunca en el build (ver las demás páginas institucionales).
export const dynamic = "force-dynamic";

// Título y descripción de la página.
export const metadata: Metadata = {
  title: "Política de uso de inteligencia artificial",
  description: "Reglas de CONtexto Ganadero para el uso de IA: aprobación humana, verificación de cifras y citas, trazabilidad y límites.",
};
// Página: se construye con la plantilla compartida.
export default makePage("es");
