import Link from "next/link";
import { CalendarClock, ExternalLink, PenLine } from "lucide-react";
import type { TareaEquipo } from "@/app/panel/(app)/consejo/tareas";

const ESTADO: Record<string, { texto: string; clase: string }> = {
  planificada: { texto: "Por redactar", clase: "bg-[var(--surface-2)] text-[var(--fg-muted)]" },
  redactando: { texto: "Redactando", clase: "bg-amber-500/15 text-amber-700" },
  revision: { texto: "Para revisar", clase: "bg-[var(--accent)]/15 text-[var(--accent)]" },
  programada: { texto: "Programada", clase: "bg-sky-600/15 text-sky-700" },
  publicada: { texto: "Publicada", clase: "bg-emerald-600/15 text-emerald-700" },
  fallida: { texto: "Falló", clase: "bg-red-600/15 text-red-700" },
};
const cuando = (d: Date) => new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(d);
const ABIERTA = (e: string) => e !== "publicada";

/** Tareas de los consejos activos: quién tiene cada pieza, en qué estado va y el enlace (a la nota publicada o al editor si sigue en desarrollo). */
export function TareasEquipo({ tareas, editor, estado }: { tareas: TareaEquipo[]; editor: string; estado: string }) {
  const porEditor = new Map<string, { nombre: string; total: number; abiertas: number }>();
  for (const t of tareas) {
    const e = porEditor.get(t.editorId) ?? { nombre: t.editor, total: 0, abiertas: 0 };
    e.total++;
    if (ABIERTA(t.estado)) e.abiertas++;
    porEditor.set(t.editorId, e);
  }
  const href = (ed: string, es: string) => `/panel/consejo?tab=tareas${ed ? `&editor=${encodeURIComponent(ed)}` : ""}${es ? `&estado=${es}` : ""}`;
  const lista = tareas.filter((t) => (!editor || t.editorId === (editor === "sin" ? "" : editor)) && (!estado || (estado === "abiertas" ? ABIERTA(t.estado) : t.estado === estado)));
  const chip = (activo: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${activo ? "border-transparent bg-[var(--accent)] !text-white" : "border-[var(--border-strong)] hover:border-[var(--accent)]"}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por editor">
          <Link href={href("", estado)} className={chip(!editor)}>Todos <span className="opacity-70">{tareas.length}</span></Link>
          {[...porEditor].map(([id, e]) => (
            <Link key={id || "sin"} href={href(id || "sin", estado)} aria-current={editor === (id || "sin") ? "true" : undefined} className={chip(editor === (id || "sin"))}>
              <PenLine size={13} aria-hidden /> {e.nombre} <span className="opacity-70">{e.abiertas} abiertas</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          {[["", "Todos los estados"], ["abiertas", "Abiertas"], ["revision", "Para revisar"], ["redactando", "Redactando"], ["planificada", "Por redactar"], ["programada", "Programadas"], ["publicada", "Publicadas"], ["fallida", "Con error"]].map(([v, t]) => (
            <Link key={v || "todos"} href={href(editor, v)} className={chip(estado === v)}>{t}</Link>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--fg-muted)]">
          {tareas.length === 0 ? "Aún no hay tareas: aparecen cuando activas un consejo de redacción con piezas asignadas." : "Ninguna tarea coincide con ese filtro."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lista.map((t) => {
            const e = ESTADO[t.estado] ?? ESTADO.planificada;
            return (
              <li key={t.id} className="lx-card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${e.clase}`}>{e.texto}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[var(--fg)]"><PenLine size={12} aria-hidden /> {t.editor}</span>
                    <span>· {t.seccion}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-snug">{t.tema || "Sin tema"}</p>
                  <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{t.plan}</p>
                  {t.estado === "fallida" && t.error && <p className="mt-1 text-xs text-red-700">{t.error}</p>}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]"><CalendarClock size={14} aria-hidden /> <span className="capitalize">{cuando(t.publicaEn)}</span></p>
                <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                  {t.enlacePublico && <a href={t.enlacePublico} target="_blank" rel="noopener noreferrer" className="lx-link inline-flex items-center gap-1">Ver publicada <ExternalLink size={13} aria-hidden /></a>}
                  {t.articleId ? (
                    <Link href={`/panel/articulos/${t.articleId}`} className="lx-link">{t.enlacePublico ? "Editar" : "Ver en desarrollo"}</Link>
                  ) : (
                    <Link href={`/panel/consejo/${t.planId}?paso=3`} className="lx-link">Ver en el consejo</Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
