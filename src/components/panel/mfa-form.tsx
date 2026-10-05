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

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck size={15} className="text-[var(--accent)]" /> Verificación en dos pasos
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--fg-muted)]">
        Añade un código temporal además de la contraseña. Funciona con Google Authenticator, 1Password,
        Authy o cualquier aplicación TOTP.
      </p>

      {!setup ? (
        <button
          type="button"
          disabled={cargando}
          onClick={() => iniciar(async () => setSetup(await iniciarMfa()))}
          className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
        >
          {cargando && <Loader2 size={13} className="animate-spin" />}
          Activar
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <Image
            src={setup.qr}
            alt="Código QR para la aplicación de autenticación"
            width={150}
            height={150}
            unoptimized
            className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-1"
          />

          <form action={accionAlta} className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <input type="hidden" name="secret" value={setup.secret} />
            <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
              Escanea el código o introduce esta clave a mano:
            </p>
            <code className="lx-mono block break-all rounded-[var(--radius)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs">
              {setup.secret}
            </code>
            <label className="mt-1 flex flex-col gap-1">
              <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                Código de la aplicación
              </span>
              <input
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                placeholder="000000"
                className="lx-mono w-32 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm tracking-[0.3em] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pendienteAlta}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-60"
              >
                {pendienteAlta && <Loader2 size={13} className="animate-spin" />}
                Confirmar y activar
              </button>
              <Aviso estado={alta} />
            </div>
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
