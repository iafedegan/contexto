"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Turnstile } from "@/components/turnstile";

/** Acceso al panel — plantilla «Platino». */
function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/panel";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const isDemo = process.env.NODE_ENV !== "production";

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
        <span className="grid size-11 place-items-center rounded-[var(--radius)] border border-[var(--border-strong)] text-[0.65rem] font-bold tracking-[0.1em]">
          CG
        </span>
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
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Turnstile />
          <button type="submit" disabled={pending} className="lx-btn mt-2 w-full">
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>

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
            className="lx-mono mt-6 w-full text-center text-[0.68rem] text-[var(--fg-muted)] transition hover:text-[var(--accent)]"
          >
            usar credenciales de demo local →
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      data-theme="acceso"
      className="lx-grain relative isolate grid min-h-dvh bg-[var(--bg)] text-[var(--fg)] lg:grid-cols-2"
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
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[var(--radius)] bg-gradient-to-br from-[#4ade9c] to-[#d8b558] text-[0.65rem] font-bold text-[#06170f]">
              CG
            </span>
            <span className="lx-display text-sm font-semibold tracking-tight text-white">
              CONtexto Ganadero
            </span>
          </span>

          <div>
            <p className="lx-kicker text-[var(--accent-2)]">Panel editorial</p>
            <p className="lx-display mt-4 max-w-md text-3xl font-light leading-snug text-white">
              Ningún contenido de IA se publica sin la aprobación de un editor.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
              Redacción asistida, control de portada y auditoría editorial en un solo lugar.
            </p>
          </div>

          <p className="lx-mono text-[0.68rem] text-white/45">
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
          <p className="lx-mono mt-8 text-center text-[0.68rem] text-[var(--fg-muted)] lg:hidden">
            acceso restringido · registro de auditoría activo
          </p>
        </div>
      </main>
    </div>
  );
}
