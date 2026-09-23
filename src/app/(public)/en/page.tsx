/**
 * Ruta en inglés. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 * Por eso la versión /en no se indexa y apunta como canónica a la española.
 */
import { makePage } from "../_pages/home";

export const revalidate = 300;
export const dynamic = "error";
export default makePage("en");
