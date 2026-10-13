/**
 * Estilo de escritura de cada persona: las muestras que carga (notas suyas por enlace o pegadas) y el diagnóstico que la IA saca de
 * ellas. Sin `server-only`: lo usa también la pantalla del panel. Lo guardado vive en `site_settings` (clave `estilo_escritura:<id>`).
 */

/** Una muestra de escritura de la persona. `texto` es lo que se le pasa a la IA (recortado). */
export type FuenteEstilo = {
  id: string;
  tipo: "enlace" | "texto";
  titulo: string;
  url?: string;
  texto: string;
  palabras: number;
  en: string;
};

/** Lo que la IA concluye del estilo: pautas de forma, nunca de contenido. */
export type Diagnostico = {
  resumen: string;
  tono: string[];
  voz: string;
  estructura: string;
  ritmo: string;
  vocabulario: string;
  aperturas: string;
  cierres: string;
  fortalezas: string[];
  evitar: string[];
  /** Instrucciones breves y accionables que se agregan al pedirle a la IA que redacte con el estilo de la persona. */
  reglas: string[];
  muestras: number;
  palabras: number;
  generadoEn: string;
};

/** Todo lo guardado de una persona. */
export type EstiloEscritura = { fuentes: FuenteEstilo[]; diagnostico: Diagnostico | null; activo: boolean };

/** Lo que viaja al navegador: sin el texto completo de las muestras. */
export type EstiloVista = {
  fuentes: Omit<FuenteEstilo, "texto">[];
  diagnostico: Diagnostico | null;
  activo: boolean;
};

export const ESTILO_VACIO: EstiloEscritura = { fuentes: [], diagnostico: null, activo: true };

/** Máximo de muestras, tamaño guardado por muestra y mínimos para poder diagnosticar. */
export const ESTILO_LIMITES = { muestras: 15, caracteresPorMuestra: 9_000, minimoMuestras: 3, minimoPalabras: 1_200 } as const;

export const estiloClave = (userId: string) => `estilo_escritura:${userId}`;

/** Cuenta palabras de un texto. */
export const contarPalabras = (t: string) => (t.match(/\S+/g) ?? []).length;

/** Vista segura para el navegador. */
export function aVista(e: EstiloEscritura): EstiloVista {
  return { fuentes: e.fuentes.map(({ texto: _t, ...resto }) => { void _t; return resto; }), diagnostico: e.diagnostico, activo: e.activo };
}

/** Hasta 3 pasajes cortos de las muestras (de muestras distintas) para que la IA «oiga» la voz de la persona y la imite en la forma. */
export function ejemplosDeVoz(fuentes: FuenteEstilo[], max = 3): string[] {
  const out: string[] = [];
  for (const f of fuentes) {
    if (out.length >= max) break;
    const parrafo = f.texto
      .split(/\n{1,}/)
      .map((x) => x.trim())
      .find((x) => x.length >= 220 && x.length <= 650 && !/^https?:/i.test(x));
    if (parrafo) out.push(parrafo);
  }
  return out;
}

/**
 * Bloque que se añade al `system` del modelo cuando la persona tiene un estilo activo. El estilo de la persona PREVALECE sobre el
 * estilo por defecto en todo lo que es forma (tono, voz, ritmo, vocabulario, aperturas, cierres, estructura); lo que no cambia es la
 * veracidad, las fuentes, las cifras y citas, el formato HTML y los mínimos de la ficha SEO. Devuelve "" si no hay diagnóstico o
 * está apagado.
 */
export function bloqueEstilo(e: EstiloEscritura | null | undefined): string {
  const d = e?.diagnostico;
  if (!e || !e.activo || !d) return "";
  const lista = (t: string, xs: string[]) => (xs.length ? `${t}: ${xs.join("; ")}.` : "");
  const ejemplos = ejemplosDeVoz(e.fuentes);
  return [
    "ESTILO DE LA PERSONA QUE FIRMA LA NOTA — es la parte MÁS IMPORTANTE de la forma. Escribe como ella: cada párrafo debe sonar a esta persona y no a un redactor genérico.",
    "Estas pautas PREVALECEN sobre el estilo por defecto de arriba en tono, voz, ritmo de las frases, vocabulario, aperturas, cierres y estructura. NO cambian: la veracidad (solo hechos del material), las fuentes, las cifras y las citas, el formato HTML, ni el mínimo de palabras y de subtítulos de la ficha SEO.",
    `Retrato: ${d.resumen}`,
    lista("Tono", d.tono),
    d.voz && `Voz: ${d.voz}`,
    d.estructura && `Estructura: ${d.estructura}`,
    d.ritmo && `Ritmo de las frases: ${d.ritmo}`,
    d.vocabulario && `Vocabulario: ${d.vocabulario}`,
    d.aperturas && `Cómo abre: ${d.aperturas}`,
    d.cierres && `Cómo cierra: ${d.cierres}`,
    lista("Evita (no lo hace)", d.evitar),
    d.reglas.length ? `Reglas de estilo (síguelas todas):\n${d.reglas.map((r) => `- ${r}`).join("\n")}` : "",
    ejemplos.length
      ? `PASAJES REALES DE SU ESCRITURA (solo para captar la forma: no copies frases ni uses sus hechos):\n${ejemplos.map((x, i) => `(${i + 1}) «${x}»`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
