/** Página institucional del menú secundario (§2.2). Contenido en src/content/institucional.ts */
import { makePage, makeMetadata } from "../_pages/institucional";

// Se genera en cada visita y nunca en el build: prerenderizar aquí consultaba
// Supabase desde el servidor de build y el despliegue caía por timeout.
export const dynamic = "force-dynamic";
// Metadatos de la página (título, descripción y datos para buscadores y redes).
export const generateMetadata = makeMetadata("politica-de-privacidad", "es");
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("politica-de-privacidad", "es");
