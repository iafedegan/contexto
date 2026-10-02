/** Material que el periodista carga para redactar: una entrevista transcrita o el texto de uno o más enlaces. */
export type Material = {
  kind: "entrevista" | "enlace";
  title: string;
  text: string;
  url?: string;
};

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
        ? `[ENTREVISTA ${i + 1}: ${m.title}]\nTranscripción (úsala como fuente primaria; si citas, cita SOLO frases que aparezcan aquí, entre comillas y atribuidas a quien las dijo):\n${t}`
        : `[ENLACE ${i + 1}: ${m.title}${m.url ? ` — ${m.url}` : ""}]\nTexto de la fuente (no lo copies: redacta con palabras propias y atribúyelo):\n${t}`,
    );
  });
  return partes.join("\n\n");
}
