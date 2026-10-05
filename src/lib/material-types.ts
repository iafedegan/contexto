/** Persona que interviene en una grabación: cómo se llama y qué cargo o papel tiene (opcional). */
export type Participante = { nombre: string; cargo: string };

/** Una intervención de la grabación: quién habla, en qué segundo empieza (si se conoce) y lo que dice, literal. */
export type Segmento = { hablante: string; inicio?: number; texto: string };

/** Etiqueta de una intervención cuyo autor todavía no se ha identificado. */
export const SIN_IDENTIFICAR = "Sin identificar";

/** Material que el periodista carga para redactar: una entrevista transcrita o el texto de uno o más enlaces. */
export type Material = {
  kind: "entrevista" | "enlace";
  title: string;
  text: string;
  url?: string;
  /** Solo entrevistas: las personas que el editor dijo que intervienen. */
  participantes?: Participante[];
  /** Solo entrevistas: si es una conversación de pregunta y respuesta. */
  esEntrevista?: boolean;
  /** Solo entrevistas: la transcripción dividida por intervenciones. `text` se calcula siempre a partir de ellas. */
  segmentos?: Segmento[];
};

/** Segundos → «m:ss» (o «h:mm:ss» si pasa de una hora). */
export function formatoTiempo(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** «m:ss» o «h:mm:ss» → segundos; undefined si el texto no tiene ese formato. */
export function parseTiempo(texto: unknown): number | undefined {
  if (typeof texto !== "string") return undefined;
  const m = texto.trim().match(/^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})(?:[.,]\d+)?$/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Texto de una transcripción dividida: una línea por intervención, «[m:ss] Quién: lo que dijo». */
export function textoDeSegmentos(segmentos: Segmento[]): string {
  return segmentos
    .filter((s) => s.texto.trim())
    .map((s) => `${s.inicio === undefined ? "" : `[${formatoTiempo(s.inicio)}] `}${s.hablante}: ${s.texto.trim()}`)
    .join("\n\n");
}

/** Intervenciones cuyo autor no está identificado: ni «Sin identificar» ni «Hablante N». */
export function sinIdentificar(segmentos: Segmento[] | undefined): number {
  return (segmentos ?? []).filter((s) => s.hablante === SIN_IDENTIFICAR || /^hablante\s*\d+$/i.test(s.hablante.trim())).length;
}

/** Línea con las personas que intervienen, para entregarla al modelo. */
function listaParticipantes(p: Participante[] | undefined): string {
  if (!p?.length) return "";
  return `Participantes: ${p.map((x) => (x.cargo ? `${x.nombre} (${x.cargo})` : x.nombre)).join("; ")}.\n`;
}

/** Convierte el material en el bloque de texto que se entrega al modelo (con límites para no desbordar el contexto). */
export function materialParaPrompt(material: Material[] | undefined, maxTotal = 60_000): string {
  if (!material?.length) return "";
  let resto = maxTotal;
  const partes: string[] = [];
  material.forEach((m, i) => {
    const t = m.text.slice(0, Math.max(0, Math.min(resto, 30_000)));
    resto -= t.length;
    if (!t) return;
    partes.push(
      m.kind === "entrevista"
        ? `[ENTREVISTA ${i + 1}: ${m.title}]\n${listaParticipantes(m.participantes)}` +
            `Transcripción${m.segmentos?.length ? " por intervenciones, «[tiempo] Quién: lo que dijo»" : ""} (úsala como fuente primaria). ` +
            `Reglas para citar: incluye varias citas textuales de los fragmentos más relevantes, entre comillas y exactamente como aparecen aquí; ` +
            `atribuye cada cita a quien la dijo, con su nombre y cargo cuando se conozcan; ` +
            `no atribuyas ninguna cita a «${SIN_IDENTIFICAR}» ni a «Hablante N» (si hace falta, di que una voz no identificada lo afirmó); ` +
            `no inventes ni recortes palabras dentro de una cita.` +
            (m.esEntrevista ? ` Es una entrevista: respeta quién pregunta y quién responde, y no mezcles las respuestas de una persona con las de otra.` : "") +
            `\n${t}`
        : `[ENLACE ${i + 1}: ${m.title}${m.url ? ` — ${m.url}` : ""}]\nTexto de la fuente (no lo copies: redacta con palabras propias y atribúyelo):\n${t}`,
    );
  });
  return partes.join("\n\n");
}
