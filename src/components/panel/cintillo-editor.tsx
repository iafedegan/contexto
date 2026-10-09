"use client";

import type { ReactNode } from "react";
import {
  CINTILLO_MAX_TEXTO,
  CINTILLO_MAX_TEXTOS,
  MERCADO_CINTILLO,
  sanitizeTicker,
  type CintilloFuente,
  type TickerConfig,
} from "@/lib/cintillo";

/**
 * Cintillo de la portada, dentro del editor: qué lleva (titulares de portada, de las más recientes o de una sección,
 * indicadores del mercado y mensajes propios) y a qué velocidad corre. Los cambios se ven al instante en el lienzo y se
 * publican con «Publicar cambios», como el resto del diseño.
 */
export function CintilloEditor({
  value,
  onChange,
  secciones,
}: {
  value: TickerConfig | undefined;
  onChange: (next: Required<TickerConfig>) => void;
  /** Secciones del sitio para elegir de cuál salen los titulares. */
  secciones: { slug: string; name: string }[];
}) {
  const v = sanitizeTicker(value);
  const set = (p: Partial<TickerConfig>) => onChange(sanitizeTicker({ ...v, ...p }));

  return (
    <div className="flex flex-col gap-4 text-sm">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
        <span className="font-semibold">{v.activo ? "Cintillo activado" : "Cintillo apagado"}</span>
        <input type="checkbox" checked={v.activo} onChange={(e) => set({ activo: e.target.checked })} className="size-4 accent-[var(--accent)]" />
      </label>

      <fieldset disabled={!v.activo} className="flex flex-col gap-4 disabled:opacity-50">
        <Grupo titulo="Titulares">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["portada", "Como la portada"],
                ["recientes", "Las más recientes"],
                ["seccion", "De una sección"],
              ] as [CintilloFuente, string][]
            ).map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                aria-pressed={v.fuente === id}
                onClick={() => set({ fuente: id, ...(id === "seccion" && !v.seccion ? { seccion: secciones[0]?.slug ?? "" } : {}) })}
                className={`rounded-md border px-2.5 py-1 text-xs transition ${v.fuente === id ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          {v.fuente === "seccion" && (
            <select value={v.seccion} onChange={(e) => set({ seccion: e.target.value })} aria-label="Sección de los titulares" className="lx-input mt-2 !py-1.5 !text-xs">
              {secciones.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <Deslizador
            etiqueta="Cuántos titulares"
            valor={v.cantidad}
            min={0}
            max={20}
            texto={v.cantidad === 0 ? "ninguno" : String(v.cantidad)}
            onChange={(cantidad) => set({ cantidad })}
          />
        </Grupo>

        <Grupo titulo="Indicadores del mercado">
          <div className="flex flex-col gap-1.5">
            {MERCADO_CINTILLO.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={v.mercado.includes(m.id)}
                  onChange={(e) => set({ mercado: e.target.checked ? [...v.mercado, m.id] : v.mercado.filter((x) => x !== m.id) })}
                  className="size-4 accent-[var(--accent)]"
                />
                {m.etiqueta}
              </label>
            ))}
          </div>
        </Grupo>

        <Grupo titulo="Mensajes propios">
          <textarea
            // Una línea por mensaje: se conservan los saltos mientras se escribe y se limpia al guardar.
            defaultValue={v.textos.join("\n")}
            onChange={(e) => set({ textos: e.target.value.split("\n") })}
            rows={3}
            placeholder={"Un mensaje por línea. Salen primero.\nEj.: Feria Ganadera de Montería, 15 al 18 de octubre"}
            className="lx-input resize-y !py-1.5 !text-xs"
          />
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
            Hasta {CINTILLO_MAX_TEXTOS} mensajes de {CINTILLO_MAX_TEXTO} caracteres.
          </p>
        </Grupo>

        <Grupo titulo="Velocidad">
          <Deslizador
            etiqueta="De lenta a rápida"
            valor={v.velocidad}
            min={1}
            max={10}
            texto={v.velocidad <= 3 ? "lenta" : v.velocidad <= 7 ? "normal" : "rápida"}
            onChange={(velocidad) => set({ velocidad })}
          />
          <div className="flex justify-between text-[11px] text-[var(--fg-muted)]">
            <span>Lenta</span>
            <span>Rápida</span>
          </div>
        </Grupo>
      </fieldset>
    </div>
  );
}

// Un grupo de controles con título.
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{titulo}</p>
      {children}
    </div>
  );
}

// Deslizador con su etiqueta y el valor a la derecha.
function Deslizador({ etiqueta, valor, min, max, texto, onChange }: { etiqueta: string; valor: number; min: number; max: number; texto: string; onChange: (n: number) => void }) {
  return (
    <label className="mt-2 block text-xs">
      <span className="flex justify-between">
        <span className="text-[var(--fg-muted)]">{etiqueta}</span>
        <span className="font-semibold tabular-nums">{texto}</span>
      </span>
      <input type="range" min={min} max={max} step={1} value={valor} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" />
    </label>
  );
}
