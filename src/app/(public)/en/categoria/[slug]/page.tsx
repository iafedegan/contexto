/**
 * Ruta en inglés. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 * Por eso la versión /en no se indexa y apunta como canónica a la española.
 */
import { makePage, makeMetadata, generateStaticParams } from "../../../_pages/categoria";

export const revalidate = 600;
export { generateStaticParams };
export const generateMetadata = makeMetadata("en");
export default makePage("en");
