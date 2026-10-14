"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";
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

  return (
    <section aria-label="A quién va esta edición" className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold"><Users size={15} aria-hidden className="text-[var(--accent)]" /> ¿A quién va?</h3>
          <p className="text-xs text-[var(--fg-muted)]">{describirAudiencia(valor, nombreCiudad, nombrePais)}</p>
        </div>
        <span className="rounded-full bg-[var(--accent)]/12 px-3 py-1 text-sm font-semibold tabular-nums text-[var(--accent)]" role="status" aria-live="polite">
          {cuantos} {cuantos === 1 ? "persona" : "personas"}
        </span>
      </div>

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
            className={`rounded-full px-3 py-1 transition disabled:cursor-not-allowed ${grupo === g ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <MapaSuscriptores
        ciudades={opciones.ciudades}
        seleccionadas={valor.ciudades}
        bloqueada={bloqueada}
        alAlternar={(clave) => {
          setModoGrupo(true);
          poner({ ciudades: alternar(valor.ciudades, clave) });
        }}
      />

      {grupo && (
        <div className="flex flex-col gap-3">
          <Grupo titulo="Temas de interés" ayuda={`${opciones.conTemas} de ${opciones.total} han elegido temas`}>
            {TEMAS_INTERES.map((t) => (
              <Opcion key={t.id} activa={valor.temas.includes(t.id)} texto={t.es} n={nTema(t.id)} deshabilitada={bloqueada} alPulsar={() => poner({ temas: alternar(valor.temas, t.id) })} />
            ))}
          </Grupo>
          <Grupo titulo="Ciudad" ayuda="la que escribieron al suscribirse o, si no, la de su conexión">
            {opciones.ciudades.length === 0 && <span className="text-xs text-[var(--fg-muted)]">Aún no hay ciudades registradas.</span>}
            {opciones.ciudades.map((c) => (
              <Opcion key={c.clave} activa={valor.ciudades.includes(c.clave)} texto={c.nombre} n={c.n} deshabilitada={bloqueada} alPulsar={() => poner({ ciudades: alternar(valor.ciudades, c.clave) })} />
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
