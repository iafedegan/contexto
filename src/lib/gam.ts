/**
 * Google Ad Manager (GPT) del sitio anterior: la red y las unidades publicitarias que ya usaba contextoganadero.com
 * (`/22847726224/<sección>_b1…b7`), para que las campañas contratadas sigan saliendo sin tocarlas en Ad Manager.
 * Se activa con `NEXT_PUBLIC_GAM_ENABLED=1` (el día del cambio de dominio); la red se puede cambiar con `NEXT_PUBLIC_GAM_NETWORK`.
 * Sin «server-only»: lo usan el servidor (qué posición pintar) y el navegador (qué sección es).
 */
export const GAM_RED = process.env.NEXT_PUBLIC_GAM_NETWORK ?? "22847726224";

/**
 * Prefijo de Ad Manager de cada sección y subsección (las unidades son por sección principal: una nota de «Regiones» usa las de
 * «Colombia», como en el sitio anterior). Incluye los slugs del árbol actual y los antiguos que aún salen en las direcciones de las notas.
 */
const SECCION_GAM: Record<string, string> = {
  agenda: "agenda", congresos: "agenda", ferias: "agenda", tauromaquia: "agenda", "otros-eventos": "agenda", otroseventos: "agenda",
  colombia: "colombia", gremialidad: "colombia", politica: "colombia", regiones: "colombia", seguridad: "colombia",
  economia: "economia", agroindustria: "economia", internacional: "economia", nacional: "economia", "precio-del-ganado": "economia", agricultura: "economia",
  especiales: "especiales", cronica: "especiales", galeria: "especiales", "gobierno-petro": "especiales", informes: "especiales", reportaje: "especiales", entrevistas: "especiales",
  ganaderia: "ganaderia", nutricion: "ganaderia", produccion: "ganaderia", razas: "ganaderia", "salud-animal": "ganaderia", saludanimal: "ganaderia",
  "sistemas-silvopastoriles": "ganaderia", sostenible: "ganaderia", "ganaderia-sostenible": "ganaderia",
  mundo: "mundo", argentina: "mundo", "centro-america": "mundo", eeuu: "mundo", espana: "mundo", europa: "mundo", mexico: "mundo",
  "norte-america": "mundo", "otros-mundo": "mundo", otrosmundo: "mundo", peru: "mundo", "sur-america": "mundo",
  opinion: "opinion", blogs: "opinion", columnas: "opinion", columnistas: "opinion", editorial: "opinion", columna: "opinion",
  "sistemas-pecuarios": "sistemas_pecuarios", avicola: "sistemas_pecuarios", equino: "sistemas_pecuarios", porcicola: "sistemas_pecuarios",
  "ovino-caprino": "sistemas_pecuarios", ovinocaprino: "sistemas_pecuarios", "otros-sistemas-pecuarios": "sistemas_pecuarios", otrossistemP: "sistemas_pecuarios",
  tendencias: "tendencias", deportes: "tendencias", gastronomia: "tendencias", innovacion: "tendencias", mascotas: "tendencias",
  medioambiente: "tendencias", "redes-sociales": "tendencias", redessociales: "tendencias",
};

/** Prefijo de las unidades para una dirección: `home`, el de la sección o `null` si esa página no tiene unidades. */
export function prefijoGam(pathname: string): string | null {
  const partes = pathname.split("/").filter(Boolean);
  if (partes[0] === "en") partes.shift();
  if (partes.length === 0) return "home";
  const seccion = partes[0] === "categoria" ? partes[1] : partes[0];
  return (seccion && Object.hasOwn(SECCION_GAM, seccion) && SECCION_GAM[seccion]) || null;
}

export type UnidadGam = "b1" | "b2" | "b3" | "b5" | "b6" | "caja";

/** Tamaños que acepta cada unidad (los mismos del sitio anterior). */
export const TAMANOS_GAM: Record<UnidadGam, number[][]> = {
  b1: [[300, 100], [300, 250], [300, 600]],
  b2: [[300, 100], [300, 250], [300, 600]],
  b3: [[300, 100], [300, 250], [300, 600]],
  b5: [[970, 90], [650, 60], [728, 90]],
  b6: [[970, 90], [650, 60], [728, 90]],
  caja: [[336, 280]],
};

/** Alto reservado (px) para que el anuncio no mueva la página al llegar. */
export const ALTO_GAM: Record<UnidadGam, number> = { b1: 250, b2: 250, b3: 250, b5: 90, b6: 90, caja: 280 };

/** Nombre de la unidad: la caja de 336×280 es `b4` en la portada y `b7` en las secciones. */
export const nombreUnidadGam = (prefijo: string, u: UnidadGam) => `${prefijo}_${u === "caja" ? (prefijo === "home" ? "b4" : "b7") : u}`;

/** Qué unidad usa cada posición del sitio (el pie no tiene: repetiría la de abajo). */
export const GAM_POR_POSICION: Record<string, UnidadGam | undefined> = {
  home_top: "b5",
  home_billboard: "caja",
  home_bottom: "b6",
  sidebar_top: "b1",
  sidebar_sticky: "b2",
  sidebar_bottom: "b3",
  article_top: "b5",
  article_sidebar: "caja",
  section_top: "b5",
  section_bottom: "b6",
};
