/** Espejo en inglés: cambia la interfaz, no el documento. Va con noindex. */
import { makePage, makeMetadata } from "../../_pages/institucional";

// Se genera en cada visita y nunca en el build: prerenderizar aquí consultaba
// Supabase desde el servidor de build y el despliegue caía por timeout.
export const dynamic = "force-dynamic";
// Metadatos de la página (título, descripción y datos para buscadores y redes).
export const generateMetadata = makeMetadata("derechos-de-autor", "en");
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("derechos-de-autor", "en");
