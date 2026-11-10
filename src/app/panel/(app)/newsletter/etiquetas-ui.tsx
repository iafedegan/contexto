"use client";

import { useState, useTransition } from "react";
import { Pencil, Tag, X } from "lucide-react";
import { eliminarEtiquetaGlobal, etiquetarVarios, guardarEtiquetasSuscriptor, renombrarEtiquetaGlobal } from "./actions";
import { confirmar } from "@/components/panel/confirmar";

type Aviso = { ok: boolean; texto: string } | null;

const Aviso = ({ aviso }: { aviso: Aviso }) =>
  aviso ? (
    <p role={aviso.ok ? "status" : "alert"} className={`text-xs ${aviso.ok ? "text-[#15803d]" : "text-red-600"}`}>{aviso.texto}</p>
  ) : null;

/**
 * Etiquetas de UNA persona: se quitan con la ×, se añaden escribiendo el nombre y pulsando Enter (o saliendo del campo). Cada cambio se guarda
 * al instante. Al escribir, el navegador sugiere las etiquetas que ya existen (lista `etiquetas-existentes`), para no crear «Aliado» y «Aliados».
 */
export function EtiquetasSuscriptor({ id, inicial }: { id: string; inicial: string[] }) {
  const [lista, setLista] = useState(inicial);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  const guardar = (nueva: string[]) => {
    const anterior = lista;
    setLista(nueva);
    setError("");
    empezar(async () => {
      const r = await guardarEtiquetasSuscriptor(id, nueva);
      if (r.ok) setLista(r.etiquetas);
      else {
        setLista(anterior);
        setError(r.message);
      }
    });
  };
  const agregar = () => {
    const nombre = texto.trim();
    setTexto("");
    if (!nombre || lista.some((x) => x.toLowerCase() === nombre.toLowerCase())) return;
    guardar([...lista, nombre]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lista.map((e) => (
        <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
          <Tag size={11} aria-hidden /> {e}
          <button type="button" aria-label={`Quitar la etiqueta ${e}`} disabled={pendiente} onClick={() => guardar(lista.filter((x) => x !== e))} className="rounded-full p-0.5 hover:bg-[var(--accent)]/20 disabled:opacity-50">
            <X size={11} aria-hidden />
          </button>
        </span>
      ))}
      <input
        list="etiquetas-existentes"
        aria-label="Añadir etiqueta"
        placeholder="+ etiqueta"
        maxLength={40}
        value={texto}
        disabled={pendiente}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            agregar();
          }
        }}
        onBlur={agregar}
        className="w-28 rounded-full border border-dashed border-[var(--border-strong)] bg-transparent px-2.5 py-0.5 text-xs placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:outline-none"
      />
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

/**
 * Barra para etiquetar a varias personas a la vez: se marcan en la lista (casilla de cada fila), se escribe la etiqueta y se pone o se quita.
 * Las casillas son de la lista (`data-suscriptor`); aquí solo se leen las marcadas.
 */
export function BarraEtiquetado() {
  const [etiqueta, setEtiqueta] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendiente, empezar] = useTransition();

  const casillas = () => Array.from(document.querySelectorAll<HTMLInputElement>("input[data-suscriptor]"));
  const marcar = (v: boolean) => casillas().forEach((c) => (c.checked = v));

  const aplicar = (modo: "agregar" | "quitar") => {
    const ids = casillas().filter((c) => c.checked).map((c) => c.value);
    setAviso(null);
    empezar(async () => {
      const r = await etiquetarVarios(ids, etiqueta, modo);
      setAviso({ ok: r.ok, texto: r.message });
      if (r.ok) marcar(false);
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <input type="checkbox" onChange={(e) => marcar(e.target.checked)} aria-label="Marcar o desmarcar a todos los de la lista" /> Marcar todos
        </label>
        <span className="text-xs text-[var(--fg-muted)]">Con los marcados:</span>
        <input
          list="etiquetas-existentes"
          aria-label="Nombre de la etiqueta"
          placeholder="Nombre de la etiqueta"
          maxLength={40}
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          className="lx-input !w-56 !py-1.5 text-sm"
        />
        <button type="button" className="lx-btn !px-3 !py-1.5 text-xs" disabled={pendiente || !etiqueta.trim()} onClick={() => aplicar("agregar")}>Poner etiqueta</button>
        <button type="button" className="lx-btn-ghost !px-3 !py-1.5 text-xs" disabled={pendiente || !etiqueta.trim()} onClick={() => aplicar("quitar")}>Quitar etiqueta</button>
      </div>
      <Aviso aviso={aviso} />
    </div>
  );
}

/**
 * Inventario de etiquetas con cuántas personas las llevan. Los administradores pueden cambiarles el nombre (si el nuevo ya existe, se unen)
 * o eliminarlas de todos; las personas no se borran.
 */
export function GestorEtiquetas({ etiquetas, esAdmin }: { etiquetas: { nombre: string; n: number }[]; esAdmin: boolean }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendiente, empezar] = useTransition();

  if (etiquetas.length === 0) {
    return <p className="text-xs text-[var(--fg-muted)]">Aún no hay etiquetas. Escribe una en «+ etiqueta» de cualquier suscriptor, o marca varios y usa «Poner etiqueta».</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5">
        {etiquetas.map((e) => (
          <li key={e.nombre} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs">
            {editando === e.nombre ? (
              <form
                className="inline-flex items-center gap-1"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  setAviso(null);
                  empezar(async () => {
                    const r = await renombrarEtiquetaGlobal(e.nombre, nuevo);
                    setAviso({ ok: r.ok, texto: r.message });
                    if (r.ok) setEditando(null);
                  });
                }}
              >
                <input autoFocus aria-label={`Nuevo nombre para ${e.nombre}`} maxLength={40} value={nuevo} onChange={(ev) => setNuevo(ev.target.value)} className="w-32 rounded border border-[var(--border-strong)] bg-transparent px-1.5 py-0.5 text-xs" />
                <button className="font-semibold text-[var(--accent)] underline" disabled={pendiente || !nuevo.trim()}>Guardar</button>
                <button type="button" className="underline" onClick={() => setEditando(null)}>Cancelar</button>
              </form>
            ) : (
              <>
                <Tag size={11} aria-hidden className="text-[var(--accent)]" />
                <span className="font-semibold">{e.nombre}</span>
                <span className="tabular-nums text-[var(--fg-muted)]">{e.n}</span>
                {esAdmin && (
                  <>
                    <button type="button" aria-label={`Cambiar el nombre de ${e.nombre}`} title="Cambiar el nombre" disabled={pendiente} onClick={() => { setEditando(e.nombre); setNuevo(e.nombre); setAviso(null); }} className="rounded-full p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)]">
                      <Pencil size={11} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar la etiqueta ${e.nombre}`}
                      title="Eliminar de todos"
                      disabled={pendiente}
                      onClick={async () => {
                        if (!(await confirmar(`¿Quitar «${e.nombre}» de ${e.n} ${e.n === 1 ? "suscriptor" : "suscriptores"}? Los suscriptores no se borran, solo pierden la etiqueta.`))) return;
                        setAviso(null);
                        empezar(async () => {
                          const r = await eliminarEtiquetaGlobal(e.nombre);
                          setAviso({ ok: r.ok, texto: r.message });
                        });
                      }}
                      className="rounded-full p-0.5 text-[var(--fg-muted)] hover:text-red-600"
                    >
                      <X size={11} aria-hidden />
                    </button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <Aviso aviso={aviso} />
    </div>
  );
}
