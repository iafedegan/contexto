/**
 * Etiquetas en español de los estados editoriales de una nota. Las usan el listado, el editor clásico y el asistente
 * paso a paso; antes cada uno tenía su propia copia. Sin `server-only`: sirven en el servidor y en el navegador.
 */
export const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};
