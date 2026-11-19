"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { mensajeErrorPasskey } from "@/components/panel/passkey-errores";
import { ArrowLeft, Fingerprint, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { Turnstile } from "@/components/turnstile";
import { confirmarLoginPasskey, iniciarLogin, iniciarLoginPasskey, pedirClaveOlvidada, reenviarCodigo, type OlvidoState } from "./actions";
import { LogoMark } from "@/components/logo-mark";

/** Acceso al panel — plantilla «Platino». */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Solo rutas de este mismo sitio: con `?next=https://otro-sitio` un enlace trampa llevaría a la persona, recién autenticada, a una copia falsa.
  const pedido = params.get("next") ?? "";
  const next = /^\/(?![\/\\])/.test(pedido) ? pedido : "/panel";
  const motivo = params.get("motivo");
  const aviso =
    motivo === "sesion"
      ? "Tu sesión venció o no se pudo leer. Vuelve a entrar."
      : motivo === "inactividad"
        ? "Tu sesión se cerró tras 4 horas sin usar el panel. Vuelve a entrar."
      : motivo === "cuenta"
        ? "Tu sesión no corresponde a una cuenta activa del panel. Si crees que es un error, avisa a un administrador."
        : null;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingPasskey, setPendingPasskey] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Segundo paso: el código de 4 dígitos que llega al correo. Correo y contraseña quedan en memoria (no en el navegador) para completarlo.
  const [codigoPaso, setCodigoPaso] = useState<{ email: string; password: string; correo: string; minutos: number } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [reenvioEn, setReenvioEn] = useState(0);
  const [aviso2, setAviso2] = useState<string | null>(null);
  useEffect(() => {
    if (reenvioEn <= 0) return;
    const t = setTimeout(() => setReenvioEn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioEn]);

  async function entrarConCodigo(valor: string) {
    if (!codigoPaso || valor.length !== 4) return;
    setPending(true);
    setError(null);
    const res = await signIn("credentials", { email: codigoPaso.email, password: codigoPaso.password, codigo: valor, redirect: false });
    setPending(false);
    if (res?.error) {
      setError("Código incorrecto o vencido. Revisa el último correo que te llegó; tras 5 intentos hay que pedir otro.");
      setCodigo("");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function reenviar() {
    if (!codigoPaso) return;
    setError(null);
    setAviso2(null);
    const r = await reenviarCodigo({ email: codigoPaso.email, password: codigoPaso.password });
    if (!r.ok) {
      setError(r.message);
      if (r.message.startsWith("El código venció")) setCodigoPaso(null);
      return;
    }
    setAviso2("Te enviamos un código nuevo. El anterior ya no sirve.");
    setReenvioEn(60);
    setCodigo("");
  }

  // «Olvidé mi contraseña»: la misma tarjeta cambia a pedir la temporal por correo.
  const [olvido, setOlvido] = useState(false);
  const [correoOlvido, setCorreoOlvido] = useState("");
  const [olvidoEstado, setOlvidoEstado] = useState<OlvidoState | null>(null);
  const [pidiendo, setPidiendo] = useState(false);

  async function pedirTemporal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPidiendo(true);
    setOlvidoEstado(null);
    const fd = new FormData(e.currentTarget);
    try {
      setOlvidoEstado(await pedirClaveOlvidada({ email: correoOlvido.trim(), captcha: String(fd.get("cf-turnstile-response") ?? "") }));
    } catch {
      setOlvidoEstado({ ok: false, message: "No se pudo enviar ahora. Vuelve a intentarlo en un momento." });
    } finally {
      setPidiendo(false);
      (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    }
  }
  const isDemo = process.env.NODE_ENV !== "production";

  // Inicia sesión con una passkey: pide el desafío, deja que el navegador lo firme y entrega el token al formulario.
  async function entrarConPasskey() {
    setError(null);
    setPendingPasskey(true);
    try {
      const inicio = await iniciarLoginPasskey();
      if (!inicio.ok) {
        setError(inicio.message);
        return;
      }
      const respuesta = await startAuthentication(inicio.options);
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
      setError(mensajeErrorPasskey(e, "ingreso", browserSupportsWebAuthn()));
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
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "").trim();
    const captcha = String(fd.get("cf-turnstile-response") ?? "");
    // Primer paso: correo y contraseña. Si están bien, llega un código de 4 dígitos al correo.
    const inicio = await iniciarLogin({ email, password, captcha }).catch(() => ({ ok: false as const, message: "No se pudo conectar. Vuelve a intentarlo." }));
    if (!inicio.ok) {
      setPending(false);
      setError(inicio.message);
      (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
      return;
    }
    if (inicio.paso === "codigo") {
      setPending(false);
      setCodigoPaso({ email, password, correo: inicio.correo, minutos: inicio.minutos });
      setCodigo("");
      setReenvioEn(60);
      return;
    }
    const res = await signIn("credentials", { email, password, captcha, redirect: false });
    setPending(false);
    if (res?.error) {
      setError(
        "Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.",
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
        <p className="lx-kicker mt-2 text-[var(--fg-muted)]">CONtexto Ganadero Media</p>

        {codigoPaso ? (
          <div className="mt-8 flex flex-col gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={18} aria-hidden className="text-[var(--accent-2)]" /> Revisa tu correo</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--fg-muted)]">
                Enviamos un código de 4 dígitos a <strong className="text-[var(--fg)]">{codigoPaso.correo}</strong>. Vence en {codigoPaso.minutos} minutos.
              </p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void entrarConCodigo(codigo); }} className="flex flex-col gap-4">
              <label className="lx-kicker flex flex-col gap-2 text-[var(--fg-muted)]">
                Código
                <input
                  value={codigo}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setCodigo(v);
                    if (v.length === 4) void entrarConCodigo(v);
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  autoFocus
                  aria-describedby="codigo-ayuda"
                  className="lx-input text-center font-mono text-3xl tracking-[0.6em]"
                />
              </label>
              <p id="codigo-ayuda" className="-mt-2 text-xs text-[var(--fg-muted)]">Si no lo ves, revisa el spam. Se entra solo al escribir el cuarto dígito.</p>
              {aviso2 && !error && <p role="status" className="text-sm text-[var(--accent-2)]">{aviso2}</p>}
              {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
              <button type="submit" disabled={pending || codigo.length !== 4} className="lx-btn w-full">
                {pending ? "Entrando…" : "Entrar"}
              </button>
            </form>
            <div className="flex items-center justify-between gap-3 text-sm">
              <button type="button" onClick={() => { setCodigoPaso(null); setError(null); setAviso2(null); }} className="inline-flex items-center gap-1.5 font-medium text-[var(--accent-2)] transition hover:text-[var(--accent)]">
                <ArrowLeft size={15} aria-hidden /> Volver
              </button>
              <button type="button" onClick={() => void reenviar()} disabled={reenvioEn > 0} className="font-medium text-[var(--accent-2)] transition hover:text-[var(--accent)] disabled:text-[var(--fg-muted)]">
                {reenvioEn > 0 ? `Reenviar código (${reenvioEn} s)` : "Reenviar código"}
              </button>
            </div>
          </div>
        ) : olvido ? (
          <div className="mt-8 flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Recuperar la contraseña</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--fg-muted)]">Escribe el correo con el que entras. Te enviamos una contraseña temporal: sirve una vez y vence en 1 hora. Al entrar con ella, el panel te pide crear una nueva.</p>
            </div>
            {olvidoEstado?.ok ? (
              <p role="status" className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 p-3 text-sm leading-relaxed">
                <MailCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--accent-2)]" />
                <span>{olvidoEstado.message}</span>
              </p>
            ) : (
              <form onSubmit={pedirTemporal} className="flex flex-col gap-4">
                <label className="lx-kicker flex flex-col gap-2 text-[var(--fg-muted)]">
                  Correo
                  <input type="email" required autoComplete="username" value={correoOlvido} onChange={(e) => setCorreoOlvido(e.target.value)} autoFocus className="lx-input" />
                </label>
                {olvidoEstado && !olvidoEstado.ok && <p role="alert" className="text-sm text-[var(--danger)]">{olvidoEstado.message}</p>}
                <Turnstile />
                <button type="submit" disabled={pidiendo} className="lx-btn w-full">
                  {pidiendo ? "Enviando…" : "Enviarme una contraseña temporal"}
                </button>
              </form>
            )}
            <button type="button" onClick={() => { setOlvido(false); setOlvidoEstado(null); }} className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[var(--accent-2)] transition hover:text-[var(--accent)]">
              <ArrowLeft size={15} aria-hidden /> Volver a entrar
            </button>
          </div>
        ) : (
        <>
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
          <button
            type="button"
            onClick={() => { setOlvido(true); setError(null); setCorreoOlvido(String((formRef.current?.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "")); }}
            className="-mt-1 self-end text-sm font-medium text-[var(--accent-2)] underline-offset-4 transition hover:text-[var(--accent)] hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
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
        </>
        )}

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
              CONtexto Ganadero Media
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
