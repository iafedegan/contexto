"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import { Check, Loader2, ShieldCheck, ShieldOff, TriangleAlert } from "lucide-react";
import {
  confirmarMfa,
  desactivarMfa,
  iniciarMfa,
  type MfaSetup,
  type MfaState,
} from "@/app/panel/(app)/configuracion/mfa-actions";

/**
 * Alta guiada del segundo factor (TDR §10).
 *
 * El QR se pide bajo demanda: generar un secreto en cada carga de la pantalla
 * dejaría secretos huérfanos por todas partes y no aporta nada.
 */
export function MfaForm({ activo }: { activo: boolean }) {
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [cargando, iniciar] = useTransition();
  const [alta, accionAlta, pendienteAlta] = useActionState<MfaState, FormData>(confirmarMfa, null);
  const [baja, accionBaja, pendienteBaja] = useActionState<MfaState, FormData>(desactivarMfa, null);

  // Se considera activo si la cuenta ya lo tenía o si acaba de activarse en
  // esta pantalla; y deja de estarlo en cuanto la baja confirma.
  const estaActivo = (activo || alta?.ok === true) && baja?.ok !== true;

  if (estaActivo) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--accent-2)]/40 bg-[var(--surface-2)] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-2)]">
          <ShieldCheck size={15} /> Verificación en dos pasos activa
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--fg-muted)]">
          Al entrar te pedimos el código de seis dígitos de tu aplicación de autenticación.
        </p>

        <form action={accionBaja} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              Código actual
            </span>
            <input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="lx-mono w-28 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm tracking-[0.3em] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <button
            type="submit"
            disabled={pendienteBaja}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-xs font-medium transition hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-60"
          >
            {pendienteBaja ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />}
            Desactivar
          </button>
          <Aviso estado={baja} />
        </form>
      </div>
    );
  }

  const paso = !setup ? 1 : 2;
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck size={15} className="text-[var(--accent)]" /> Verificación en dos pasos
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--fg-muted)]">
        Además de tu contraseña, el panel te pide un código de 6 dígitos que cambia cada 30 segundos. Son tres pasos y toma unos dos minutos.
      </p>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Pasos">
        {["Instala la aplicación", "Escanea el código", "Escribe los 6 dígitos"].map((t, i) => (
          <li
            key={t}
            aria-current={i + 1 === paso ? "step" : undefined}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${i + 1 === paso || (setup && i + 1 === 3) ? "border-[var(--accent)] bg-[var(--surface-2)] font-semibold" : "border-[var(--border)] text-[var(--fg-muted)]"}`}
          >
            <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${i + 1 <= paso || (setup && i + 1 === 3) ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--surface-2)]"}`}>{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>

      {!setup ? (
        <div className="mt-5">
          <p className="text-sm font-semibold">Paso 1 · Instala una aplicación de autenticación en tu celular</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">Si ya tienes una, salta al botón de abajo. Estas son gratis y sirven igual:</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { n: "Google Authenticator", d: "La más usada. Android y iPhone.", u: "https://support.google.com/accounts/answer/1066447" },
              { n: "Microsoft Authenticator", d: "Android y iPhone.", u: "https://www.microsoft.com/security/mobile-authenticator-app" },
              { n: "Authy", d: "Guarda copia si cambias de celular.", u: "https://authy.com/download/" },
            ].map((a) => (
              <li key={a.n} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-semibold">{a.n}</p>
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{a.d}</p>
                <a href={a.u} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-xs font-semibold text-[var(--accent)] hover:underline">
                  Cómo instalarla →
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={cargando}
            onClick={() => iniciar(async () => setSetup(await iniciarMfa()))}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
          >
            {cargando && <Loader2 size={14} className="animate-spin" />}
            Ya la tengo, mostrar el código QR
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr]">
          <div>
            <p className="text-sm font-semibold">Paso 2 · Escanea este código</p>
            <p className="mt-1 max-w-[15rem] text-xs leading-relaxed text-[var(--fg-muted)]">
              Abre la aplicación, toca <strong>«+»</strong> o <strong>«Agregar cuenta»</strong> y apunta la cámara aquí.
            </p>
            <Image
              src={setup.qr}
              alt="Código QR para la aplicación de autenticación"
              width={190}
              height={190}
              unoptimized
              className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-white p-1.5"
            />
            <details className="mt-2 max-w-[15rem] text-xs text-[var(--fg-muted)]">
              <summary className="cursor-pointer font-medium text-[var(--accent)]">¿No puedes escanear? Escribe la clave</summary>
              <code className="lx-mono mt-1.5 block break-all rounded-[var(--radius)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs text-[var(--fg)]">{setup.secret}</code>
            </details>
          </div>

          <form action={accionAlta} className="flex flex-col gap-3">
            <input type="hidden" name="secret" value={setup.secret} />
            <div>
              <p className="text-sm font-semibold">Paso 3 · Escribe el código que te muestra la aplicación</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
                Son 6 números y cambian cada 30 segundos. Si te dice que es inválido, espera al siguiente y escríbelo de nuevo.
              </p>
            </div>
            <input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              aria-label="Código de 6 dígitos"
              placeholder="000000"
              className="lx-mono w-44 rounded-[var(--radius)] border-2 border-[var(--border-strong)] bg-[var(--bg-2)] px-3 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-[var(--accent)]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pendienteAlta}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
              >
                {pendienteAlta && <Loader2 size={14} className="animate-spin" />}
                Confirmar y activar
              </button>
              <button type="button" onClick={() => setSetup(null)} className="text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline">
                Volver al paso 1
              </button>
            </div>
            <Aviso estado={alta} />
          </form>
        </div>
      )}
    </div>
  );
}

// Mensaje de resultado del formulario de segundo factor.
function Aviso({ estado }: { estado: MfaState }) {
  if (!estado) return null;
  return (
    <p
      role="status"
      className={`flex items-center gap-1.5 text-xs ${
        estado.ok ? "text-[var(--accent-2)]" : "text-[var(--danger)]"
      }`}
    >
      {estado.ok ? <Check size={13} /> : <TriangleAlert size={13} />}
      {estado.message}
    </p>
  );
}
