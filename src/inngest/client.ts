import { Inngest } from "inngest";

/**
 * Trabajos asíncronos. Corren en un entorno separado del portal: ninguna tarea
 * larga (indexación del archivo, agentes editoriales, correo) afecta el tiempo
 * de respuesta de las rutas de lectura.
 */
export const inngest = new Inngest({ id: "contexto-ganadero" });

export type Events = {
  "archive/sync.requested": { data: { full?: boolean } };
  "agent/draft.requested": {
    data: {
      kind: "boletin_precios" | "comunicado" | "convocatoria" | "agenda_ferias" | "otro";
      ref: string;
      payload: Record<string, unknown>;
      rawText: string;
    };
  };
};
