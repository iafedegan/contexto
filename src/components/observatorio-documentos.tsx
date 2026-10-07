"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileText, Search } from "lucide-react";
import type { BibliotecaFuente } from "@/lib/indicadores-csv";

/**
 * Biblioteca de documentos del sector (coyuntura, balance y perspectivas, cifras de referencia, PIB, costos, empleo…):
 * una tarjeta por serie de publicaciones, con el documento más reciente a un toque y los anteriores desplegables, y un
 * buscador que filtra en todas. Los archivos los sirve FEDEGÁN: aquí solo se enlazan (se abren en otra pestaña).
 */
const DESCRIPCIONES: Record<string, string> = {
  "034": "Fichas de indicadores productivos y reproductivos por región",
  "035": "Cómo le fue al sector y qué se espera para el año que viene",
  "036": "Informe periódico de la situación del sector ganadero",
  "040": "Cifras de referencia de producción",
  "041": "Cifras de exportaciones e importaciones",
  "068": "Comportamiento mensual del sacrificio y el acopio de leche",
  "073": "Cómo afectan el clima y los fenómenos naturales al sector",
  "075": "Comportamiento trimestral del PIB ganadero",
  "083": "Cómo se mueven los precios entre sí en el sector",
  "090": "Cuánto cuesta producir leche y carne",
  "093": "Empleo que genera la ganadería colombiana",
};
const MES: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
// Orden cronológico de «jul/2026» y «2025».
const clave = (f: string) => {
  const [a, b] = f.split("/");
  return b ? Number(b) * 12 + (MES[a.toLowerCase()] ?? 0) : Number(a) * 12;
};
// «Coyuntura_Ganadera_Primer_Semestre_2021.pdf» → «Coyuntura Ganadera Primer Semestre 2021».
const bonito = (archivo: string) => archivo.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fechaBonita = (f: string) => (f.includes("/") ? f.replace("/", " ") : f);

export type EtiquetasDocumentos = { buscar: string; placeholder: string; abrir: string; todos: string; documentos: string; sinResultados: string; nuevaPestana: string };

// Tarjetas de documentos con buscador.
export function ObservatorioDocumentos({ bibliotecas, etiquetas: L }: { bibliotecas: BibliotecaFuente[]; etiquetas: EtiquetasDocumentos }) {
  const [q, setQ] = useState("");
  const tarjetas = useMemo(() => {
    const t = sinTildes(q.trim());
    return bibliotecas
      .map((b) => {
        const todos = [...b.documentos].sort((x, y) => clave(y.fecha) - clave(x.fecha));
        const coincide = !t || sinTildes(`${b.titulo} ${DESCRIPCIONES[b.codigo] ?? ""}`).includes(t);
        const filtrados = coincide ? todos : todos.filter((d) => sinTildes(`${d.archivo} ${d.fecha}`).includes(t));
        return { b, todos, filtrados };
      })
      .filter((x) => x.filtrados.length > 0);
  }, [bibliotecas, q]);

  return (
    <div>
      <label className="relative block max-w-md">
        <span className="sr-only">{L.buscar}</span>
        <Search aria-hidden size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.placeholder}
          className="min-h-11 w-full rounded-full border border-[var(--border-strong)] bg-[var(--bg-2)] py-2 pl-10 pr-4 text-base text-[var(--fg)] placeholder:text-[var(--fg-muted)]/70 sm:text-sm" />
      </label>
      {tarjetas.length === 0 ? (
        <p className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] p-6 text-center text-[var(--fg-muted)]">{L.sinResultados}</p>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tarjetas.map(({ b, todos, filtrados }) => {
            const ultimo = todos[0];
            return (
              <li key={b.codigo} className="flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]"><FileText size={18} /></span>
                  <div className="min-w-0">
                    <h3 className="lx-display text-lg font-semibold leading-snug">{b.titulo}</h3>
                    {DESCRIPCIONES[b.codigo] && <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{DESCRIPCIONES[b.codigo]}</p>}
                  </div>
                </div>
                <a href={ultimo.url} target="_blank" rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-fg)] transition hover:brightness-110">
                  <span className="min-w-0 truncate">{L.abrir} · {fechaBonita(ultimo.fecha)}</span>
                  <ExternalLink aria-label={L.nuevaPestana} size={16} className="shrink-0" />
                </a>
                <details className="group mt-3" open={q.trim() !== "" || undefined}>
                  <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--accent)]">
                    <span>{L.todos} ({filtrados.length})</span>
                    <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <ul className="mt-1 divide-y divide-[var(--border)]">
                    {filtrados.map((d) => (
                      <li key={d.url}>
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 py-2 text-sm transition hover:text-[var(--accent)]">
                          <span className="w-16 shrink-0 text-xs font-bold tabular-nums text-[var(--fg-muted)]">{fechaBonita(d.fecha)}</span>
                          <span className="min-w-0 flex-1 break-words leading-snug">{bonito(d.archivo)}</span>
                          <ExternalLink aria-hidden size={14} className="shrink-0 text-[var(--fg-muted)]" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-[var(--fg-muted)]">{L.documentos}</p>
    </div>
  );
}
