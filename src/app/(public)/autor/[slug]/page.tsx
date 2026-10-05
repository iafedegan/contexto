/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import { makePage, makeMetadata } from "../../_pages/autor";

// Se regenera como máximo cada hora; al publicar se renueva al instante.
export const revalidate = 3600;
// Metadatos de la página (título, descripción y datos para buscadores y redes).
export const generateMetadata = makeMetadata("es");
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("es");
