"use client";

import { useEffect } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";

// Datos del aviso emergente: mensaje y acción opcional.
export type ToastData = {
  id: number;
  tone: "ok" | "info" | "error";
  text: string;
  /** Acciones a la derecha (p. ej. «Deshacer»). */
  actions?: { label: string; onClick: () => void; href?: string }[];
  /** Milisegundos hasta que se oculta sola (0 = no se oculta). */
  ms?: number;
};

/**
 * Aviso flotante abajo al centro: confirma lo que acaba de pasar (publicado,
 * descartado…) y ofrece deshacerlo. Es el «acuse de recibo» que faltaba.
 */
export function PortadaToast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast || toast.ms === 0) return;
    const id = setTimeout(onClose, toast.ms ?? 8000);
    return () => clearTimeout(id);
  }, [toast, onClose]);

  if (!toast) return null;
  const Icon = toast.tone === "ok" ? Check : toast.tone === "error" ? TriangleAlert : Info;
  return (
    <div
      role="status"
      aria-live="polite"
      data-theme="panel-ui"
      className="fixed bottom-5 left-1/2 z-[300] flex max-w-[min(92vw,38rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--border-strong)] bg-[var(--bg)] py-2 pl-4 pr-2 text-sm text-[var(--fg)] shadow-2xl"
    >
      <Icon size={16} className={toast.tone === "error" ? "shrink-0 text-[#b4442e]" : "shrink-0 text-[#15803d]"} />
      <span className="min-w-0 flex-1 font-medium">{toast.text}</span>
      {toast.actions?.map((a) =>
        a.href ? (
          <a
            key={a.label}
            href={a.href}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {a.label}
          </a>
        ) : (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              a.onClick();
              onClose();
            }}
            className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg)] hover:opacity-90"
          >
            {a.label}
          </button>
        ),
      )}
      <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="shrink-0 rounded-full p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <X size={14} />
      </button>
    </div>
  );
}
