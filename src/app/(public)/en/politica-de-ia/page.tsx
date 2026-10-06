import type { Metadata } from "next";
import { makePage } from "../../_pages/politica-ia";

// Se genera en cada visita y nunca en el build. La versión /en no se indexa.
export const dynamic = "force-dynamic";

// Título de la página; no se indexa.
export const metadata: Metadata = {
  title: "Artificial intelligence use policy",
  robots: { index: false, follow: true },
};
// Página: se construye con la plantilla compartida.
export default makePage("en");
