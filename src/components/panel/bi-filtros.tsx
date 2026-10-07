"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar, ChevronDown, FilterX, SlidersHorizontal, X } from "lucide-react";
import type { Filtros } from "@/lib/lectores-filtros";
import { PERIODOS, filtrosActivos } from "@/lib/lectores-filtros";
import type { Opciones } from "@/lib/lectores-consulta";

/**
 * Barra de filtros del centro de análisis. Cada cambio actualiza la dirección (y con ella todo el panel), así que cada vista
 * se puede guardar, compartir o volver a abrir. Elegir una barra o una ciudad en una gráfica aplica el mismo filtro
 * (`useAplicarFiltro`): se entra al detalle sin escribir nada.
 */
export function useAplicarFiltro() {
  const router = useRouter();
  const actual = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const aplicar = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams(actual.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    iniciar(() => router.replace(`?${p.toString()}`, { scroll: false }));
  };
  return { aplicar, pendiente };
}

const ETIQUETA_DIAS: Record<number, string> = { 7: "7 días", 30: "30 días", 90: "90 días", 365: "1 año" };
const DISPOSITIVOS = [["mobile", "Celular"], ["desktop", "Computador"], ["tablet", "Tableta"]] as const;
const selector = "min-h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg)] px-3 text-base text-[var(--fg)] sm:min-h-10 sm:text-sm";

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{etiqueta}</span>
      {children}
    </label>
  );
}

export function BiFiltros({ filtros: f, opciones, hoy, soloFechas = false }: { filtros: Filtros; opciones: Opciones; hoy: string; soloFechas?: boolean }) {
  const { aplicar, pendiente } = useAplicarFiltro();
  // En el celular los cinco selectores van plegados tras un botón; desde sm siempre se ven.
  const [abierto, setAbierto] = useState(false);
  const dias = Math.round((Date.parse(`${f.hasta}T00:00:00Z`) - Date.parse(`${f.desde}T00:00:00Z`)) / 86_400_000) + 1;
  const preset = f.hasta === hoy ? PERIODOS.find((d) => d === dias) : undefined;
  const desdeDias = (d: number) => new Date(Date.parse(`${hoy}T00:00:00Z`) - (d - 1) * 86_400_000).toISOString().slice(0, 10);
  const activos = soloFechas ? 0 : filtrosActivos(f);
  const chips = [
    f.dispositivo && { k: "dispositivo", t: DISPOSITIVOS.find((d) => d[0] === f.dispositivo)?.[1] ?? f.dispositivo },
    f.ciudad && { k: "ciudad", t: f.ciudad },
    f.fuente && { k: "fuente", t: f.fuente },
    f.categoria && { k: "categoria", t: opciones.categorias.find((c) => c.valor === f.categoria)?.etiqueta ?? f.categoria },
    f.visitante && { k: "visitante", t: f.visitante === "nuevo" ? "Visitantes nuevos" : "Visitantes recurrentes" },
  ].filter((c): c is { k: string; t: string } => Boolean(c));

  return (
    <section aria-label="Filtros" aria-busy={pendiente} className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)] transition-opacity sm:p-4 ${pendiente ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">Periodo</span>
          <div role="group" aria-label="Periodo" className="inline-flex max-w-full overflow-x-auto rounded-full border border-[var(--border-strong)] p-0.5">
            {PERIODOS.map((d) => (
              <button key={d} type="button" aria-pressed={preset === d} onClick={() => aplicar({ desde: desdeDias(d), hasta: hoy })}
                className={`min-h-9 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition ${preset === d ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                {ETIQUETA_DIAS[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end sm:gap-2">
          <Campo etiqueta="Desde">
            <input type="date" value={f.desde} max={f.hasta} onChange={(e) => e.target.value && aplicar({ desde: e.target.value })} className={`${selector} sm:w-[9.5rem]`} />
          </Campo>
          <Calendar aria-hidden size={14} className="mb-3.5 hidden text-[var(--fg-muted)] sm:block" />
          <Campo etiqueta="Hasta">
            <input type="date" value={f.hasta} min={f.desde} max={hoy} onChange={(e) => e.target.value && aplicar({ hasta: e.target.value })} className={`${selector} sm:w-[9.5rem]`} />
          </Campo>
        </div>
        {!soloFechas && (
        <>
        <button type="button" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className="inline-flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-3.5 text-sm font-semibold text-[var(--accent)] sm:hidden">
          <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} aria-hidden /> Más filtros{activos > 0 ? ` (${activos})` : ""}</span>
          <ChevronDown size={16} aria-hidden className={`transition-transform ${abierto ? "rotate-180" : ""}`} />
        </button>
        <div className={`${abierto ? "grid" : "hidden"} grid-cols-2 gap-3 sm:grid sm:min-w-0 sm:flex-1 sm:grid-cols-3 xl:grid-cols-5`}>
          <Campo etiqueta="Dispositivo">
            <select value={f.dispositivo ?? ""} onChange={(e) => aplicar({ dispositivo: e.target.value || undefined })} className={selector}>
              <option value="">Todos</option>
              {DISPOSITIVOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Ciudad">
            <select value={f.ciudad ?? ""} onChange={(e) => aplicar({ ciudad: e.target.value || undefined })} className={selector}>
              <option value="">Todas</option>
              {f.ciudad && !opciones.ciudades.some((c) => c.valor === f.ciudad) && <option value={f.ciudad}>{f.ciudad}</option>}
              {opciones.ciudades.map((c) => <option key={c.valor} value={c.valor}>{c.valor} ({c.n})</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Origen">
            <select value={f.fuente ?? ""} onChange={(e) => aplicar({ fuente: e.target.value || undefined })} className={selector}>
              <option value="">Todos</option>
              {f.fuente && !opciones.fuentes.some((c) => c.valor === f.fuente) && <option value={f.fuente}>{f.fuente}</option>}
              {opciones.fuentes.map((c) => <option key={c.valor} value={c.valor}>{c.valor} ({c.n})</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Sección">
            <select value={f.categoria ?? ""} onChange={(e) => aplicar({ categoria: e.target.value || undefined })} className={selector}>
              <option value="">Todas</option>
              {f.categoria && !opciones.categorias.some((c) => c.valor === f.categoria) && <option value={f.categoria}>{f.categoria}</option>}
              {opciones.categorias.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta} ({c.n})</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Visitante">
            <select value={f.visitante ?? ""} onChange={(e) => aplicar({ visitante: e.target.value || undefined })} className={selector}>
              <option value="">Todos</option>
              <option value="nuevo">Nuevos</option>
              <option value="recurrente">Recurrentes</option>
            </select>
          </Campo>
        </div>
        </>
        )}
      </div>
      {activos > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <span className="text-xs font-semibold text-[var(--fg-muted)]">Filtrando por:</span>
          {chips.map((c) => (
            <button key={c.k} type="button" onClick={() => aplicar({ [c.k]: undefined })} aria-label={`Quitar filtro ${c.t}`}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--accent)]/10 px-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20">
              {c.t} <X size={12} aria-hidden />
            </button>
          ))}
          <button type="button" onClick={() => aplicar({ dispositivo: undefined, ciudad: undefined, fuente: undefined, categoria: undefined, visitante: undefined })}
            className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[var(--fg-muted)] transition hover:text-[var(--fg)]">
            <FilterX size={13} aria-hidden /> Limpiar todo
          </button>
        </div>
      )}
    </section>
  );
}
