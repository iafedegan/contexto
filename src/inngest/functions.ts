import { inngest } from "./client";
import { syncArchiveIndex } from "@/lib/archive-client";
import { generateDraft } from "@/agents/draft-generator";

/** Sincronización periódica del archivo histórico (solo lectura). */
export const syncArchive = inngest.createFunction(
  {
    id: "sync-archive-index",
    concurrency: 1,
    triggers: [{ cron: "0 */6 * * *" }, { event: "archive/sync.requested" }],
  },
  async ({ event }) => {
    const full = event.name === "archive/sync.requested" && event.data?.full === true;
    const since = full ? null : new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
    return syncArchiveIndex(since);
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

export const functions = [syncArchive, draftFromSource];
