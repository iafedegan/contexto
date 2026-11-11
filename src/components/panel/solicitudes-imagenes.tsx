"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Filter, Search, X } from "lucide-react";
import { Card } from "@/components/ui";
import { EntregaImagen } from "@/components/panel/entrega-imagen";

/** Una solicitud de imagen lista para mostrar (ya con los nombres y datos de la nota resueltos por el servidor). */
export type FilaSolicitud = {
  articleId: string;
  titulo: string;
  resumen: string;
  /** Dirección para abrir la nota (el diseñador la lee en la vista previa). */
  href: string;
  estadoPedido: "pendiente" | "entregada";
  estadoNota: string;
  seccion: string;
  porId: string;
  por: string;
  /** Diseñador al que se le pidió (si se pidió a uno concreto). */
  paraId: string | null;
  para: string | null;
  entregadaPor: string | null;
  entregadaPorId: string | null;
  fecha: string;
  entregadaEn: string | null;
  indicaciones: string;
  url: string | null;
};

const ESTADO_NOTA: Record<string, string> = { borrador: "Borrador", en_revision: "En revisión", programado: "Programada", publicado: "Publicada", archivado: "Archivada" };
const cuando = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(new Date(iso));
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Día en hora de Colombia (YYYY-MM-DD), para comparar con los campos de fecha.
const dia = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso));

type Orden = "recientes" | "antiguas" | "titulo";
type Filtros = { q: string; estado: "todas" | "pendiente" | "entregada"; por: string; disenador: string; seccion: string; notaEstado: string; desde: string; hasta: string; mias: boolean; orden: Orden };
const VACIOS: Filtros = { q: "", estado: "todas", por: "", disenador: "", seccion: "", notaEstado: "", desde: "", hasta: "", mias: false, orden: "recientes" };

const campo = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]";

function Etiqueta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1"><span className="lx-kicker text-[var(--fg-muted)]">{texto}</span>{children}</label>;
}

/**
 * Solicitudes de imagen con filtros avanzados que responden al instante: texto, estado del pedido, quién lo pidió, a quién se le pidió o quién lo entregó, sección,
 * estado de la nota, rango de fechas, «solo las mías» y orden. Los filtros activos se ven como etiquetas que se pueden quitar una a una.
 */
