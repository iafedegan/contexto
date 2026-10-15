import Link from "next/link";
import { DEPARTAMENTOS, MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";
import { REGIONES_COLOMBIA, regionPorSlug } from "@/lib/regiones-colombia";
import { localePath, type Locale } from "@/lib/i18n";

/**
 * Mapa interactivo de la sección «Regiones», con el mismo lenguaje visual del Observatorio: tarjeta con rótulo, título en serifa,
 * botones en píldora y el mapa a un lado. Cada región es un enlace (`?region=…`) que filtra las notas, sin JavaScript. Al pasar el
 * puntero por el mapa o por la lista, la región se enciende en los dos; la elegida queda resaltada y las demás se atenúan.
 */
export function MapaSeccionRegiones({ locale, actual }: { locale: Locale; actual?: string }) {
  const base = localePath(locale, "/categoria/regiones");
  const hrefDe = (slug?: string) => (slug ? `${base}?region=${slug}` : base);
  const elegida = regionPorSlug(actual);
  const pildora = "lx-ui inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition lg:min-h-10";
  return (
    <section aria-label="Regiones de Colombia" className="regiones-mapa mb-10 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Zonas ganaderas</p>
          <h2 className="lx-display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{elegida ? `Noticias de la región ${elegida.nombre}` : "Noticias por región"}</h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--fg-muted)] sm:text-base">
            {elegida ? "Toca otra región, o el mapa, para cambiar de zona." : "Elige una región en el mapa o en la lista y verás solo sus noticias."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href={hrefDe()} aria-current={!actual ? "true" : undefined} className={`${pildora} ${!actual ? "border-transparent bg-[var(--accent)] font-semibold text-[var(--accent-fg)]" : "border-[var(--border-strong,var(--border))] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}>
              Todas
            </Link>
            {REGIONES_COLOMBIA.map((r) => {
              const on = actual === r.slug;
              return (
                <Link
                  key={r.slug}
                  href={hrefDe(r.slug)}
                  data-region-btn={r.slug}
                  aria-current={on ? "true" : undefined}
                  className={`${pildora} ${on ? "border-transparent bg-[var(--accent)] font-semibold text-[var(--accent-fg)]" : "border-[var(--border-strong,var(--border))] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
                >
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: r.color }} />
                  {r.nombre}
                </Link>
              );
            })}
          </div>
        </div>

        <svg viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`} role="group" aria-label="Mapa de Colombia por regiones" className="mx-auto block h-auto max-h-[28rem] w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.25)]">
          {REGIONES_COLOMBIA.map((r) => {
            const on = actual === r.slug;
            const deptos = DEPARTAMENTOS.filter((d) => r.departamentos.includes(d.nombre));
            if (!deptos.length) return null;
            const cx = deptos.reduce((t, d) => t + d.c[0], 0) / deptos.length;
            const cy = deptos.reduce((t, d) => t + d.c[1], 0) / deptos.length;
            return (
              <a key={r.slug} href={hrefDe(r.slug)} aria-label={`Noticias de la región ${r.nombre}`} aria-current={on ? "true" : undefined} className="group/r outline-none">
                <g
                  fill={r.color}
                  stroke="var(--surface)"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  className={`cursor-pointer transition-all duration-300 group-hover/r:opacity-100 group-focus-visible/r:opacity-100 ${actual ? (on ? "opacity-100" : "opacity-30") : "opacity-75"}`}
                >
                  {deptos.map((d) => (
                    <path key={d.nombre} d={d.d}>
                      <title>{`${d.nombre.charAt(0)}${d.nombre.slice(1).toLowerCase()} · ${r.nombre}`}</title>
                    </path>
                  ))}
                </g>
                <text x={cx} y={cy} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,0.55)" strokeWidth="2.5" paintOrder="stroke" className={`pointer-events-none select-none transition-opacity ${actual && !on ? "opacity-0" : "opacity-95"} group-hover/r:opacity-100`}>
                  {r.nombre}
                </text>
              </a>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
