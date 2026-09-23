/**
 * Ruta en español. Comparte la implementación y solo
 * cambia el idioma de la INTERFAZ; el contenido sigue en español.
 *
 */
import { makePage } from "./_pages/home";

export const revalidate = 300;
export const dynamic = "error";
export default makePage("es");
