"use client";

import { RotateCcw } from "lucide-react";
import { Group } from "@/components/panel/region-editor";
import { MAX_LEMA, MAX_NOMBRE, type TextosCabecera } from "@/lib/textos-cabecera";

/**
 * «Textos» de la cabecera: el título y el subtítulo que salen bajo el logo y si se muestra la fecha. Lo que se deja vacío usa el nombre y el
 * lema del sitio (los de Configuración). Cada cambio entra al borrador del editor y se ve al momento en el lienzo.
 */
export function TextosCabeceraEditor({ value, onChange }: { value: TextosCabecera | undefined; onChange: (next: TextosCabecera | undefined) => void }) {
  const t = value ?? {};
  // Aplica un cambio quitando lo que queda sin valor (así «sin ajustes» es `undefined` y no un objeto vacío).
  function patch(p: Partial<TextosCabecera>) {
    const merged: TextosCabecera = { ...t, ...p };
    if (!merged.nombre) delete merged.nombre;
    if (merged.lema === undefined) delete merged.lema;
    if (merged.fecha !== false) delete merged.fecha;
    onChange(Object.keys(merged).length ? merged : undefined);
  }
  const sinSubtitulo = t.lema === "";
  const campo = "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-3 py-2 text-sm text-[#0b0b0b] placeholder:text-[var(--fg-muted)] disabled:opacity-50";
  return (
    <Group title="Textos de la cabecera" abierto>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Título</span>
        <input
          type="text"
          value={t.nombre ?? ""}
          maxLength={MAX_NOMBRE}
          placeholder="Por defecto: el nombre del sitio"
          onChange={(e) => patch({ nombre: e.target.value })}
          className={campo}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Subtítulo</span>
        <input
          type="text"
          value={sinSubtitulo ? "" : (t.lema ?? "")}
          maxLength={MAX_LEMA}
          disabled={sinSubtitulo}
          placeholder="Por defecto: el lema del sitio"
          onChange={(e) => patch({ lema: e.target.value || undefined })}
          className={campo}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sinSubtitulo} onChange={(e) => patch({ lema: e.target.checked ? "" : undefined })} />
        Sin subtítulo
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={t.fecha !== false} onChange={(e) => patch({ fecha: e.target.checked ? undefined : false })} />
        Mostrar la fecha de hoy
      </label>
      {value && (
        <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-[var(--accent)] hover:underline">
          <RotateCcw size={12} aria-hidden /> Volver a los textos del sitio
        </button>
      )}
    </Group>
  );
}
