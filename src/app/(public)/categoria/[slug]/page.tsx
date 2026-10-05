/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import { makePage, makeMetadata } from "../../_pages/categoria";

// Lee filtros de la URL (?pagina, ?subcategoria, ?desde, ?hasta): se genera
// en cada visita. Una página ISR no puede leer searchParams (da 500 en
// producción). Las notas y la portada sí salen de caché.
export const dynamic = "force-dynamic";
// Metadatos de la página (título, descripción y datos para buscadores y redes).
export const generateMetadata = makeMetadata("es");
// Página: se construye con la plantilla compartida de su tipo.
export default makePage("es");
