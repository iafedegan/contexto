/**
 * Las etapas por las que pasa una nota, para el tablero de «Artículos». Regla pura, sin servidor ni base, para poder probarla.
 */
export type Etapa = "redactor" | "disenador" | "editor" | "programadas" | "publicadas";

export const ETAPAS: { id: Etapa; titulo: string; ayuda: string }[] = [
  { id: "redactor", titulo: "Con el redactor", ayuda: "Borradores que se están escribiendo" },
  { id: "disenador", titulo: "Con el diseñador", ayuda: "Esperan la imagen de portada" },
  { id: "editor", titulo: "Con el editor", ayuda: "En revisión o enviadas a un editor" },
  { id: "programadas", titulo: "Programadas", ayuda: "Listas, con fecha de salida" },
  { id: "publicadas", titulo: "Publicadas", ayuda: "Salieron en los últimos días" },
];

/**
 * En qué etapa está una nota. Una imagen pedida al diseñador que sigue pendiente manda sobre lo demás (la nota espera ahí); un borrador
 * enviado a un editor cuenta como «con el editor» aunque todavía no esté en revisión.
 */
export function etapaDeNota(n: { estado: string; imagenPendiente: boolean; paraEditor: boolean }): Etapa {
  if (n.estado === "publicado") return "publicadas";
  if (n.estado === "programado") return "programadas";
  if (n.imagenPendiente) return "disenador";
  if (n.estado === "en_revision" || n.paraEditor) return "editor";
  return "redactor";
}
