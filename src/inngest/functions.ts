import { inngest } from "./client";
import { syncArchiveIndex } from "@/lib/archive-client";
import { generateDraft } from "@/agents/draft-generator";

/**
 * Sincronización del archivo histórico (solo lectura). La carga completa no cabe en una ejecución: cada paso avanza
 * lo que cabe en 4 minutos, guarda el cursor y el siguiente paso sigue ahí hasta terminar (ver `archive-client.ts`).
 */
export const syncArchive = inngest.createFunction(
  {
    id: "sync-archive-index",
    concurrency: 1,
    triggers: [{ cron: "0 */6 * * *" }, { event: "archive/sync.requested" }],
  },
  async ({ event, step }) => {
    const full = event.name === "archive/sync.requested" && event.data?.full === true;
    let ultimo: Awaited<ReturnType<typeof syncArchiveIndex>> | null = null;
    // Tope de pasos: 41.000 notas son unas 410 páginas; 200 pasos de 4 min sobran con holgura.
    for (let i = 0; i < 200; i++) {
      ultimo = await step.run(`avance-${i}`, () => syncArchiveIndex({ full }));
      if (ultimo.completa || ultimo.ocupada) break;
    }
    return ultimo;
  },
);

/** Generación de borradores editoriales desde fuentes estructuradas. */
export const draftFromSource = inngest.createFunction(
  {
    id: "agent-draft-from-source",
    concurrency: 2,
    triggers: [{ event: "agent/draft.requested" }],
  },
  async ({ event }) => {
    return generateDraft({
      kind: event.data.kind,
      ref: event.data.ref,
      payload: event.data.payload,
      rawText: event.data.rawText,
    });
  },
);

// Funciones en segundo plano que se registran en Inngest.
export const functions = [syncArchive, draftFromSource];
