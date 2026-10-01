import type { ZoneStyle } from "@/db/schema";

/**
 * Zonas del cuerpo: el contenedor que agrupa varios bloques (p. ej. la lista
 * «Lo último» o la cuadrícula «Lo más reciente»). Se identifican por la
 * posición de su primera tarjeta (`i<N>`, el `data-card-index` de la portada)
 * o, en las secciones, por la nota con la que empiezan (`s-<slug>`). Un ajuste
 * convierte el contenedor en una cuadrícula con las columnas y el espacio
 * elegidos, y por tanto vale para cualquier plantilla.
 */
const KEY = /^(?:i\d{1,3}|s-[\w-]{1,120})$/;
const TPL = /^(?:\d+(?:\.\d+)?fr)(?:\s\d+(?:\.\d+)?fr){0,5}$/;

const clamp = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined;

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
    };
    const clean = Object.fromEntries(Object.entries(z).filter(([, v]) => v !== undefined)) as ZoneStyle;
    if (Object.keys(clean).length) out[key] = clean;
  }
  return out;
}

const target = (key: string) =>
  key.startsWith("i")
    ? `:has(> [data-card-index="${key.slice(1)}"])`
    : `:has(> [data-bs-root="${key.slice(2)}"],> [data-bslug="${key.slice(2)}"])`;

/** Hoja CSS de las zonas. Cadena vacía si no hay ninguna. */
export function zonesCss(input: unknown, scope = "[data-site-root]"): string {
  const zones = sanitizeZones(input);
  const rules: string[] = [];
  for (const [key, z] of Object.entries(zones)) {
    if (z.cols === undefined && z.tpl === undefined && z.gap === undefined) continue;
    const sel = `${scope} ${target(key)}`;
    const cols = z.tpl ? z.tpl.split(" ").map((c) => `minmax(0,${c})`).join(" ") : `repeat(${z.cols ?? 1},minmax(0,1fr))`;
    rules.push(`${sel}{display:grid!important;grid-template-columns:${cols}!important;${z.gap !== undefined ? `gap:${z.gap}px!important;` : ""}}`);
    rules.push(`${sel}>:not([data-card-index]):not([data-bs-root]):not([data-bslug]):not(.cg-handle){grid-column:1/-1!important}`);
    rules.push(`@media(max-width:640px){${sel}{grid-template-columns:minmax(0,1fr)!important}}`);
  }
  return rules.join("\n");
}
