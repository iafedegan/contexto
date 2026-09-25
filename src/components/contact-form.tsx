"use client";

import { useActionState, useEffect, useRef } from "react";
import { Turnstile } from "@/components/turnstile";
import { Check, Loader2, Send, TriangleAlert } from "lucide-react";
import { enviarMensaje, type ContactState } from "@/app/acciones/contacto";
import type { Locale } from "@/lib/i18n";

const COPY = {
  es: {
    tituloContacto: "Escríbenos",
    tituloComercial: "Solicita la tarifa comercial",
    pieContacto: "Los datos se usan solo para responderte. Ver política de privacidad.",
    pieComercial: "Te responderemos con los formatos disponibles y la tarifa vigente.",
    nombre: "Nombre",
    correo: "Correo electrónico",
    organizacion: "Organización (opcional)",
    asunto: "Asunto",
    mensaje: "Mensaje",
    enviar: "Enviar",
    enviando: "Enviando…",
  },
  en: {
    tituloContacto: "Write to us",
    tituloComercial: "Request the rate card",
    pieContacto: "Your data is used only to reply to you. See the privacy policy.",
    pieComercial: "We will reply with the available formats and current rates.",
    nombre: "Name",
    correo: "Email",
    organizacion: "Organisation (optional)",
    asunto: "Subject",
    mensaje: "Message",
    enviar: "Send",
    enviando: "Sending…",
  },
} as const;

/**
 * Formulario público. Sin JavaScript sigue siendo un `<form>` que postea a una
 * Server Action, así que funciona igualmente; el estado solo mejora el aviso.
 */
export function ContactForm({ kind, locale }: { kind: "contacto" | "comercial"; locale: Locale }) {
  const c = COPY[locale];
  const [state, action, pending] = useActionState<ContactState, FormData>(enviarMensaje, null);
  const formRef = useRef<HTMLFormElement>(null);
  const t0Ref = useRef<HTMLInputElement>(null);

  /**
   * La marca de tiempo se escribe en el DOM, no en el estado de React: el HTML
   * se sirve cacheado (ISR) y un valor calculado en el render no coincidiría
   * entre servidor y cliente. El servidor solo comprueba que hayan pasado dos
   * segundos, así que basta con sellarla al montar y tras cada envío.
   */
  useEffect(() => {
    if (t0Ref.current) t0Ref.current.value = String(Date.now());
  }, []);

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    if (t0Ref.current) t0Ref.current.value = String(Date.now());
  }, [state?.ok]);

  return (
    <form
      ref={formRef}
      action={action}
      className="lx-card p-6 sm:p-8"
      aria-labelledby={`form-${kind}`}
    >
      <h2 id={`form-${kind}`} className="lx-display text-2xl">
        {kind === "comercial" ? c.tituloComercial : c.tituloContacto}
      </h2>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        {kind === "comercial" ? c.pieComercial : c.pieContacto}
      </p>

      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="locale" value={locale} />
      <input ref={t0Ref} type="hidden" name="t0" defaultValue="0" />

      {/* Campo trampa: oculto para personas, visible para bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta={c.nombre}>
          <input name="name" required maxLength={120} autoComplete="name" className={INPUT} />
        </Campo>
        <Campo etiqueta={c.correo}>
          <input name="email" type="email" required maxLength={160} autoComplete="email" className={INPUT} />
        </Campo>
        <Campo etiqueta={c.organizacion}>
          <input name="organization" maxLength={160} autoComplete="organization" className={INPUT} />
        </Campo>
        <Campo etiqueta={c.asunto}>
          <input name="subject" maxLength={160} className={INPUT} />
        </Campo>
        <div className="sm:col-span-2">
          <Campo etiqueta={c.mensaje}>
            <textarea name="message" required rows={5} maxLength={4000} className={`${INPUT} resize-y`} />
          </Campo>
        </div>
      </div>

      <Turnstile className="mt-6" />
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {pending ? c.enviando : c.enviar}
        </button>

        {state && (
          <p
            role="status"
            className={`flex items-center gap-2 text-sm ${
              state.ok ? "text-[var(--accent-2)]" : "text-[var(--danger)]"
            }`}
          >
            {state.ok ? <Check size={15} /> : <TriangleAlert size={15} />}
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

const INPUT =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-[0.95rem] outline-none transition focus:border-[var(--accent)]";

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="lx-kicker text-[var(--fg-muted)]">{etiqueta}</span>
      {children}
    </label>
  );
}
