"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Eye, EyeOff, KeyRound, Loader2, ShieldAlert, TriangleAlert, UserRound } from "lucide-react";
import { actualizarMiPerfil, type MiPerfilState } from "@/app/panel/(app)/configuracion/actions";

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";
const etiqueta = "text-sm font-medium";

/**
 * «Mis datos»: cada quien edita su nombre, su correo y su contraseña. Son dos bloques separados, cada uno con su botón, para que quede claro qué
 * se guarda: los datos personales por un lado y la contraseña por otro (la tabla de personas no toca la cuenta propia; ver actions.ts).
 */
export function MiPerfilForm({ name, email, debeCambiar = false }: { name: string; email: string; /** Entró con contraseña temporal: el cambio es obligatorio. */ debeCambiar?: boolean }) {
  const router = useRouter();
  const [datos, guardarDatos, guardandoDatos] = useActionState<MiPerfilState, FormData>(actualizarMiPerfil, null);
  const [clave, guardarClave, guardandoClave] = useActionState<MiPerfilState, FormData>(actualizarMiPerfil, null);
  const [nombre, setNombre] = useState(name);
  const [correo, setCorreo] = useState(email);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const largoOk = nueva.length >= 10;
  const distintaOk = !!actual && !!nueva && nueva !== actual;
  // Al cambiar la contraseña temporal, el aviso y el bloqueo del panel se quitan (vienen del servidor).
  useEffect(() => {
    if (datos?.ok || clave?.ok) router.refresh();
  }, [datos, clave, router]);
  useEffect(() => {
    if (!clave?.ok) return;
    const t = setTimeout(() => { setActual(""); setNueva(""); }, 0);
    return () => clearTimeout(t);
  }, [clave]);

  const contrasena = (
    <section aria-labelledby="titulo-contrasena" className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]"><KeyRound size={17} aria-hidden /></span>
        <div>
          <h3 id="titulo-contrasena" className="text-base font-semibold">Contraseña</h3>
          <p className="text-sm text-[var(--fg-muted)]">Usa al menos 10 caracteres. Puedes ver lo que escribes con el ojo.</p>
        </div>
      </header>
      {debeCambiar && (
        <p role="alert" className="flex items-start gap-2 rounded-[var(--radius)] border border-[#d97706]/50 bg-[#fff7ed] px-3 py-2.5 text-sm text-[#7c2d12]">
          <ShieldAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>Entraste con una contraseña temporal. Cámbiala para poder usar el panel.</span>
        </p>
      )}
      <form action={guardarClave} className="flex flex-col gap-4">
        <input type="hidden" name="name" value={nombre} />
        <input type="hidden" name="email" value={correo} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoClave nombre="currentPassword" etiqueta={debeCambiar ? "Contraseña temporal" : "Contraseña actual"} ayuda={debeCambiar ? "La que te dieron para entrar." : undefined} autoComplete="current-password" requerido foco={debeCambiar} valor={actual} alCambiar={setActual} />
          <CampoClave nombre="newPassword" etiqueta="Contraseña nueva" autoComplete="new-password" requerido valor={nueva} alCambiar={setNueva} minimo={10} />
        </div>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2" aria-live="polite">
          <Requisito ok={largoOk}>Al menos 10 caracteres{nueva ? ` (${nueva.length})` : ""}</Requisito>
          <Requisito ok={distintaOk}>Distinta de la {debeCambiar ? "temporal" : "actual"}</Requisito>
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={guardandoClave || !largoOk || !distintaOk} className="lx-btn disabled:cursor-not-allowed disabled:opacity-50">
            {guardandoClave ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <KeyRound size={15} aria-hidden />} Cambiar contraseña
          </button>
          <Estado estado={clave} />
        </div>
      </form>
    </section>
  );

  const personales = (
    <section aria-labelledby="titulo-datos" className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]"><UserRound size={17} aria-hidden /></span>
        <div>
          <h3 id="titulo-datos" className="text-base font-semibold">Datos personales</h3>
          <p className="text-sm text-[var(--fg-muted)]">Tu nombre se ve en el panel; con el correo entras.</p>
        </div>
      </header>
      <form action={guardarDatos} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={etiqueta}>Nombre</span>
            <input name="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" className={campo} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={etiqueta}>Correo</span>
            <input name="email" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoComplete="email" className={campo} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={guardandoDatos || (nombre === name && correo === email)} className="lx-btn lx-btn-ghost disabled:cursor-not-allowed disabled:opacity-50">
            {guardandoDatos && <Loader2 size={15} className="animate-spin" aria-hidden />} Guardar datos
          </button>
          <Estado estado={datos} />
        </div>
      </form>
    </section>
  );

  // Con contraseña temporal, lo urgente va primero.
  return (
    <div className="mb-6 flex flex-col gap-8">
      {debeCambiar ? contrasena : personales}
      <hr className="border-[var(--border)]" />
      {debeCambiar ? personales : contrasena}
    </div>
  );
}

/** El resultado de guardar, junto al botón. */
function Estado({ estado }: { estado: MiPerfilState }) {
  if (!estado) return null;
  return (
    <p role="status" className={`flex items-center gap-1.5 text-sm ${estado.ok ? "text-[#157a4a]" : "text-[var(--danger,#b4442e)]"}`}>
      {estado.ok ? <Check size={15} aria-hidden /> : <TriangleAlert size={15} aria-hidden />}
      {estado.message}
    </p>
  );
}

/** Campo de contraseña con el botón del ojo para verla (patrón estándar: sin repetir la contraseña) y aviso de Bloq Mayús. */
function CampoClave({ nombre, etiqueta: titulo, ayuda, autoComplete, requerido, foco, valor, alCambiar, minimo }: { nombre: string; etiqueta: string; ayuda?: string; autoComplete: string; requerido?: boolean; foco?: boolean; valor: string; alCambiar: (v: string) => void; minimo?: number }) {
  const [ver, setVer] = useState(false);
  const [mayus, setMayus] = useState(false);
  const id = `campo-${nombre}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={etiqueta}>{titulo}</label>
      <div className="relative">
        <input
          id={id}
          name={nombre}
          type={ver ? "text" : "password"}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          onKeyUp={(e) => setMayus(e.getModifierState("CapsLock"))}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={requerido}
          autoFocus={foco}
          minLength={minimo}
          className={`${campo} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? "Ocultar la contraseña" : "Mostrar la contraseña"}
          aria-pressed={ver}
          aria-controls={id}
          title={ver ? "Ocultar" : "Mostrar"}
          className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
        >
          {ver ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {ayuda && <p className="text-xs text-[var(--fg-muted)]">{ayuda}</p>}
      {mayus && <p className="text-xs font-medium text-[#92400e]">Bloq Mayús está activado.</p>}
    </div>
  );
}

/** Una condición de la contraseña nueva, que se marca al cumplirse mientras se escribe. */
function Requisito({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-[#157a4a]" : "text-[var(--fg-muted)]"}`}>
      {ok ? <Check size={15} aria-hidden /> : <Circle size={15} aria-hidden />}
      <span>{children}</span>
      <span className="sr-only">{ok ? "(cumple)" : "(falta)"}</span>
    </li>
  );
}
