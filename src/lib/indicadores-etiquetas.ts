import { t, type Locale } from "@/lib/i18n";
import type { EtiquetasIndicadores } from "@/components/indicadores-ganaderos";

// Claves de los textos de la sección de indicadores (`ind.*` en i18n.ts).
const CLAVES = [
  "kicker", "title", "source", "updated", "period", "from", "to", "last6", "last12", "last36", "all", "chart", "lines", "area",
  "bars", "view", "viewChart", "viewTable", "viewBoth", "regions", "month", "export", "noData", "moreFilters", "show", "map",
] as const;

/** Los textos de la sección de indicadores en el idioma de la interfaz (los usan la portada y el Observatorio). */
export function etiquetasIndicadores(locale: Locale): EtiquetasIndicadores {
  return Object.fromEntries(CLAVES.map((k) => [k, t(locale, `ind.${k}`)])) as EtiquetasIndicadores;
}
