"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { createApiClient, deleteApiClient, toggleApiClient } from "./actions";

// Clave de API tal como se lista en el panel.
type Client = {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  requestsPerHour: number;
  lastUsedAt: string;
  createdAt: string;
};

/**
 * La clave completa solo existe un momento: la devuelve `createApiClient` y
 * se guarda en este estado del cliente hasta que la página se recarga o se
 * navega fuera. Después, solo queda el prefijo (`cg_live_a1b2c3d4…`).
 */
export function ApiKeysManager({ clients, canManage }: { clients: Client[]; canManage: boolean }) {
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  // Crea una clave y la muestra una sola vez.
  async function crear() {
    const r = await createApiClient(name);
    setMsg(r.message);
    if (r.ok && r.key) {
      setRevealed({ name: name.trim(), key: r.key });
      setName("");
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {revealed && (
        <div className="rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent)]/5 p-4">
          <p className="text-sm font-semibold">Clave de «{revealed.name}» creada</p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">Cópiala ahora. Por seguridad no se volverá a mostrar completa.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-[var(--bg-2)] px-3 py-2 text-xs">{revealed.key}</code>
            <button
              className="lx-btn-ghost shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(revealed.key);
                setCopied(true);
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <button className="mt-3 text-xs underline" onClick={() => setRevealed(null)}>
            Ya la copié
          </button>
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius)] border border-[var(--border)] p-4">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Nueva clave para…
            <input className="lx-input" placeholder="p. ej. app aliada de mercados, portal del gremio…" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <button className="lx-btn" disabled={pending || !name.trim()} onClick={() => start(crear)}>
            <KeyRound size={15} className="mr-1.5 inline" /> Generar clave
          </button>
        </div>
      )}
      {msg && !revealed && <p className="text-sm text-[var(--accent)]">{msg}</p>}

      {clients.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">Todavía no hay claves emitidas.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
          {clients.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="mt-0.5 font-mono text-xs text-[var(--fg-muted)]">{c.keyPrefix}…</p>
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                  {c.requestsPerHour} peticiones/hora · último uso: {c.lastUsedAt} · creada: {c.createdAt}
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs ${c.active ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-[var(--border)] text-[var(--fg-muted)]"}`}>
                    {c.active ? "Activa" : "Revocada"}
                  </span>
                  <button className="lx-btn-ghost" disabled={pending} onClick={() => start(async () => toggleApiClient(c.id, !c.active))}>
                    {c.active ? "Revocar" : "Reactivar"}
                  </button>
                  <button className="lx-btn-ghost text-red-600" disabled={pending} onClick={() => { if (confirm(`¿Eliminar la clave de «${c.name}»?`)) start(async () => deleteApiClient(c.id)); }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
