/** Espejo en inglés: cambia la interfaz, no el documento. Va con noindex. */
import { makePage, makeMetadata } from "../../_pages/institucional";

export const revalidate = 86400;
export const generateMetadata = makeMetadata("paute-con-nosotros", "en");
export default makePage("paute-con-nosotros", "en");
