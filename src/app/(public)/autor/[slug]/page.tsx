/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import { makePage, makeMetadata } from "../../_pages/autor";

export const revalidate = 3600;
export const generateMetadata = makeMetadata("es");
export default makePage("es");
