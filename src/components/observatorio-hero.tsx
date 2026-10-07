import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { CifraAnimada } from "@/components/cifra-animada";
import { DEPARTAMENTOS, MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";
import { pct, tramos, trazoSuave, type Formato } from "@/lib/graficas";
import { colorCalor, normaDepartamento } from "@/lib/mapa-util";
import type { Hallazgo } from "@/lib/observatorio-resumen";

/**
 * Portada del Observatorio: el nombre grande, las cifras clave que cuentan hacia arriba, las frases que se arman solas
 * con lo que dicen los datos y, de fondo, el mapa de Colombia pintado con el inventario por departamento.
 */
export type KpiHero = { etiqueta: string; valor: number; formato: Formato; prefijo?: string; unidad: string; delta: number | null; tendencia: (number | null)[] };

// Línea de tendencia de una cifra clave (se dibuja en el servidor).
function Tendencia({ valores }: { valores: (number | null)[] }) {
  const reales = valores.filter((v): v is number => v !== null);
  if (reales.length < 2) return null;
  const [min, max] = [Math.min(...reales), Math.max(...reales)];
  const x = (i: number) => (i / (valores.length - 1)) * 120;
  const y = (v: number) => 30 - 3 - ((v - min) / (max - min || 1)) * 24;
  return (
    <svg viewBox="0 0 120 30" className="h-9 w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
      {tramos(valores, x, y).map((t, i) => (
        <g key={i}>
          <path d={`${trazoSuave(t)}L${t[t.length - 1].x} 30L${t[0].x} 30Z`} fill="var(--accent)" opacity="0.1" />
          <path d={trazoSuave(t)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  );
}

const ICONO = { sube: TrendingUp, baja: TrendingDown, dato: Sparkles } as const;
const COLOR = { sube: "text-[var(--accent-2)]", baja: "text-[#f87171]", dato: "text-[var(--accent)]" } as const;

export function ObservatorioHero({
  kicker, titulo, intro, actualizado, kpis, hallazgos, tituloHallazgos, mapa,
}: {
  kicker: string;
  titulo: [string, string];
  intro: string;
  actualizado: string | null;
  kpis: KpiHero[];
  hallazgos: Hallazgo[];
  tituloHallazgos: string;
  /** Valor por departamento (nombre normalizado) y el máximo, para el mapa de fondo. */
  mapa: { valores: Record<string, number>; max: number } | null;
}) {
  return (
    <header className="relative isolate overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-br from-[var(--surface-2)] via-[var(--surface)] to-transparent px-5 pb-6 pt-8 sm:px-10 sm:pb-9 sm:pt-12">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 -z-10 size-96 rounded-full bg-[var(--accent)]/10 blur-3xl" />
      {mapa && (
        <svg aria-hidden viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`} className="pointer-events-none absolute right-6 top-1/2 -z-10 hidden h-[88%] -translate-y-1/2 opacity-60 [mask-image:linear-gradient(to_left,black_55%,transparent)] lg:block">
          {DEPARTAMENTOS.map((d) => (
            <path key={d.nombre} d={d.d} fill={colorCalor(mapa.valores[normaDepartamento(d.nombre)], mapa.max)} stroke="var(--bg)" strokeWidth="0.8" strokeLinejoin="round" />
          ))}
        </svg>
      )}

      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg)]/50 px-3.5 py-1.5 text-xs font-semibold text-[var(--fg-muted)] backdrop-blur">
          <span aria-hidden className="lx-pulse size-2 rounded-full bg-[var(--accent-2)]" />
          {kicker}
          {actualizado && <span className="text-[var(--fg)]">· {actualizado}</span>}
        </p>
        <h1 className="lx-display mt-5 text-[2.9rem] font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          {titulo[0]} <span className="lx-foil">{titulo[1]}</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">{intro}</p>
      </div>

      {kpis.length > 0 && (
        <ul className="mt-8 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <li key={k.etiqueta} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)]/55 p-4 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-[var(--border-strong)]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{k.etiqueta}</p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <CifraAnimada valor={k.valor} formato={k.formato} prefijo={k.prefijo} className="lx-display text-3xl font-semibold sm:text-[2.1rem]" />
                {k.delta !== null && (
                  <span className={`text-xs font-bold tabular-nums ${k.delta >= 0 ? "text-[var(--accent-2)]" : "text-[#f87171]"}`}>
                    {k.delta >= 0 ? "▲" : "▼"} {pct(k.delta)}
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--fg-muted)]">{k.unidad}</p>
              <div className="mt-2"><Tendencia valores={k.tendencia} /></div>
            </li>
          ))}
        </ul>
      )}

      {hallazgos.length > 0 && (
        <section aria-label={tituloHallazgos} className="mt-7">
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{tituloHallazgos}</h2>
          <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
            {hallazgos.map((h) => {
              const Icono = ICONO[h.tono];
              return (
                <li key={h.texto} className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)]/45 p-3.5 text-sm leading-relaxed backdrop-blur">
                  <Icono aria-hidden size={18} className={`mt-0.5 shrink-0 ${COLOR[h.tono]}`} />
                  <span>{h.texto}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </header>
  );
}
