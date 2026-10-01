"use client";

import { useMemo, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Frame, PREVIEW_STORAGE_KEY, type Props, type SitePreviewChrome } from "@/components/panel/site-article-preview";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const read = () => {
  try {
    return localStorage.getItem(PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Pestaña de vista previa del artículo: la nota del asistente a pantalla completa. */
export function ArticlePreviewTab({ chrome }: { chrome: SitePreviewChrome }) {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const data = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Omit<Props, "chrome">;
    } catch {
      return null;
    }
  }, [raw]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      <div
        data-theme="panel-ui"
        className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-4 text-[var(--fg)] shadow-md"
      >
        <span className="rounded-full bg-[#b45309] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
          Vista previa
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-[var(--fg-muted)]">
          Así se verá la nota en el sitio. Se actualiza mientras el asistente siga en el paso «Vista previa».
        </p>
        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--accent)]"
        >
          <X size={13} /> Cerrar
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {data ? (
          <Frame chrome={chrome} {...data} />
        ) : (
          <p className="p-8 text-sm text-[var(--fg-muted)]">
            No hay una nota para mostrar. Abre esta vista desde el paso «Vista previa» del asistente.
          </p>
        )}
      </div>
    </div>
  );
}
