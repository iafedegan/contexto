import type { ZoneStyle } from "@/db/schema";
import { acotar as clamp } from "@/lib/validate";

/**
 * Zonas del cuerpo: el contenedor que agrupa varios bloques (p. ej. la lista
 * «Lo último» o la cuadrícula «Lo más reciente»). Se identifican por la
 * posición de su primera tarjeta (`i<N>`, el `data-card-index` de la portada)
 * o, en las secciones, por la nota con la que empiezan (`s-<slug>`). Un ajuste
 * convierte el contenedor en una cuadrícula con las columnas y el espacio
 * elegidos, y por tanto vale para cualquier plantilla.
 */
const KEY = /^(?:i\d{1,3}|s-[\w-]{1,120})(?:u[0-3])?$/;
// Formato válido de columnas personalizadas, por ejemplo «2fr 1fr».
const TPL = /^(?:\d+(?:\.\d+)?fr)(?:\s\d+(?:\.\d+)?fr){0,5}$/;

// Valida los estilos de las zonas del cuerpo antes de guardarlos o pintarlos.
export function sanitizeZones(input: unknown): Record<string, ZoneStyle> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, ZoneStyle> = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!KEY.test(key) || !raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const z: ZoneStyle = {
      cols: clamp(r.cols, 1, 6),
      tpl: typeof r.tpl === "string" && TPL.test(r.tpl.trim()) ? r.tpl.trim() : undefined,
      gap: clamp(r.gap, 0, 80),
      flat: r.flat === true ? true : undefined,
    };
    const clean = Object.fromEntries(Object.entries(z).filter(([, v]) => v !== undefined)) as ZoneStyle;
    if (Object.keys(clean).length) out[key] = clean;
  }
  return out;
}

/**
 * Selector del contenedor de una zona. `i3u1` = el contenedor cuyo primer
 * bloque es la tarjeta 3, situada un nivel por debajo de un grupo intermedio.
 */
function target(key: string): string {
  const m = /^(i\d+|s-[\w-]+?)(?:u([0-3]))?$/.exec(key);
  if (!m) return ":not(*)";
  const depth = Number(m[2] ?? 0);
  const ref = m[1].startsWith("i") ? `[data-card-index="${m[1].slice(1)}"]` : `[data-bs-root="${m[1].slice(2)}"],[data-bslug="${m[1].slice(2)}"]`;
  let inner = `> ${ref}`;
  for (let i = 0; i < depth; i++) inner = `> :has(${inner})`;
  return `:has(${inner})`;
}

/** Hoja CSS de las zonas. Cadena vacía si no hay ninguna. */
export function zonesCss(input: unknown, scope = "[data-site-root]"): string {
  const zones = sanitizeZones(input);
  const rules: string[] = [];
  for (const [key, z] of Object.entries(zones)) {
    if (z.cols === undefined && z.tpl === undefined && z.gap === undefined && !z.flat) continue;
    const sel = `${scope} ${target(key)}`;
    const cols = z.tpl ? z.tpl.split(" ").map((c) => `minmax(0,${c})`).join(" ") : `repeat(${z.cols ?? 1},minmax(0,1fr))`;
    rules.push(`${sel}{display:grid!important;grid-template-columns:${cols}!important;${z.gap !== undefined ? `gap:${z.gap}px!important;` : ""}}`);
    rules.push(`${sel}>:not([data-card-index]):not([data-bs-root]):not([data-bslug]):not(.cg-handle){grid-column:1/-1!important}`);
    if (z.flat) {
      // Los grupos intermedios desaparecen del diseño (display:contents): sus bloques
      // pasan a ser celdas de esta cuadrícula y se pueden colocar uno a uno.
      const nb = ":not([data-card-index]):not([data-bslug]):not([data-bs-root])";
      const has = ":has([data-card-index],[data-bslug],[data-bs-root])";
      let level = `${sel}>${nb}${has}`;
      for (let i = 0; i < 3; i++) {
        rules.push(`${level}{display:contents!important}`);
        rules.push(`${level}>${nb}:not(:has([data-card-index],[data-bslug],[data-bs-root])):not(.cg-handle){grid-column:1/-1!important}`);
        level = `${level}>${nb}${has}`;
      }
    }
    rules.push(`@media(max-width:640px){${sel}{grid-template-columns:minmax(0,1fr)!important}}`);
  }
  return rules.join("\n");
}
