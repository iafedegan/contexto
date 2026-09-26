/** Espejo en inglés: cambia la interfaz, no el documento. Va con noindex. */
import { makePage, makeMetadata } from "../../_pages/institucional";

// Se genera en cada visita y nunca en el build: prerenderizar aquí consultaba
// Supabase desde el servidor de build y el despliegue caía por timeout.
export const dynamic = "force-dynamic";
export const generateMetadata = makeMetadata("preguntas-frecuentes", "en");
export default makePage("preguntas-frecuentes", "en");
