"use client";

import { useState } from "react";
import { Plus, Trash2, TriangleAlert, Users } from "lucide-react";
import { formatoTiempo, SIN_IDENTIFICAR, sinIdentificar, textoDeSegmentos, type Material, type Participante, type Segmento } from "@/lib/material-types";

/** ¿Se puede subir ya la grabación? Hace falta al menos una persona con nombre, o avisar que se identificarán después. */
export function participantesListos(personas: Participante[], despues: boolean): boolean {
  return despues || personas.some((p) => p.nombre.trim().length >= 2);
}

/**
 * Pregunta al editor quiénes intervienen en la grabación y si es una entrevista, ANTES de transcribir. Con esos
 * nombres la IA etiqueta cada intervención; si es entrevista, separa cada pregunta y cada respuesta.
 */
export function ParticipantesForm({
  personas,
  onPersonas,
  esEntrevista,
  onEsEntrevista,
  despues,
  onDespues,
  disabled,
}: {
  personas: Participante[];
  onPersonas: (p: Participante[]) => void;
  esEntrevista: boolean;
  onEsEntrevista: (v: boolean) => void;
  despues: boolean;
  onDespues: (v: boolean) => void;
  disabled?: boolean;
}) {
  const cambiar = (i: number, parcial: Partial<Participante>) => onPersonas(personas.map((p, k) => (k === i ? { ...p, ...parcial } : p)));
  return (
    <fieldset disabled={disabled} className="mb-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
        <Users size={15} aria-hidden /> ¿Quiénes intervienen en la grabación?
      </legend>
      <p className="mb-2 text-xs text-[var(--fg-muted)]">
        Escribe el nombre y el cargo de cada persona que habla. La IA los usa para decir quién dijo cada cosa; después puedes corregir cualquier intervención.
      </p>
      {!despues && (
        <ul className="flex flex-col gap-2">
          {personas.map((p, i) => (
            <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input
                value={p.nombre}
                onChange={(e) => cambiar(i, { nombre: e.target.value })}
                maxLength={80}
                placeholder="Nombre y apellido"
                aria-label={`Nombre de la persona ${i + 1}`}
                className="lx-input"
              />
              <input
                value={p.cargo}
                onChange={(e) => cambiar(i, { cargo: e.target.value })}
                maxLength={80}
                placeholder="Cargo o papel (opcional)"
                aria-label={`Cargo de la persona ${i + 1}`}
                className="lx-input"
              />
              <button
                type="button"
                onClick={() => onPersonas(personas.length > 1 ? personas.filter((_, k) => k !== i) : [{ nombre: "", cargo: "" }])}
                aria-label={`Quitar a la persona ${i + 1}`}
                className="lx-link grid size-8 place-items-center"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!despues && personas.length < 8 && (
        <button type="button" onClick={() => onPersonas([...personas, { nombre: "", cargo: "" }])} className="lx-link mt-2 inline-flex items-center gap-1 text-sm font-medium">
          <Plus size={14} aria-hidden /> Añadir otra persona
        </button>
      )}
      <div className="mt-3 flex flex-col gap-1.5 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={esEntrevista} onChange={(e) => onEsEntrevista(e.target.checked)} className="mt-1" />
          <span>
            <strong>Es una entrevista</strong> (pregunta y respuesta): separar la conversación intervención por intervención.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={despues} onChange={(e) => onDespues(e.target.checked)} className="mt-1" />
          <span>Todavía no sé quiénes hablan: los identifico después, al revisar la transcripción.</span>
        </label>
      </div>
    </fieldset>
  );
}

/** Añade a la revisión una persona que no se había declarado (o la primera, si el editor eligió identificar después). */
function AgregarPersona({ onAgregar }: { onAgregar: (p: Participante) => void }) {
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const agregar = () => {
    if (nombre.trim().length < 2) return;
    onAgregar({ nombre: nombre.trim(), cargo: cargo.trim() });
    setNombre("");
    setCargo("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Nombre de quien habla" aria-label="Nombre de la persona que falta" className="lx-input !w-auto min-w-44 flex-1" />
      <input value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={80} placeholder="Cargo (opcional)" aria-label="Cargo de la persona que falta" className="lx-input !w-auto min-w-36 flex-1" />
      <button type="button" onClick={agregar} disabled={nombre.trim().length < 2} className="lx-btn !py-1.5 text-sm">
        <Plus size={14} aria-hidden /> Añadir
      </button>
    </div>
  );
}

/**
 * Revisión de una transcripción dividida: el editor asigna quién dijo cada fragmento (por intervención o por voz
 * completa) y corrige el texto. El texto que va a la IA se recalcula con cada cambio.
 */
export function SegmentosEditor({ material, onChange }: { material: Material; onChange: (m: Material) => void }) {
  const segmentos = material.segmentos ?? [];
  const nombres = (material.participantes ?? []).map((p) => p.nombre);
  const opciones = [...nombres, SIN_IDENTIFICAR];
  const aplicar = (s: Segmento[]) => onChange({ ...material, segmentos: s, text: textoDeSegmentos(s) });
  // Voces que aún no tienen nombre: «Hablante N» (o cualquier etiqueta que no sea un participante).
  const voces = [...new Set(segmentos.map((s) => s.hablante).filter((h) => !opciones.includes(h) || h === SIN_IDENTIFICAR))];
  const pendientes = sinIdentificar(segmentos);

  return (
    <div className="mt-2 flex flex-col gap-3">
      {pendientes > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-[var(--radius)] bg-[#fbecd2] px-3 py-2 text-xs text-[#6b4a05]">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {pendientes} intervención{pendientes > 1 ? "es" : ""} sin identificar. Asigna quién habla: la nota solo cita con nombre a quien está identificado.
          </span>
        </p>
      )}
      <div className="rounded-[var(--radius)] border border-[var(--border)] p-2.5">
        <p className="mb-1.5 text-xs font-semibold">{nombres.length ? "¿Falta alguien? Añade a la persona" : "Escribe quién habla para poder asignarlo"}</p>
        <AgregarPersona onAgregar={(p) => onChange({ ...material, participantes: [...(material.participantes ?? []), p] })} />
      </div>
      {voces.length > 0 && nombres.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--border)] p-2.5">
          <p className="mb-1.5 text-xs font-semibold">Asignar una voz completa</p>
          <ul className="flex flex-col gap-1.5">
            {voces.map((v) => (
              <li key={v} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-28 font-medium">{v}</span>
                <span aria-hidden>→</span>
                <select
                  aria-label={`Quién es ${v}`}
                  defaultValue=""
                  onChange={(e) => e.target.value && aplicar(segmentos.map((s) => (s.hablante === v ? { ...s, hablante: e.target.value } : s)))}
                  className="lx-input !w-auto"
                >
                  <option value="">Elegir persona…</option>
                  {nombres.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ol className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
        {segmentos.map((s, i) => (
          <li key={i} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-2">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {s.inicio !== undefined && <span className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[var(--fg-muted)]">{formatoTiempo(s.inicio)}</span>}
              <select
                aria-label={`Quién habla en la intervención ${i + 1}`}
                value={s.hablante}
                onChange={(e) => aplicar(segmentos.map((x, k) => (k === i ? { ...x, hablante: e.target.value } : x)))}
                className="lx-input !w-auto !py-1 text-sm"
              >
                {!opciones.includes(s.hablante) && <option value={s.hablante}>{s.hablante}</option>}
                {opciones.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => aplicar(segmentos.filter((_, k) => k !== i))} className="lx-link ml-auto text-xs">
                Quitar
              </button>
            </div>
            <textarea
              value={s.texto}
              onChange={(e) => aplicar(segmentos.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))}
              rows={Math.min(8, Math.max(2, Math.ceil(s.texto.length / 90)))}
              aria-label={`Texto de la intervención ${i + 1}`}
              className="lx-input resize-y text-sm leading-relaxed"
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
