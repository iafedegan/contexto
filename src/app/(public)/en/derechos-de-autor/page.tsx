/** Espejo en inglés: cambia la interfaz, no el documento. Va con noindex. */
import { makePage, makeMetadata } from "../../_pages/institucional";

export const revalidate = 86400;
export const generateMetadata = makeMetadata("derechos-de-autor", "en");
export default makePage("derechos-de-autor", "en");
