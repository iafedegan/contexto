/** Espejo en inglés: cambia la interfaz, no el documento. Va con noindex. */
import { makePage, makeMetadata } from "../../_pages/institucional";

export const revalidate = 86400;
export const generateMetadata = makeMetadata("politica-de-cookies", "en");
export default makePage("politica-de-cookies", "en");
