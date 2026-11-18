/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import { makePage, makeMetadata, generateStaticParams } from "../../_pages/articulo";

// Se regenera como máximo una vez al día; al publicar o editar se renueva al instante (revalidarNotas).
export const revalidate = 86400;
// Las páginas no se generan en la compilación: se crean en la primera visita y se guardan.
export { generateStaticParams };
// Metadatos de la página (título, descripción y datos para buscadores y redes).
export const generateMetadata = makeMetadata("es");
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("es");
