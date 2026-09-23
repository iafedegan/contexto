/** Página institucional del menú secundario (§2.2). Contenido en src/content/institucional.ts */
import { makePage, makeMetadata } from "../_pages/institucional";

export const revalidate = 86400;
export const generateMetadata = makeMetadata("paute-con-nosotros", "es");
export default makePage("paute-con-nosotros", "es");