export function SolicitudesImagenes({ filas, miId, esDisenador }: { filas: FilaSolicitud[]; miId: string; esDisenador: boolean }) {
  const [f, setF] = useState<Filtros>(VACIOS);
  const [verTodas, setVerTodas] = useState(false);
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((x) => ({ ...x, [k]: v }));

  // Opciones de los selectores, a partir de lo que hay.
  const opciones = useMemo(() => {
    const unicos = (pares: [string | null, string | null][]) => [...new Map(pares.filter((p): p is [string, string] => !!p[0] && !!p[1])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
    return {
      por: unicos(filas.map((x) => [x.porId, x.por])),
      disenadores: unicos(filas.flatMap((x): [string | null, string | null][] => [[x.paraId, x.para], [x.entregadaPorId, x.entregadaPor]])),
      secciones: [...new Set(filas.map((x) => x.seccion).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
      estadosNota: [...new Set(filas.map((x) => x.estadoNota))],
    };
  }, [filas]);

  const filtradas = useMemo(() => {
    const t = norm(f.q.trim());
    const r = filas.filter((x) => {
      if (f.estado !== "todas" && x.estadoPedido !== f.estado) return false;
      if (f.por && x.porId !== f.por) return false;
      if (f.disenador && x.paraId !== f.disenador && x.entregadaPorId !== f.disenador) return false;
      if (f.seccion && x.seccion !== f.seccion) return false;
      if (f.notaEstado && x.estadoNota !== f.notaEstado) return false;
      if (f.mias && x.paraId !== miId && x.entregadaPorId !== miId && x.paraId !== null) return false;
      if (f.desde && dia(x.fecha) < f.desde) return false;
      if (f.hasta && dia(x.fecha) > f.hasta) return false;
      if (t && ![x.titulo, x.por, x.para ?? "", x.entregadaPor ?? "", x.indicaciones, x.seccion].some((s) => norm(s).includes(t))) return false;
      return true;
    });
    return r.sort((a, b) => (f.orden === "titulo" ? a.titulo.localeCompare(b.titulo, "es") : f.orden === "antiguas" ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha)));
  }, [filas, f, miId]);

  const pendientes = filtradas.filter((x) => x.estadoPedido === "pendiente");
  const entregadas = filtradas.filter((x) => x.estadoPedido === "entregada");
  const nombreDe = (id: string) => [...opciones.por, ...opciones.disenadores].find(([i]) => i === id)?.[1] ?? "";

  // Etiquetas de los filtros activos, cada una con su forma de quitarla.
  const activos: { clave: string; texto: string; quitar: () => void }[] = [
    f.q && { clave: "q", texto: `«${f.q}»`, quitar: () => set("q", "") },
    f.estado !== "todas" && { clave: "estado", texto: f.estado === "pendiente" ? "Por hacer" : "Entregadas", quitar: () => set("estado", "todas") },
    f.por && { clave: "por", texto: `Pidió: ${nombreDe(f.por)}`, quitar: () => set("por", "") },
    f.disenador && { clave: "dis", texto: `Diseñador: ${nombreDe(f.disenador)}`, quitar: () => set("disenador", "") },
    f.seccion && { clave: "sec", texto: `Sección: ${f.seccion}`, quitar: () => set("seccion", "") },
    f.notaEstado && { clave: "nota", texto: `Nota: ${f.notaEstado}`, quitar: () => set("notaEstado", "") },
    f.desde && { clave: "desde", texto: `Desde ${f.desde}`, quitar: () => set("desde", "") },
    f.hasta && { clave: "hasta", texto: `Hasta ${f.hasta}`, quitar: () => set("hasta", "") },
    f.mias && { clave: "mias", texto: "Solo las mías", quitar: () => set("mias", false) },
  ].filter(Boolean) as { clave: string; texto: string; quitar: () => void }[];

  // Hay filtros activos si alguno se apartó de su valor inicial (no por ser otro objeto).
  const filtrando = activos.length > 0 || f.orden !== "recientes";
  const entregadasVisibles = verTodas || filtrando ? entregadas : entregadas.slice(0, 8);
  const conteo = (e: "todas" | "pendiente" | "entregada") => (e === "todas" ? filas.length : filas.filter((x) => x.estadoPedido === e).length);

  return (
    <div className="flex flex-col gap-5">
      {/* Panel de filtros */}
      <section aria-label="Filtros" className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Buscar por nota, persona, sección o lo que se pidió…" aria-label="Buscar" className={`${campo} !pl-10`} />
          </div>
          <div role="tablist" aria-label="Estado de la solicitud" className="flex gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-2)] p-1">
            {([["todas", "Todas"], ["pendiente", "Por hacer"], ["entregada", "Entregadas"]] as const).map(([v, n]) => (
              <button key={v} type="button" role="tab" aria-selected={f.estado === v} onClick={() => set("estado", v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${f.estado === v ? "bg-[var(--accent)] text-[var(--accent-fg,#fff)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                {n} <span className={`tabular-nums ${f.estado === v ? "opacity-80" : "opacity-60"}`}>{conteo(v)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Etiqueta texto="Pedida por">
            <select value={f.por} onChange={(e) => set("por", e.target.value)} className={campo}>
              <option value="">Cualquiera</option>
              {opciones.por.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          </Etiqueta>
          <Etiqueta texto="Diseñador">
            <select value={f.disenador} onChange={(e) => set("disenador", e.target.value)} className={campo}>
              <option value="">Cualquiera</option>
              {opciones.disenadores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          </Etiqueta>
          <Etiqueta texto="Sección de la nota">
            <select value={f.seccion} onChange={(e) => set("seccion", e.target.value)} className={campo}>
              <option value="">Todas</option>
              {opciones.secciones.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Etiqueta>
          <Etiqueta texto="Estado de la nota">
            <select value={f.notaEstado} onChange={(e) => set("notaEstado", e.target.value)} className={campo}>
              <option value="">Todos</option>
              {opciones.estadosNota.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Etiqueta>
          <Etiqueta texto="Pedida desde">
            <div className="relative"><CalendarDays size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" /><input type="date" value={f.desde} max={f.hasta || undefined} onChange={(e) => set("desde", e.target.value)} className={`${campo} !pl-9`} /></div>
          </Etiqueta>
          <Etiqueta texto="Pedida hasta">
            <div className="relative"><CalendarDays size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" /><input type="date" value={f.hasta} min={f.desde || undefined} onChange={(e) => set("hasta", e.target.value)} className={`${campo} !pl-9`} /></div>
          </Etiqueta>
          <Etiqueta texto="Ordenar por">
            <select value={f.orden} onChange={(e) => set("orden", e.target.value as Orden)} className={campo}>
              <option value="recientes">Más recientes primero</option>
              <option value="antiguas">Más antiguas primero</option>
              <option value="titulo">Título de la nota (A–Z)</option>
            </select>
          </Etiqueta>
          {esDisenador && (
            <label className="flex cursor-pointer items-center gap-2 self-end rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm">
              <input type="checkbox" checked={f.mias} onChange={(e) => set("mias", e.target.checked)} className="size-4 accent-[var(--accent)]" /> Solo las mías
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium" aria-live="polite"><Filter size={14} aria-hidden /> {filtradas.length} {filtradas.length === 1 ? "solicitud" : "solicitudes"}</span>
          {activos.map((a) => (
            <button key={a.clave} type="button" onClick={a.quitar} className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20">
              {a.texto} <X size={12} aria-hidden /><span className="sr-only">Quitar este filtro</span>
            </button>
          ))}
          {filtrando && <button type="button" onClick={() => setF(VACIOS)} className="lx-link ml-auto text-xs font-semibold">Quitar todos los filtros</button>}
        </div>
      </section>

      {f.estado !== "entregada" && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Por hacer <span className="text-sm font-normal text-[var(--fg-muted)]">({pendientes.length})</span></h2>
          {pendientes.length ? (
            <ul className="flex flex-col gap-3">
              {pendientes.map((p) => (
                <li key={p.articleId} className="rounded-[var(--radius)] border border-[var(--border)] p-3">
                  <Link href={p.href} className="lx-link text-sm font-semibold">{p.titulo}</Link>
                  <p className="text-xs text-[var(--fg-muted)]">Pedida por {p.por || "—"}{p.para ? ` · para ${p.para}` : ""} · {cuando(p.fecha)}{p.seccion ? ` · ${p.seccion}` : ""}</p>
                  <p className="mt-2 whitespace-pre-line text-sm">{p.indicaciones}</p>
                  <EntregaImagen articleId={p.articleId} tituloNota={p.titulo} resumen={p.resumen} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">{activos.length ? "Ninguna solicitud por hacer coincide con los filtros." : "No hay imágenes por hacer."}</p>
          )}
        </Card>
      )}

      {f.estado !== "pendiente" && (entregadas.length > 0 || activos.length > 0) && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{activos.length || verTodas ? "Entregadas" : "Entregadas hace poco"} <span className="text-sm font-normal text-[var(--fg-muted)]">({entregadas.length})</span></h2>
          {entregadas.length === 0 && <p className="text-sm text-[var(--fg-muted)]">Ninguna imagen entregada coincide con los filtros.</p>}
          <ul className="flex flex-col gap-2.5">
            {entregadasVisibles.map((p) => (
              <li key={p.articleId} className="flex items-center gap-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.url && <img src={p.url} alt="" className="aspect-[16/9] w-20 shrink-0 rounded object-cover" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.titulo}</span>
                  <span className="block truncate text-xs text-[var(--fg-muted)]">Entregó {p.entregadaPor ?? "—"} · {p.entregadaEn ? cuando(p.entregadaEn) : ""} · pidió {p.por || "—"}{p.seccion ? ` · ${p.seccion}` : ""} · {p.estadoNota}</span>
                </span>
                <a href={`/vista-previa/${p.articleId}`} target="_blank" rel="noopener noreferrer" className="lx-link shrink-0 text-xs font-semibold">Ver cómo quedó en la nota →</a>
              </li>
            ))}
          </ul>
          {!verTodas && !filtrando && entregadas.length > 8 && (
            <button type="button" onClick={() => setVerTodas(true)} className="lx-link mt-3 text-xs font-semibold">Ver las {entregadas.length} entregadas</button>
          )}
        </Card>
      )}
    </div>
  );
}

export { ESTADO_NOTA };
