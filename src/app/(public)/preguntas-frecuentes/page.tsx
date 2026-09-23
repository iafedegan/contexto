/** Página institucional del menú secundario (§2.2). Contenido en src/content/institucional.ts */
import { makePage, makeMetadata } from "../_pages/institucional";

export const revalidate = 86400;
export const generateMetadata = makeMetadata("preguntas-frecuentes", "es");
export default makePage("preguntas-frecuentes", "es");
