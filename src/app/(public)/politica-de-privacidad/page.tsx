/** Página institucional del menú secundario (§2.2). Contenido en src/content/institucional.ts */
import { makePage, makeMetadata } from "../_pages/institucional";

export const revalidate = 86400;
export const generateMetadata = makeMetadata("politica-de-privacidad", "es");
export default makePage("politica-de-privacidad", "es");
