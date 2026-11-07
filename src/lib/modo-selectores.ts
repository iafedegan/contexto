/** Selectores CSS «cuando el sitio se ve en modo claro / oscuro» (los usan los colores de cada parte, el menú y las piezas). */
// Plantillas que, sin preferencia del lector, se ven oscuras (las mismas que el interruptor de modo del sitio).
const PLANTILLAS_OSCURAS = ["home", "esmeralda", "revista", "vanguardia"];

/**
 * Selectores de un componente cuando el sitio se VE en un modo: el elegido por el lector (`html[data-dark]`) o, si no eligió,
 * el propio de la plantilla. Llevan más peso que la regla base, así que mandan sobre los colores «de los dos modos».
 */
export export function selectoresDeModo(modo: "claro" | "oscuro", scope: string, id: string | null, sufijo = ""): string {
  // `id` nulo = la raíz del sitio (el lienzo de toda la página), para el fondo del cuerpo.
  const comp = `${id ? ` [data-region="${id}"]` : ""}${sufijo}`;
  const nativas = PLANTILLAS_OSCURAS.map((t) => `[data-theme="${t}"]`).join(",");
  return modo === "oscuro"
    ? `html[data-dark="1"] ${scope}${comp},html:not([data-dark]) ${scope}:is(${nativas})${comp}`
    : `html[data-dark="0"] ${scope}${comp},html:not([data-dark]) ${scope}:not(:is(${nativas}))${comp}`;
}

