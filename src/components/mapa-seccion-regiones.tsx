import Link from "next/link";
import { DEPARTAMENTOS, MAPA_ALTO, MAPA_ANCHO } from "@/lib/colombia-mapa";
import { DEPARTAMENTOS_FILTRO, REGIONES_COLOMBIA, departamentoPorSlug, regionPorSlug } from "@/lib/regiones-colombia";
import { localePath, type Locale } from "@/lib/i18n";

/**
 * Mapa interactivo de la sección «Regiones», con el mismo lenguaje visual del Observatorio: tarjeta con rótulo, título en serifa,
 * botones en píldora y el mapa a un lado. Cada región es un enlace (`?region=…`) que filtra las notas, sin JavaScript. Al pasar el
 * puntero por el mapa o por la lista, la región se enciende en los dos; la elegida queda resaltada y las demás se atenúan.
 */
export function MapaSeccionRegiones({ locale, actual: regionParam, departamento }: { locale: Locale; actual?: string; departamento?: string }) {
  const base = localePath(locale, "/categoria/regiones");
  const hrefDe = (slug?: string) => (slug ? `${base}?region=${slug}` : base);
  const hrefDepto = (slug: string) => `${base}?depto=${slug}`;
  const dep = departamentoPorSlug(departamento);
  // Con un departamento elegido, su región también queda activa (los botones y el mapa se leen igual que con una región).
  const actual = dep ? dep.region : regionParam;
  const elegida = regionPorSlug(actual);
  const deptosDeLaRegion = elegida ? DEPARTAMENTOS_FILTRO.filter((d) => d.region === elegida.slug) : [];
  const pildora = "lx-ui inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition lg:min-h-10";
  return (
    <section aria-label="Regiones de Colombia" className="regiones-mapa mb-10 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Zonas ganaderas</p>
          <h2 className="lx-display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{dep ? `Noticias de ${dep.nombre}` : elegida ? `Noticias de la región ${elegida.nombre}` : "Noticias por región"}</h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--fg-muted)] sm:text-base">
            {elegida ? "Toca otra región o un departamento del mapa para cambiar de zona." : "Toca un departamento en el mapa, o elige una región, y verás solo sus noticias."}
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
                  aria-current={on && !dep ? "true" : undefined}
                  className={`${pildora} ${on ? "border-transparent bg-[var(--accent)] font-semibold text-[var(--accent-fg)]" : "border-[var(--border-strong,var(--border))] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
                >
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: r.color }} />
                  {r.nombre}
                </Link>
              );
            })}
          </div>
          {deptosDeLaRegion.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label={`Departamentos de la región ${elegida?.nombre}`}>
              {deptosDeLaRegion.map((d) => (
                <Link key={d.slug} href={hrefDepto(d.slug)} aria-current={departamento === d.slug ? "true" : undefined} className={`lx-ui inline-flex min-h-9 items-center rounded-full border px-3.5 text-xs font-medium transition ${departamento === d.slug ? "border-transparent bg-[var(--accent)] font-semibold text-[var(--accent-fg)]" : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}>
                  {d.nombre}
                </Link>
              ))}
            </div>
          )}
        </div>

        <svg viewBox={`-56 0 ${MAPA_ANCHO + 56} ${MAPA_ALTO}`} role="group" aria-label="Mapa de Colombia por regiones" className="mx-auto block h-auto max-h-[28rem] w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.25)]">
          {DEPARTAMENTOS_FILTRO.filter((d) => d.mapa).map((d) => {
            const trazo = DEPARTAMENTOS.find((x) => x.nombre === d.mapa);
            const r = regionPorSlug(d.region);
            if (!trazo || !r) return null;
            const on = departamento === d.slug;
            // Brillante: el departamento elegido; sin departamento, la región elegida; sin nada, todos algo atenuados.
            const resalta = dep ? on : actual ? actual === d.region : true;
            return (
              <a key={d.slug} href={hrefDepto(d.slug)} aria-label={`Noticias de ${d.nombre}`} aria-current={on ? "true" : undefined} className="group/r outline-none">
                <path d={trazo.d} fill={r.color} stroke={on ? "#fff" : "rgba(255,255,255,0.7)"} strokeWidth={on ? 2 : 0.9} strokeLinejoin="round" className={`cursor-pointer transition-all duration-200 group-hover/r:opacity-100 group-focus-visible/r:opacity-100 ${resalta ? (actual || dep ? "opacity-100" : "opacity-75") : "opacity-25"}`}>
                  <title>{`${d.nombre} · ${r.nombre}`}</title>
                </path>
                {(on || (!dep && actual === d.region && deptosDeLaRegion.length <= 12)) && (
                  <text x={trazo.c[0]} y={trazo.c[1]} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,0.6)" strokeWidth="2" paintOrder="stroke" className="pointer-events-none select-none">
                    {d.nombre}
                  </text>
                )}
              </a>
            );
          })}

          {/* Insular: San Andrés y Providencia, en un recuadro (el archipiélago queda muy al noroeste, fuera del trazo del continente). */}
          {(() => {
            const r = REGIONES_COLOMBIA.find((x) => x.slug === "insular")!;
            const on = actual === r.slug;
            return (
              <g transform="translate(-52 0)">
              <a href={hrefDe(r.slug)} aria-label="Noticias de la región Insular: San Andrés y Providencia" aria-current={on ? "true" : undefined} className="group/r outline-none">
                <rect x="4" y="6" width="104" height="78" rx="8" fill="none" stroke={r.color} strokeWidth="1" strokeDasharray="3 3" className={`transition-opacity ${actual && !on ? "opacity-30" : "opacity-70"} group-hover/r:opacity-100`} />
                <g fill={r.color} stroke="var(--surface)" strokeWidth="1" className={`cursor-pointer transition-all duration-300 group-hover/r:opacity-100 ${actual ? (on ? "opacity-100" : "opacity-30") : "opacity-80"}`}>
                  <title>San Andrés y Providencia · Insular</title>
                  {/* Providencia (arriba, más pequeña) y San Andrés (abajo, alargada). */}
                  <ellipse cx="38" cy="30" rx="5" ry="8" transform="rotate(-12 38 30)" />
                  <ellipse cx="62" cy="55" rx="5" ry="12" transform="rotate(8 62 55)" />
                </g>
                <text x="56" y="19" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,0.55)" strokeWidth="2.2" paintOrder="stroke" className="pointer-events-none select-none">Providencia</text>
                <text x="56" y="80" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,0.55)" strokeWidth="2.2" paintOrder="stroke" className="pointer-events-none select-none">San Andrés</text>
              </a>
              </g>
            );
          })()}
        </svg>
      </div>
    </section>
  );
}
