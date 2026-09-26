/** Página institucional del menú secundario (§2.2). Contenido en src/content/institucional.ts */
import { makePage, makeMetadata } from "../_pages/institucional";

// Se genera en cada visita y nunca en el build: prerenderizar aquí consultaba
// Supabase desde el servidor de build y el despliegue caía por timeout.
export const dynamic = "force-dynamic";
export const generateMetadata = makeMetadata("terminos-y-condiciones", "es");
export default makePage("terminos-y-condiciones", "es");
