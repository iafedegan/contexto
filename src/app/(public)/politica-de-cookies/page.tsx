/** Página institucional del menú secundario (§2.2). Contenido en src/content/institucional.ts */
import { makePage, makeMetadata } from "../_pages/institucional";

export const revalidate = 86400;
export const generateMetadata = makeMetadata("politica-de-cookies", "es");
export default makePage("politica-de-cookies", "es");
