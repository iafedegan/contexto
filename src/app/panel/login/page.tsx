"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, Loader2 } from "lucide-react";
import { Turnstile } from "@/components/turnstile";
import { confirmarLoginPasskey, iniciarLoginPasskey } from "./actions";
import { LogoMark } from "@/components/logo-mark";

/** Acceso al panel — plantilla «Platino». */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/panel";
  const motivo = params.get("motivo");
  const aviso =
    motivo === "sesion"
      ? "Tu sesión venció o no se pudo leer. Vuelve a entrar."
      : motivo === "cuenta"
        ? "Tu sesión no corresponde a una cuenta activa del panel. Si crees que es un error, avisa a un administrador."
        : null;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingPasskey, setPendingPasskey] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const isDemo = process.env.NODE_ENV !== "production";

  // Inicia sesión con una passkey: pide el desafío, deja que el navegador lo firme y entrega el token al formulario.
  async function entrarConPasskey() {
    setError(null);
    setPendingPasskey(true);
    try {
      const options = await iniciarLoginPasskey();
      const respuesta = await startAuthentication(options);
      const verificado = await confirmarLoginPasskey(respuesta);
      if (!verificado.ok || !verificado.token) {
        setError(verificado.message || "No se pudo verificar la passkey.");
        return;
      }
      const res = await signIn("credentials", { passkeyToken: verificado.token, redirect: false });
      if (res?.error) {
        setError("La passkey no corresponde a una cuenta válida.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Cancelaste el ingreso con passkey."
          : "Este navegador o dispositivo no soporta passkeys.",
      );
    } finally {
      setPendingPasskey(false);
    }
  }

  // Envía correo, contraseña y segundo factor a Auth.js y muestra el error si falla.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    // Se recortan los espacios: pegar credenciales suele arrastrar un espacio
    // final y el fallo resultante es indistinguible de una clave equivocada.
    const res = await signIn("credentials", {
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? "").trim(),
      totp: String(fd.get("totp") ?? "").trim(),
      captcha: String(fd.get("cf-turnstile-response") ?? ""),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError(
        "Credenciales o código de verificación inválidos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.",
      );
      // El token de Turnstile es de un solo uso: se pide uno nuevo.
      (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="lx-card lx-glass lx-shine w-full p-8">
      <div className="lx-inlay absolute inset-0" />
      <div className="relative">
        <Link href="/" aria-label="Ir a la portada" className="inline-block">
          <LogoMark size={44} />
        </Link>
        <h1 className="lx-display mt-6 text-2xl font-semibold tracking-tight">Panel editorial</h1>
        <p className="lx-kicker mt-2 text-[var(--fg-muted)]">CONtexto Ganadero</p>

        <form ref={formRef} onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <label className="lx-kicker flex flex-col gap-2 text-[var(--fg-muted)]">
            Correo
            <input name="email" type="email" required autoComplete="username" className="lx-input" />
          </label>
          <label className="lx-kicker flex flex-col gap-2 text-[var(--fg-muted)]">
            <span className="flex items-center justify-between gap-2">
              Contraseña
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="lx-kicker text-[var(--accent-2)] transition hover:text-[var(--accent)]"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </span>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className="lx-input"
            />
          </label>
          <label className="lx-kicker flex flex-col gap-2 text-[var(--fg-muted)]">
            Código 2FA <span className="normal-case tracking-normal">(si está activado)</span>
            <input
              name="totp"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              className="lx-input lx-mono"
            />
          </label>
          {aviso && !error && <p className="text-sm text-[var(--fg-muted)]" role="status">{aviso}</p>}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Turnstile />
          <button type="submit" disabled={pending} className="lx-btn mt-2 w-full">
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          <span className="h-px flex-1 bg-[var(--border)]" />
          o
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <button
          type="button"
          onClick={entrarConPasskey}
          disabled={pendingPasskey}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
        >
          {pendingPasskey ? <Loader2 size={15} className="animate-spin" /> : <Fingerprint size={15} />}
          Entrar con passkey
        </button>

        {isDemo && (
          <button
            type="button"
            onClick={() => {
              const form = formRef.current;
              if (!form) return;
              (form.elements.namedItem("email") as HTMLInputElement).value =
                "editor@contextoganadero.com";
              (form.elements.namedItem("password") as HTMLInputElement).value = "contexto2026";
              setError(null);
            }}
            className="lx-mono mt-6 w-full text-center text-xs text-[var(--fg-muted)] transition hover:text-[var(--accent)]"
          >
            usar credenciales de demo local →
          </button>
        )}
      </div>
    </div>
  );
}

// Pantalla de inicio de sesión del panel.
export default function LoginPage() {
  return (
    <div
      data-theme="acceso"
      className="lx-grain relative isolate grid grid-cols-1 min-h-dvh bg-[var(--bg)] text-[var(--fg)] lg:grid-cols-2"
    >
      {/* Panel de marca. Se oculta en móvil: ahí la pantalla es para el
          formulario, no para una foto que empujaría el teclado fuera de vista. */}
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src="/fotos/sistemas-silvopastoriles-ganan-terreno-en-el-caribe.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/55 to-black/35" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3">
            <LogoMark size={40} />
            <span className="lx-display text-sm font-semibold tracking-tight text-white">
              CONtexto Ganadero
            </span>
          </Link>

          <div>
            <p className="lx-kicker text-[var(--accent-2)]">Panel editorial</p>
            <p className="lx-display mt-4 max-w-md text-3xl font-light leading-snug text-white">
              Ningún contenido de IA se publica sin la aprobación de un editor.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
              Redacción asistida, control de portada y auditoría editorial en un solo lugar.
            </p>
          </div>

          <p className="lx-mono text-xs text-white/45">
            acceso restringido · registro de auditoría activo
          </p>
        </div>
      </aside>

      {/* Columna del formulario. */}
      <main className="lx-aurora relative flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="lx-mono mt-8 text-center text-xs text-[var(--fg-muted)] lg:hidden">
            acceso restringido · registro de auditoría activo
          </p>
        </div>
      </main>
    </div>
  );
}
