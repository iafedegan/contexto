/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import { makePage, makeMetadata, generateStaticParams } from "../../_pages/articulo";

// Se regenera como máximo cada 30 días; al publicar o editar se renueva al instante (revalidarNotas).
export const revalidate = 2592000; // 30 días: las notas viejas no cambian; al publicar o editar se renuevan al instante (revalidarNotas).
// Las páginas no se generan en la compilación: se crean en la primera visita y se guardan.
export { generateStaticParams };
// Metadatos de la página (título, descripción y datos para buscadores y redes).
export const generateMetadata = makeMetadata("es");
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("es");
