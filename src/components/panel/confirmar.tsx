"use client";

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/**
 * Diálogos del panel con el diseño del sitio, en lugar de los cuadros grises del navegador (`window.confirm` / `window.alert`).
 * Se usan igual, con `await`: `if (!(await confirmar("¿Borrar?"))) return;`. Van sobre `<dialog>` nativo, así que atrapan el foco,
 * se cierran con Esc (= Cancelar) y los lectores de pantalla los anuncian como diálogo.
 */
type Opciones = { textoSi?: string; textoNo?: string | null; peligro?: boolean };

const PELIGRO = /\b(eliminar|borrar|quitar|enviar|reemplazar)/i;

function Dialogo({ mensaje, o, alCerrar }: { mensaje: string; o: Opciones; alCerrar: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const peligro = o.peligro ?? PELIGRO.test(mensaje);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        alCerrar(false);
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--fg)] shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-5 p-5">
        <p className="whitespace-pre-line text-[0.95rem] leading-relaxed">{mensaje}</p>
        <div className="flex justify-end gap-2">
          {o.textoNo !== null && (
            <button type="button" onClick={() => alCerrar(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:border-[var(--accent)]">
              {o.textoNo ?? "Cancelar"}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => alCerrar(true)}
            className={`rounded-lg px-4 py-2 text-sm font-bold text-white hover:opacity-90 ${peligro ? "bg-[#b91c1c]" : "bg-[var(--accent)] !text-[var(--accent-fg)]"}`}
          >
            {o.textoSi ?? (peligro ? "Sí, continuar" : "Aceptar")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function abrir(mensaje: string, o: Opciones): Promise<boolean> {
  return new Promise((resolver) => {
    const caja = document.createElement("div");
    document.body.appendChild(caja);
    const raiz = createRoot(caja);
    const cerrar = (ok: boolean) => {
      raiz.unmount();
      caja.remove();
      resolver(ok);
    };
    raiz.render(<Dialogo mensaje={mensaje} o={o} alCerrar={cerrar} />);
  });
}

/** Pide confirmación: `true` si la persona acepta. */
export function confirmar(mensaje: string, o: Opciones = {}): Promise<boolean> {
  return abrir(mensaje, o);
}

/** Muestra un aviso con un solo botón. */
export async function avisar(mensaje: string): Promise<void> {
  await abrir(mensaje, { textoNo: null, textoSi: "Entendido", peligro: false });
}
