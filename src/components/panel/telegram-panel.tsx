"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { codigoTelegram, conectarTelegram, desvincularTelegram, estadoTelegram, type EstadoTelegram } from "@/app/panel/(app)/configuracion/telegram-actions";

/** Configuración → Telegram: conectar el bot (administrador), vincular tu Telegram y ver quién está vinculado. */
export function TelegramPanel({ esAdmin }: { esAdmin: boolean }) {
  const [est, setEst] = useState<EstadoTelegram | null>(null);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pend, start] = useTransition();

  const cargar = () => estadoTelegram().then(setEst).catch(() => setEst(null));
  useEffect(() => {
    let vivo = true;
    void estadoTelegram().then((e) => vivo && setEst(e)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
        Redacta desde Telegram: le mandas el contexto de la noticia (texto, nota de voz o enlaces) y el bot recorre el mismo paso a paso del asistente —títulos, borrador, resumen, palabras clave, sección, cuerpo, gráfica, portada y SEO— y deja todo guardado como borrador aquí. Nada se publica sin que confirmes con un botón.
      </p>

      {esAdmin && (
        <div className="rounded-[var(--radius)] border border-[var(--border)] p-4">
          <p className="text-sm font-semibold">1 · Conectar el bot</p>
          <ol className="mt-1 list-decimal pl-5 text-xs leading-relaxed text-[var(--fg-muted)]">
            <li>En Telegram abre <strong>@BotFather</strong>, envía <code>/newbot</code>, elige nombre y usuario.</li>
            <li>Copia el <strong>token</strong> que te entrega y pégalo aquí.</li>
          </ol>
          {est?.token ? (
            <p className="mt-2 text-sm">
              ✅ Bot conectado{est.bot ? <> como <strong>@{est.bot}</strong></> : null} (token desde {est.origen}).{" "}
              {est.webhook ? <span className="text-[var(--fg-muted)]">Webhook activo.</span> : <span className="text-[#b45309]">Webhook sin registrar: pega el token y pulsa «Conectar» para registrarlo.</span>}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#b45309]">Aún no hay bot conectado.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" placeholder="123456789:AAH…" className="lx-input min-w-0 flex-1 py-2 text-sm" />
            <button
              type="button"
              disabled={pend || token.trim().length < 20}
              className="lx-btn"
              onClick={() =>
                start(async () => {
                  const r = await conectarTelegram(token);
                  setMsg(r.ok ? `✅ Conectado: @${r.bot}. Webhook registrado.` : r.error);
                  if (r.ok) setToken("");
                  void cargar();
                })
              }
            >
              {pend ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Conectar
            </button>
          </div>
          {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
        </div>
      )}

      <div className="rounded-[var(--radius)] border border-[var(--border)] p-4">
        <p className="text-sm font-semibold">{esAdmin ? "2 · " : ""}Vincular mi Telegram</p>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          Genera un código y envíaselo al bot desde tu Telegram: <code>/vincular CÓDIGO</code>. Vale 10 minutos. Las notas que crees por Telegram quedan firmadas con tu usuario.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="lx-btn" disabled={pend || !est?.token} onClick={() => start(async () => setCodigo(await codigoTelegram()))}>
            Generar código
          </button>
          {codigo && <span className="rounded-lg bg-[var(--surface-2)] px-4 py-2 font-mono text-xl font-bold tracking-[0.3em]">{codigo}</span>}
          {!est?.token && <span className="text-xs text-[var(--fg-muted)]">Un administrador debe conectar el bot primero.</span>}
        </div>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--border)] p-4">
        <p className="text-sm font-semibold">Telegram vinculados</p>
        {!est?.vinculos.length ? (
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Todavía no hay ninguno.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {est.vinculos.map((v) => (
              <li key={v.chatId} className="flex items-center gap-3">
                <span className="font-medium">{v.nombre || `Chat ${v.chatId}`}{v.mio ? " (tú)" : ""}</span>
                <span className="text-xs text-[var(--fg-muted)]">desde {new Date(v.desde).toLocaleDateString("es-CO")}</span>
                <button type="button" className="lx-link ml-auto text-xs" onClick={() => start(async () => { await desvincularTelegram(v.chatId); await cargar(); })}>Desvincular</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
