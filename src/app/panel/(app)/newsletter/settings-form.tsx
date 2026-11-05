"use client";

import { useState, useTransition } from "react";
import { deleteGmailCredentials, deleteResendKey, saveGmailCredentials, saveNewsletterSettings, saveResendKey } from "./actions";
import type { NewsletterSettings } from "@/lib/newsletter/types";

// Estado del proveedor de correo.
type Provider = { configured: boolean; source: string | null; masked: string | null; dryRun: boolean; tipo?: "resend" | "gmail" | null; gmail?: { configured: boolean; source: string | null; clientId: string | null } };

// Formulario de ajustes del boletín (remitente, textos y color) y de la clave del proveedor de correo.
export function SettingsForm({ settings, provider, canManage }: { settings: NewsletterSettings; provider: Provider; canManage: boolean }) {
  const [s, setS] = useState(settings);
  const [key, setKey] = useState("");
  const [g, setG] = useState({ clientId: "", clientSecret: "", refreshToken: "" });
  const [msgG, setMsgG] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  // Actualiza un campo del formulario al escribir.
  const set = (k: Exclude<keyof NewsletterSettings, "design">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value });
  // Campo de texto del formulario.
  const field = (label: string, k: Exclude<keyof NewsletterSettings, "design">, type = "text") => (
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
          Estado: <strong>{provider.tipo === "resend" ? `conectado (${provider.source}) ${provider.masked ?? ""}` : provider.dryRun ? "modo prueba (no envía)" : "sin conectar"}</strong>
          {provider.tipo === "gmail" && <span className="text-[var(--fg-muted)]"> · los correos salen por Gmail</span>}
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

      {/* Alternativa a Resend: enviar como la cuenta de Gmail / Google Workspace (p. ej. info@…) con la API de Gmail. Si hay clave de Resend, manda Resend. */}
      <section className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4 lg:col-span-2">
        <h2 className="font-semibold">Gmail (Google Cloud)</h2>
        <p className="text-sm">
          Estado: <strong>{provider.gmail?.configured ? `conectado (${provider.gmail.source}) · cliente ${provider.gmail.clientId}` : "sin conectar"}</strong>
          {provider.gmail?.configured && provider.tipo === "resend" && <span className="text-[var(--fg-muted)]"> · hay clave de Resend, así que se usa Resend</span>}
        </p>
        <ol className="list-decimal pl-5 text-sm text-[var(--fg-muted)]">
          <li>En console.cloud.google.com: un proyecto con la API de Gmail habilitada y la pantalla de consentimiento «Interno».</li>
          <li>Un cliente de OAuth «Aplicación web» con el redireccionamiento https://developers.google.com/oauthplayground.</li>
          <li>En el OAuth Playground (con tus credenciales), autoriza el permiso gmail.send con la cuenta que envía y copia el refresh token.</li>
          <li>Pega los tres datos aquí. El «Correo remitente» de arriba debe ser esa misma cuenta. Límite: ~2.000 correos al día.</li>
        </ol>
        {canManage && provider.gmail?.source !== "entorno" && (
          <>
            <div className="grid gap-2 md:grid-cols-3">
              <input className="lx-input" placeholder="ID de cliente (…apps.googleusercontent.com)" value={g.clientId} onChange={(e) => setG({ ...g, clientId: e.target.value })} autoComplete="off" />
              <input className="lx-input" type="password" placeholder="Secreto de cliente (GOCSPX-…)" value={g.clientSecret} onChange={(e) => setG({ ...g, clientSecret: e.target.value })} autoComplete="off" />
              <input className="lx-input" type="password" placeholder="Refresh token (1//…)" value={g.refreshToken} onChange={(e) => setG({ ...g, refreshToken: e.target.value })} autoComplete="off" />
            </div>
            <div className="flex gap-3">
              <button className="lx-btn" disabled={pending || !g.clientId || !g.clientSecret || !g.refreshToken} onClick={() => start(async () => { const r = await saveGmailCredentials(g); setMsgG(r.message); if (r.ok) setG({ clientId: "", clientSecret: "", refreshToken: "" }); })}>Probar y guardar</button>
              {provider.gmail?.source === "panel" && <button className="lx-btn-ghost" disabled={pending} onClick={() => start(async () => { await deleteGmailCredentials(); setMsgG("Gmail desconectado"); })}>Desconectar Gmail</button>}
            </div>
          </>
        )}
        {msgG && <p className="text-sm text-[var(--accent)]">{msgG}</p>}
      </section>
    </div>
  );
}
