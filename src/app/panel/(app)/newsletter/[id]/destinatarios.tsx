"use client";

import { useState } from "react";
import { Clock, MapPin, Users, X } from "lucide-react";
import { MapaSuscriptores } from "@/components/panel/mapa-suscriptores";
import { AUDIENCIA_VACIA, TEMAS_INTERES, describirAudiencia, esSegmento, type Audiencia } from "@/lib/newsletter/audiencia-tipos";
import type { OpcionesAudiencia } from "@/lib/newsletter/audiencia";

/** Nombre de un país a partir de su código («CO» → «Colombia»). */
export const nombrePais = (codigo: string) => {
  try {
    return new Intl.DisplayNames("es", { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
};

// Opción de un filtro: se activa y se desactiva; muestra cuántas personas hay.
function Opcion({ activa, texto, n, alPulsar, deshabilitada }: { activa: boolean; texto: string; n?: number; alPulsar: () => void; deshabilitada: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      disabled={deshabilitada}
      onClick={alPulsar}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${activa ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--fg)]"}`}
    >
      {texto}
      {n !== undefined && <span className={`tabular-nums ${activa ? "opacity-80" : "opacity-60"}`}>{n}</span>}
    </button>
  );
}

const Grupo = ({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
      {titulo} {ayuda && <span className="font-normal normal-case tracking-normal">· {ayuda}</span>}
    </p>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const alternar = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/**
 * A quién va la edición: todos los suscriptores o un grupo (por tema de interés, ciudad, país o antigüedad). Cada cambio se guarda y
 * muestra al instante cuántas personas la recibirían. Una vez empieza el envío, el público ya no se cambia.
 */
export function Destinatarios({ valor, alCambiar, opciones, cuantos, bloqueada }: { valor: Audiencia; alCambiar: (a: Audiencia) => void; opciones: OpcionesAudiencia; cuantos: number; bloqueada: boolean }) {
  // «Un grupo» sin ningún filtro todavía equivale a todos; el modo se recuerda aparte para no imponer filtros que nadie eligió.
  const [modoGrupo, setModoGrupo] = useState(esSegmento(valor));
  const grupo = modoGrupo || esSegmento(valor);
  const poner = (cambio: Partial<Audiencia>) => alCambiar({ ...valor, ...cambio });
  const nombreCiudad = (clave: string) => opciones.ciudades.find((c) => c.clave === clave)?.nombre ?? clave;
  const nTema = (id: string) => opciones.temas.find((t) => t.id === id)?.n ?? 0;

  const sinNadie = opciones.total === 0;
  const maxCiudad = Math.max(1, ...opciones.ciudades.map((c) => c.n));
  const conMapa = opciones.ciudades.some((c) => c.lat !== null);

  return (
    <section aria-label="A quién va esta edición" className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
      {/* Cabecera: cuánta gente recibiría la edición, con el motivo si es poca o ninguna. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold"><Users size={15} aria-hidden className="text-[var(--accent)]" /> ¿A quién va?</h3>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{describirAudiencia(valor, nombreCiudad, nombrePais)}</p>
        </div>
        <div className="text-right" role="status" aria-live="polite">
          <p className="lx-display text-3xl font-semibold leading-none tabular-nums text-[var(--accent)]">{cuantos}</p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{cuantos === 1 ? "persona la recibe" : "personas la reciben"}</p>
        </div>
      </div>

      {opciones.pendientes > 0 && (
        <p className="flex items-start gap-2 rounded-[var(--radius)] border border-[#e8c98a] bg-[#fdf4e3] px-3 py-2 text-xs leading-relaxed text-[#6b4a12]">
          <Clock size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            <strong>{opciones.pendientes} {opciones.pendientes === 1 ? "suscriptor pendiente" : "suscriptores pendientes"} de confirmar</strong> su correo: todavía no
            {opciones.pendientes === 1 ? " recibe" : " reciben"} boletines y por eso no se cuentan ni salen en el mapa. Quedan activos cuando abran el enlace del correo de confirmación.
          </span>
        </p>
      )}

      {sinNadie ? (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-5 text-center text-sm text-[var(--fg-muted)]">
          Aún no hay suscriptores confirmados. Cuando alguien confirme su correo aparecerá aquí, con su ciudad en el mapa.
        </p>
      ) : (
        <>
          <div role="radiogroup" aria-label="Público" className="flex w-fit gap-1 rounded-full bg-[var(--surface-2)] p-1 text-xs font-semibold">
            {([[false, `Todos (${opciones.total})`], [true, "Un grupo"]] as const).map(([g, t]) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={grupo === g}
                disabled={bloqueada}
                onClick={() => {
                  setModoGrupo(g);
                  if (!g) alCambiar(AUDIENCIA_VACIA);
                }}
                className={`rounded-full px-3.5 py-1.5 transition disabled:cursor-not-allowed ${grupo === g ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {conMapa && (
              <MapaSuscriptores
                ciudades={opciones.ciudades}
                seleccionadas={valor.ciudades}
                bloqueada={bloqueada}
                alAlternar={(clave) => {
                  setModoGrupo(true);
                  poner({ ciudades: alternar(valor.ciudades, clave) });
                }}
              />
            )}

            {/* Ciudades en lista con barra: se ve de un vistazo dónde está la gente y se elige con un toque. */}
            <div className={`flex flex-col gap-2 ${conMapa ? "" : "md:col-span-2"}`}>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                <MapPin size={13} aria-hidden /> Ciudades <span className="font-normal normal-case tracking-normal">· la que escribieron o, si no, la de su conexión</span>
              </p>
              {opciones.ciudades.length === 0 && <p className="text-xs text-[var(--fg-muted)]">Aún no hay ciudades registradas.</p>}
              <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
                {opciones.ciudades.map((c) => {
                  const activa = valor.ciudades.includes(c.clave);
                  return (
                    <li key={c.clave}>
                      <button
                        type="button"
                        aria-pressed={activa}
                        disabled={bloqueada}
                        onClick={() => {
                          setModoGrupo(true);
                          poner({ ciudades: alternar(valor.ciudades, c.clave) });
                        }}
                        className={`relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[var(--radius)] border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed ${activa ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"}`}
                      >
                        <span aria-hidden className={`absolute inset-y-0 left-0 ${activa ? "bg-[var(--accent)]/25" : "bg-[var(--accent)]/10"}`} style={{ width: `${(c.n / maxCiudad) * 100}%` }} />
                        <span className="relative truncate font-medium">{c.nombre}</span>
                        <span className="relative shrink-0 text-xs font-semibold tabular-nums text-[var(--fg-muted)]">{c.n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}

      {!sinNadie && grupo && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3">
          <Grupo titulo="Temas de interés" ayuda={`${opciones.conTemas} de ${opciones.total} han elegido temas`}>
            {TEMAS_INTERES.map((t) => (
              <Opcion key={t.id} activa={valor.temas.includes(t.id)} texto={t.es} n={nTema(t.id)} deshabilitada={bloqueada} alPulsar={() => poner({ temas: alternar(valor.temas, t.id) })} />
            ))}
          </Grupo>
          {opciones.paises.length > 1 && (
            <Grupo titulo="País">
              {opciones.paises.map((p) => (
                <Opcion key={p.codigo} activa={valor.paises.includes(p.codigo)} texto={nombrePais(p.codigo)} n={p.n} deshabilitada={bloqueada} alPulsar={() => poner({ paises: alternar(valor.paises, p.codigo) })} />
              ))}
            </Grupo>
          )}
          <Grupo titulo="Antigüedad">
            {([[null, "Cualquiera"], [7, "Últimos 7 días"], [30, "Últimos 30 días"], [90, "Últimos 90 días"]] as const).map(([d, t]) => (
              <Opcion key={t} activa={valor.nuevosDias === d} texto={t} deshabilitada={bloqueada} alPulsar={() => poner({ nuevosDias: d })} />
            ))}
          </Grupo>
          <p className="text-xs text-[var(--fg-muted)]">
            Dentro de cada grupo basta con una opción (Bogotá <em>o</em> Medellín); entre grupos tienen que cumplirse todos (esa ciudad <em>y</em> ese tema). Quien no eligió temas no recibe las ediciones filtradas por tema.
          </p>
          {!bloqueada && (
            <button type="button" className="lx-link inline-flex w-fit items-center gap-1 text-xs font-semibold" onClick={() => { setModoGrupo(false); alCambiar(AUDIENCIA_VACIA); }}>
              <X size={12} aria-hidden /> Quitar filtros y enviar a todos
            </button>
          )}
        </div>
      )}
    </section>
  );
}
