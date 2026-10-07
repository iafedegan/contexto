"use client";

import { useEffect, useRef, useState } from "react";
import { useAplicarFiltro } from "@/components/panel/bi-filtros";
import { DEPARTAMENTOS, MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";
import { BI_COLORES, compacto, marcasEje, tramos, trazoSuave } from "@/lib/graficas";
import { DIAS_CORTOS, DIAS_LARGOS, duracion, franja, horaEtiqueta, indiceDia, parte } from "@/lib/lectores-formato";
import { departamentoDeRegion, nombreDeDepartamento } from "@/lib/lectores-geo";
import type { Calor, Desglose, Dia, Embudo } from "@/lib/lectores-consulta";
import { colorCalor, normaDepartamento } from "@/lib/mapa-util";
import { nfCO } from "@/lib/format";

const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const fechaCorta = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Mide el ancho de su caja y lo entrega a quien dibuja (las gráficas se pintan al tamaño real). */
function useAncho(inicial = 640) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [caja, ancho] as const;
}

// -------------------------------------------------------------------- serie en el tiempo
export type SerieDef = { clave: string; etiqueta: string; valores: number[]; color: string; area?: boolean; /** Total que se muestra en la leyenda; por defecto la suma de la serie (para «lectores únicos» la suma diaria engaña: se pasa el total real). */ total?: number };

