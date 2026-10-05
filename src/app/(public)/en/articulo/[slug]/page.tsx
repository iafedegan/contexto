/**
 * Ruta en inglés. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 * Por eso la versión /en no se indexa y apunta como canónica a la española.
 */
import { makePage, makeMetadata, generateStaticParams } from "../../../_pages/articulo";

// Se regenera como máximo cada hora; al publicar se renueva al instante.
export const revalidate = 3600;
// Las páginas no se generan en la compilación: se crean en la primera visita y se guardan.
export { generateStaticParams };
// Metadatos de la página (título, descripción y datos para buscadores y redes).
export const generateMetadata = makeMetadata("en");
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("en");
