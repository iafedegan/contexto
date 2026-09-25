/**
 * Ruta en inglés. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 * Por eso la versión /en no se indexa y apunta como canónica a la española.
 */
import { makePage, makeMetadata } from "../../../_pages/categoria";

// Lee filtros de la URL (?pagina, ?subcategoria, ?desde, ?hasta): se genera
// en cada visita. Una página ISR no puede leer searchParams (da 500 en
// producción). Las notas y la portada sí salen de caché.
export const dynamic = "force-dynamic";
export const generateMetadata = makeMetadata("en");
export default makePage("en");
