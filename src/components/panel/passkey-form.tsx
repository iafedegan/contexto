"use client";

import { useState, useTransition } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, Trash2, TriangleAlert } from "lucide-react";
import {
  confirmarRegistroPasskey,
  eliminarPasskey,
  iniciarRegistroPasskey,
} from "@/app/panel/(app)/configuracion/passkey-actions";
import { mensajeErrorPasskey, nombreEquipo } from "@/components/panel/passkey-errores";

// Passkey registrada en la cuenta.
type Passkey = {
  id: string;
  label: string | null;
  deviceType: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

// Fecha corta en la hora de Colombia («18 nov 2026»).
const fecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(new Date(d));

/** Alta y gestión de passkeys (huella/Face ID/PIN en vez de escribir un
 * código cada vez) — complemento del TOTP, no un reemplazo obligatorio. */
export function PasskeyForm({ passkeys }: { passkeys: Passkey[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Registra una passkey nueva en este dispositivo.
  function agregar() {
    setError(null);
    if (!browserSupportsWebAuthn()) {
      setError(mensajeErrorPasskey(null, "registro", false));
      return;
    }
    start(async () => {
      try {
        const inicio = await iniciarRegistroPasskey();
        if (!inicio.ok) {
          setError(inicio.message);
          return;
        }
        const respuesta = await startRegistration(inicio.options);
        const resultado = await confirmarRegistroPasskey(respuesta, nombreEquipo(navigator.userAgent));
        if (!resultado?.ok) setError(resultado?.message ?? "No se pudo agregar la passkey.");
      } catch (e) {
        // Lo rechazó el navegador (cancelado, el equipo ya tiene una passkey de la cuenta, sin Windows Hello…): no es un error del servidor.
        setError(mensajeErrorPasskey(e, "registro", true));
      }
    });
  }

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Fingerprint size={15} className="text-[var(--accent-2)]" /> Passkeys
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--fg-muted)]">
        Entra con la huella, Face ID o PIN del dispositivo, sin escribir la contraseña ni esperar el código del
        correo. Puedes tener varias (celular, laptop…).
      </p>

      {passkeys.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-xs"
            >
              <span>
                <span className="font-medium">{p.label === "Este dispositivo" ? "Computador" : p.label || "Dispositivo sin nombre"}</span>
                <span className="ml-2 text-[var(--fg-muted)]">
                  creada el {fecha(p.createdAt)} ·{" "}
                  {p.lastUsedAt ? `usada por última vez el ${fecha(p.lastUsedAt)}` : "sin usar todavía"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => start(() => eliminarPasskey(p.id))}
                aria-label={`Quitar ${p.label ?? "passkey"}`}
                className="text-[var(--fg-muted)] transition hover:text-[var(--danger)]"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {passkeys.length > 0 && (
        <p className="mt-2 text-xs text-[var(--fg-muted)]">
          Si el equipo en el que estás ya aparece en la lista, no necesitas otra: al entrar al panel pulsa <strong>«Entrar con passkey»</strong>.
        </p>
      )}

      <button
        type="button"
        onClick={agregar}
        disabled={pending}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Fingerprint size={13} />}
        Agregar passkey de este dispositivo
      </button>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--danger,#b4442e)]">
          <TriangleAlert size={13} /> {error}
        </p>
      )}
    </div>
  );
}
