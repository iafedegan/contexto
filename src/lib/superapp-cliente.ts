/**
 * ¿El portal se abrió dentro de la SuperApp de FEDEGÁN? Mientras FEDEGÁN no abra la MiniApp por `/superapp/launch` (con cupón), la abre como
 * un enlace cualquiera; para reconocerla, el enlace lleva la marca `?origen=superapp`. La marca se recuerda solo durante esa visita
 * (`sessionStorage`), así sigue valiendo al pasar de una nota a otra aunque la dirección ya no la lleve.
 *
 * Dentro de la SuperApp no se muestran los avisos de medición, ubicación ni instalación. Ocultar el aviso NO da el permiso de medición:
 * sin la entrada con cupón no se sabe quién es la persona, así que simplemente no se mide (el permiso por defecto solo lo da
 * `/superapp/launch`, ver su ruta).
 */
const CLAVE = "cg:superapp";

export function enSuperApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(location.search).get("origen") === "superapp") {
      sessionStorage.setItem(CLAVE, "1");
      return true;
    }
    return sessionStorage.getItem(CLAVE) === "1";
  } catch {
    // Sin almacenamiento (modo privado estricto): vale solo la marca de la dirección.
    return new URLSearchParams(location.search).get("origen") === "superapp";
  }
}
