import Link from "next/link";
import { DEPARTAMENTOS, MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";
import { REGIONES_COLOMBIA } from "@/lib/regiones-colombia";
import { localePath, type Locale } from "@/lib/i18n";

/**
 * Mapa interactivo de la sección «Regiones»: cada región natural es un enlace (`?region=…`) que filtra las notas; no necesita JavaScript.
 * Al pasar el puntero sobre el mapa o la lista, la región se resalta en los dos.
 */
export function MapaSeccionRegiones({ locale, actual }: { locale: Locale; actual?: string }) {
  const base = localePath(locale, "/categoria/regiones");
  const hrefDe = (slug?: string) => (slug ? `${base}?region=${slug}` : base);
  return (
    <section aria-label="Regiones de Colombia" className="mb-10 grid items-center gap-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)] p-4 sm:p-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <svg viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`} role="group" aria-label="Mapa de Colombia por regiones" className="mx-auto block h-auto max-h-[26rem] w-full">
        {REGIONES_COLOMBIA.map((r) => {
          const activa = actual === r.slug;
          return (
            <a key={r.slug} href={hrefDe(r.slug)} aria-label={`Notas de la región ${r.nombre}`} aria-current={activa ? "true" : undefined} className="group/r outline-none">
              <g
                fill={r.color}
                stroke="var(--bg-2)"
                strokeWidth="1"
                strokeLinejoin="round"
                className={`cursor-pointer transition-opacity group-hover/r:opacity-100 group-focus-visible/r:opacity-100 ${actual && !activa ? "opacity-35" : "opacity-80"}`}
              >
                {DEPARTAMENTOS.filter((d) => r.departamentos.includes(d.nombre)).map((d) => (
                  <path key={d.nombre} d={d.d}>
                    <title>{`${d.nombre.charAt(0)}${d.nombre.slice(1).toLowerCase()} · ${r.nombre}`}</title>
                  </path>
                ))}
              </g>
            </a>
          );
        })}
      </svg>
      <div className="flex flex-col gap-2">
        <p className="lx-display text-lg font-semibold">Noticias por región</p>
        <Link href={hrefDe()} className={`lx-ui rounded-full px-4 py-2.5 text-sm font-semibold transition ${!actual ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "border border-[var(--border)] hover:border-[var(--accent)]"}`}>
          Todas las regiones
        </Link>
        {REGIONES_COLOMBIA.map((r) => (
          <Link
            key={r.slug}
            href={hrefDe(r.slug)}
            className={`lx-ui flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition ${actual === r.slug ? "font-semibold text-[var(--fg)] ring-2" : "border border-[var(--border)] hover:border-[var(--accent)]"}`}
            style={actual === r.slug ? ({ ["--tw-ring-color" as string]: r.color } as React.CSSProperties) : undefined}
          >
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: r.color }} />
            {r.nombre}
          </Link>
        ))}
      </div>
    </section>
  );
}