/** Líneas en el tiempo con lectura al pasar el cursor o el dedo y series que se encienden y apagan. */
export function GraficaTiempo({ dias, series, alto = 260 }: { dias: string[]; series: SerieDef[]; alto?: number }) {
  const [caja, ancho] = useAncho();
  const [apagadas, setApagadas] = useState<string[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const n = dias.length;
  const visibles = series.filter((s) => !apagadas.includes(s.clave));
  const h = ancho < 480 ? Math.min(alto, 210) : alto;
  const m = { l: ancho < 480 ? 34 : 42, r: 10, t: 12, b: 26 };
  const max = Math.max(1, ...visibles.flatMap((s) => s.valores));
  const marcas = marcasEje(0, max * 1.08);
  const x = (i: number) => m.l + ((ancho - m.l - m.r) * i) / Math.max(1, n - 1);
  const y = (v: number) => m.t + (h - m.t - m.b) * (1 - v / (marcas[marcas.length - 1] || 1));
  const cada = Math.ceil(n / (ancho < 480 ? 4 : 8));
  const idx = hover ?? n - 1;
  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    setHover(Math.min(n - 1, Math.max(0, Math.round(((px - m.l) / (ancho - m.l - m.r)) * (n - 1)))));
  };
  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Series">
        {series.map((s) => (
          <li key={s.clave}>
            <button type="button" aria-pressed={!apagadas.includes(s.clave)} onClick={() => setApagadas((p) => (p.includes(s.clave) ? p.filter((k) => k !== s.clave) : p.length >= series.length - 1 ? p : [...p, s.clave]))}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${apagadas.includes(s.clave) ? "border-[var(--border)] text-[var(--fg-muted)] opacity-50" : "border-[var(--border-strong)] text-[var(--fg)]"}`}>
              <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
              {s.etiqueta} <span className="tabular-nums text-[var(--fg-muted)]">{nfCO.format(s.total ?? s.valores.reduce((t, v) => t + v, 0))}</span>
            </button>
          </li>
        ))}
      </ul>
      <div ref={caja} className="relative min-w-0 select-none">
        <svg width={ancho} height={h} viewBox={`0 0 ${ancho} ${h}`} role="img" aria-label={`Evolución diaria: ${series.map((s) => `${s.etiqueta} ${nfCO.format(s.total ?? s.valores.reduce((t, v) => t + v, 0))}`).join(", ")}`}
          className="block touch-pan-y overflow-visible" onPointerMove={alMover} onPointerDown={alMover} onPointerLeave={() => setHover(null)}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.clave} id={`g-${s.clave}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity=".22" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {marcas.map((v) => (
            <g key={v}>
              <line x1={m.l} x2={ancho - m.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 5" />
              <text x={m.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--fg-muted)" className="tabular-nums">{compacto(v)}</text>
            </g>
          ))}
          {dias.map((d, i) => (i % cada === (n - 1) % cada ? <text key={d} x={x(i)} y={h - 7} textAnchor="middle" fontSize="10.5" fill="var(--fg-muted)">{fechaCorta(d)}</text> : null))}
          <line x1={x(idx)} x2={x(idx)} y1={m.t} y2={h - m.b} stroke="var(--border-strong)" strokeDasharray="3 4" />
          {visibles.map((s) =>
            tramos(s.valores, x, y).map((t, k) => (
              <g key={`${s.clave}${k}`}>
                {s.area && <path d={`${trazoSuave(t)}L${t[t.length - 1].x} ${h - m.b}L${t[0].x} ${h - m.b}Z`} fill={`url(#g-${s.clave})`} />}
                <path d={trazoSuave(t)} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )),
          )}
          {visibles.map((s) => <circle key={s.clave} cx={x(idx)} cy={y(s.valores[idx] ?? 0)} r="4.5" fill="var(--bg)" stroke={s.color} strokeWidth="2.4" />)}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-xs shadow-xl" style={{ left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, ancho - 160)) }}>
            <p className="mb-1 font-semibold capitalize text-[var(--fg-muted)]">{fechaLarga(dias[hover])}</p>
            {visibles.map((s) => (
              <p key={s.clave} className="flex items-center justify-between gap-3 tabular-nums">
                <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />{s.etiqueta}</span>
                <span className="font-bold">{nfCO.format(s.valores[hover] ?? 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Adaptador: lecturas y lectores de un periodo. */
export function SerieDiaria({ serie, lectoresUnicos }: { serie: Dia[]; lectoresUnicos: number }) {
  return (
    <GraficaTiempo
      dias={serie.map((d) => d.dia)}
      series={[
        { clave: "lecturas", etiqueta: "Lecturas", valores: serie.map((d) => d.lecturas), color: BI_COLORES[0], area: true },
        { clave: "lectores", etiqueta: "Lectores únicos", valores: serie.map((d) => d.visitantes), color: BI_COLORES[1], total: lectoresUnicos },
        { clave: "recurrentes", etiqueta: "De quienes vuelven", valores: serie.map((d) => d.recurrentes), color: BI_COLORES[2] },
      ]}
    />
  );
}

// -------------------------------------------------------------------- mapa de calor de horas
/** Día de la semana × hora del día (hora de Colombia): cuándo se lee, de un vistazo. */
export function MapaCalorHoras({ calor }: { calor: Calor[] }) {
  const [foco, setFoco] = useState<{ d: number; h: number } | null>(null);
  const celdas = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const c of calor) celdas[indiceDia(c.dow)][c.hora] += c.n;
  const total = celdas.flat().reduce((t, v) => t + v, 0);
  const max = Math.max(1, ...celdas.flat());
  const mejores = celdas.flatMap((fila, d) => fila.map((n, h) => ({ d, h, n }))).filter((c) => c.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
  const lectura = foco ? celdas[foco.d][foco.h] : null;
  return (
    <div>
      <p aria-live="polite" className="min-h-6 text-sm text-[var(--fg-muted)]">
        {foco && lectura !== null ? (
          <><strong className="text-[var(--fg)]">{DIAS_LARGOS[foco.d].replace(/^./, (c) => c.toUpperCase())}, {franja(foco.h)}</strong>: {nfCO.format(lectura)} {lectura === 1 ? "lectura" : "lecturas"} ({parte(lectura, total).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %)</>
        ) : mejores.length ? (
          <>Mejores franjas: {mejores.map((c, i) => <span key={i}>{i > 0 && " · "}<strong className="text-[var(--fg)]">{DIAS_CORTOS[c.d]} {horaEtiqueta(c.h)}</strong></span>)}</>
        ) : "Aún no hay lecturas en este periodo."}
      </p>
      <div aria-hidden className="mt-2 overflow-x-auto" onPointerLeave={() => setFoco(null)}>
        <div className="grid min-w-[30rem] grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-[3px]">
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center text-[0.6rem] tabular-nums text-[var(--fg-muted)]">{h % 3 === 0 ? h : ""}</span>)}
          {celdas.map((fila, d) => (
            <div key={d} className="contents">
              <span className="self-center text-[0.68rem] font-semibold text-[var(--fg-muted)]">{DIAS_CORTOS[d]}</span>
              {fila.map((n, h) => (
                <span key={h} onPointerEnter={() => setFoco({ d, h })} onClick={() => setFoco({ d, h })}
                  className={`h-6 rounded-[3px] sm:h-7 ${foco?.d === d && foco.h === h ? "outline outline-2 outline-[var(--fg)]" : mejores.some((c) => c.d === d && c.h === h) ? "outline outline-1 outline-[var(--accent-2)]" : ""}`}
                  style={{ background: n === 0 ? "var(--surface-2)" : `color-mix(in oklab, var(--accent) ${Math.round(14 + 86 * Math.sqrt(n / max))}%, var(--surface-2))` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-3 flex items-center gap-2 text-[0.68rem] text-[var(--fg-muted)]">
        <span>Menos</span><span className="h-2 flex-1 max-w-40 rounded-full" style={{ background: "linear-gradient(90deg, var(--surface-2), var(--accent))" }} /><span>Más</span>
      </div>
      <table className="sr-only">
        <caption>Lecturas por día de la semana y hora (hora de Colombia)</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">Hora</th><th scope="col">Lecturas</th></tr></thead>
        <tbody>{celdas.flatMap((fila, d) => fila.map((n, h) => (n > 0 ? <tr key={`${d}-${h}`}><th scope="row">{DIAS_LARGOS[d]}</th><td>{franja(h)}</td><td>{n}</td></tr> : null)))}</tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------------- embudo de lectura
/** Cuánta gente abre la nota y cuántos llegan al 25, 50, 75 % y al final; entre pasos se ve dónde se pierde la gente. */
export function EmbudoLectura({ embudo }: { embudo: Embudo }) {
  const a = embudo.alcance;
  const pasos = [
    { t: "Abrieron la nota", n: a.lecturas },
    { t: "Bajaron al menos un cuarto", n: a.a25 },
    { t: "Llegaron a la mitad", n: a.a50 },
    { t: "Pasaron los tres cuartos", n: a.a75 },
    { t: "Leyeron hasta el final", n: a.completas },
  ];
  return (
    <ol className="flex flex-col gap-2.5">
      {pasos.map((p, i) => {
        const previo = i > 0 ? pasos[i - 1].n : p.n;
        const pierde = i > 0 && previo > 0 ? parte(previo - p.n, previo) : 0;
        return (
          <li key={p.t}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{p.t}</span>
              <span className="tabular-nums"><strong>{nfCO.format(p.n)}</strong> <span className="text-[var(--fg-muted)]">· {parte(p.n, a.lecturas).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %</span></span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${parte(p.n, a.lecturas)}%`, background: i === pasos.length - 1 ? "var(--accent-2)" : "var(--accent)", opacity: 1 - i * 0.12 }} />
            </div>
            {i > 0 && pierde > 0 && <p className="mt-0.5 text-[0.7rem] text-[var(--fg-muted)]">Se pierde el {pierde.toLocaleString("es-CO", { maximumFractionDigits: 0 })} % respecto al paso anterior</p>}
          </li>
        );
      })}
    </ol>
  );
}

// -------------------------------------------------------------------- listas con barras (y detalle al hacer clic)
const ETIQUETAS_DISPOSITIVO: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tableta", otro: "Otro" };

/** Barras horizontales con cuota, % leído y tiempo; si se indica `param`, pulsar una fila aplica ese filtro. */
export function ListaBarras({ items, total, param, mapa }: { items: Desglose[]; total: number; param?: "dispositivo" | "ciudad" | "fuente" | "categoria"; mapa?: "dispositivo" }) {
  const { aplicar } = useAplicarFiltro();
  const max = Math.max(1, ...items.map((i) => i.lecturas));
  if (!items.length) return <p className="text-sm text-[var(--fg-muted)]">Sin datos en este periodo.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => {
        const nombre = mapa === "dispositivo" ? ETIQUETAS_DISPOSITIVO[it.clave] ?? it.clave : it.clave;
        const valorFiltro = param === "categoria" ? undefined : it.clave;
        const contenido = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{nombre}</span>
              <span className="shrink-0 tabular-nums"><strong>{nfCO.format(it.lecturas)}</strong> <span className="text-[var(--fg-muted)]">· {parte(it.lecturas, total).toLocaleString("es-CO", { maximumFractionDigits: 0 })} %</span></span>
            </span>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${(it.lecturas / max) * 100}%` }} /></span>
            <span className="mt-0.5 block text-[0.68rem] text-[var(--fg-muted)]">{Math.round(it.scroll)} % leído · {duracion(it.segundos)} · {nfCO.format(it.visitantes)} {it.visitantes === 1 ? "lector" : "lectores"}</span>
          </>
        );
        return (
          <li key={it.clave}>
            {param && valorFiltro && it.clave !== "Sin dato" ? (
              <button type="button" onClick={() => aplicar({ [param]: valorFiltro })} title={`Filtrar por ${nombre}`} className="block w-full rounded-[var(--radius)] px-2 py-1.5 text-left transition hover:bg-[var(--surface-2)]">{contenido}</button>
            ) : (
              <div className="px-2 py-1.5">{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// -------------------------------------------------------------------- mapa de Colombia por departamento
/** Lectura por departamento (según la región que reporta la geolocalización), con ranking al lado. */
export function MapaLectura({ regiones, total }: { regiones: Desglose[]; total: number }) {
  const [foco, setFoco] = useState<string | null>(null);
  const porDepto = new Map<string, { lecturas: number; visitantes: number }>();
  let sinUbicar = 0;
  for (const r of regiones) {
    const d = departamentoDeRegion(r.clave);
    if (!d) sinUbicar += r.lecturas;
    else {
      const a = porDepto.get(d) ?? { lecturas: 0, visitantes: 0 };
      porDepto.set(d, { lecturas: a.lecturas + r.lecturas, visitantes: a.visitantes + r.visitantes });
    }
  }
  const lista = [...porDepto].map(([d, v]) => ({ d, ...v })).sort((a, b) => b.lecturas - a.lecturas);
  const max = Math.max(1, ...lista.map((l) => l.lecturas));
  const activo = foco ? lista.find((l) => l.d === foco) : lista[0];
  if (!lista.length) return <p className="text-sm text-[var(--fg-muted)]">Todavía no hay lecturas con departamento conocido.{sinUbicar ? ` (${nfCO.format(sinUbicar)} sin ubicar)` : ""}</p>;
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <svg viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`} className="mx-auto block h-auto w-full max-w-[15rem]" role="img" aria-label="Mapa de Colombia con las lecturas por departamento" onPointerLeave={() => setFoco(null)}>
        {DEPARTAMENTOS.map((dep) => {
          const k = normaDepartamento(dep.nombre);
          const v = porDepto.get(k);
          return <path key={dep.nombre} d={dep.d} fill={colorCalor(v?.lecturas, max)} stroke={activo?.d === k ? "var(--fg)" : "var(--bg)"} strokeWidth={activo?.d === k ? 1.6 : 0.8} strokeLinejoin="round" className="cursor-pointer transition-[fill] duration-500" onPointerEnter={() => v && setFoco(k)} onClick={() => v && setFoco(k)} />;
        })}
      </svg>
      <div className="min-w-0">
        {activo && (
          <p className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm" aria-live="polite">
            <strong className="lx-display block text-lg">{nombreDeDepartamento(activo.d)}</strong>
            <span className="tabular-nums">{nfCO.format(activo.lecturas)} lecturas · {nfCO.format(activo.visitantes)} lectores · {parte(activo.lecturas, total).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %</span>
          </p>
        )}
        <ol className="mt-3 flex flex-col gap-1">
          {lista.slice(0, 6).map((l, i) => (
            <li key={l.d}>
              <button type="button" onClick={() => setFoco(l.d)} onPointerEnter={() => setFoco(l.d)} className={`grid min-h-9 w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius)] px-2 text-left text-sm ${activo?.d === l.d ? "bg-[var(--surface-2)]" : ""}`}>
                <span className="text-xs font-bold tabular-nums text-[var(--fg-muted)]">{i + 1}</span>
                <span className="relative min-w-0"><span className="relative z-10 block truncate py-0.5 font-medium">{nombreDeDepartamento(l.d)}</span><span aria-hidden className="absolute inset-y-0.5 left-0 rounded-sm bg-[var(--accent)]/15" style={{ width: `${(l.lecturas / max) * 100}%` }} /></span>
                <span className="text-xs font-semibold tabular-nums">{nfCO.format(l.lecturas)}</span>
              </button>
            </li>
          ))}
        </ol>
        {sinUbicar > 0 && <p className="mt-2 text-[0.7rem] text-[var(--fg-muted)]">{nfCO.format(sinUbicar)} lecturas sin departamento (fuera de Colombia o sin geolocalización).</p>}
      </div>
    </div>
  );
}
