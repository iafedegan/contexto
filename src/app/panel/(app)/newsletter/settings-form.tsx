"use client";

import { useState, useTransition } from "react";
import { deleteResendKey, saveNewsletterSettings, saveResendKey } from "./actions";
import type { NewsletterSettings } from "@/lib/newsletter/types";

type Provider = { configured: boolean; source: string | null; masked: string | null; dryRun: boolean };

export function SettingsForm({ settings, provider, canManage }: { settings: NewsletterSettings; provider: Provider; canManage: boolean }) {
  const [s, setS] = useState(settings);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof NewsletterSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value });
  const field = (label: string, k: keyof NewsletterSettings, type = "text") => (
    <label className="flex flex-col gap-1 text-sm">{label}
      <input type={type} className="lx-input" value={s[k]} onChange={set(k)} disabled={!canManage} />
    </label>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4">
        <h2 className="font-semibold">Remitente y diseño</h2>
        {field("Nombre del remitente", "fromName")}
        {field("Correo remitente (dominio verificado)", "fromEmail", "email")}
        {field("Responder a", "replyTo", "email")}
        {field("Prefijo del asunto", "subjectPrefix")}
        {field("Frase bajo el título", "headerTagline")}
        {field("Dirección física", "address")}
        <label className="flex flex-col gap-1 text-sm">Color de acento
          <input type="color" value={s.accentColor} onChange={set("accentColor")} disabled={!canManage} className="h-9 w-20" />
        </label>
        <label className="flex flex-col gap-1 text-sm">Aviso legal (habeas data)
          <textarea rows={4} className="lx-input" value={s.legalText} onChange={set("legalText")} disabled={!canManage} />
        </label>
        {canManage && (
          <button className="lx-btn self-start" disabled={pending} onClick={() => start(async () => setMsg((await saveNewsletterSettings(s)).message))}>Guardar ajustes</button>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4">
        <h2 className="font-semibold">Proveedor de correo (Resend)</h2>
        <p className="text-sm">
          Estado: <strong>{provider.configured ? (provider.dryRun ? "modo prueba (no envía)" : `conectado (${provider.source}) ${provider.masked ?? ""}`) : "sin conectar"}</strong>
        </p>
        <ol className="list-decimal pl-5 text-sm text-[var(--fg-muted)]">
          <li>Crea una cuenta en resend.com.</li>
          <li>Verifica tu dominio (registros DNS) en Domains.</li>
          <li>Crea una API Key y pégala aquí.</li>
        </ol>
        {canManage && provider.source !== "entorno" && (
          <>
            <input className="lx-input" type="password" placeholder="re_…" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
            <div className="flex gap-3">
              <button className="lx-btn" disabled={pending || !key} onClick={() => start(async () => { const r = await saveResendKey(key); setMsg(r.message); if (r.ok) setKey(""); })}>Guardar clave</button>
              {provider.source === "panel" && <button className="lx-btn-ghost" disabled={pending} onClick={() => start(async () => { await deleteResendKey(); setMsg("Clave eliminada"); })}>Quitar clave</button>}
            </div>
          </>
        )}
        {!canManage && <p className="text-xs text-[var(--fg-muted)]">Solo un administrador puede cambiar estos ajustes.</p>}
        {msg && <p className="text-sm text-[var(--accent)]">{msg}</p>}
      </section>
    </div>
  );
}
