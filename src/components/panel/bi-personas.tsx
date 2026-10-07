import Link from "next/link";
import { BadgeCheck, ChevronRight, Clock3, Mail, ShieldAlert, UserRound } from "lucide-react";
import { Card } from "@/components/ui";
import { duracion, horaEtiqueta, parte } from "@/lib/lectores-formato";
import type { Adopcion, FilaSuscriptor, Lectura } from "@/lib/lectores-identificados";
import { nfCO } from "@/lib/format";

/**
 * Lectores identificados: las personas suscritas que AUTORIZARON expresamente que se relacione su lectura con su suscripción.
 * Qué leyeron, cuánto se demoraron, hasta dónde bajaron, a qué hora y con qué dispositivo. Se ve solo con el permiso de
 * newsletter (muestra correos). El vínculo puede estar «verificado» (probado con un enlace del correo) o «sin verificar».
 */
const DISPOSITIVO: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tableta", otro: "Otro" };
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(iso));
const hace = (iso: string | null) => {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `hace ${m || 1} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
};

// Distintivo del vínculo: con el correo probado o solo desde el formulario.
function Vinculo({ verificado }: { verificado: boolean }) {
  return verificado ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#157a4a]/12 px-2 py-0.5 text-[0.68rem] font-bold text-[#157a4a]"><BadgeCheck size={12} aria-hidden /> Verificado</span>
  ) : (
    <span title="El vínculo salió del formulario: se verifica cuando la persona confirme su suscripción o abra un enlace de su boletín." className="inline-flex items-center gap-1 rounded-full bg-[#b36b00]/12 px-2 py-0.5 text-[0.68rem] font-bold text-[#b36b00]"><ShieldAlert size={12} aria-hidden /> Sin verificar</span>
  );
}

export function AdopcionLectura({ a }: { a: Adopcion }) {
  const pct = parte(a.autorizados, a.suscritos);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="lx-kicker text-[var(--fg-muted)]">Quién se puede analizar</p>
          <p className="lx-display mt-1 text-3xl font-semibold tabular-nums">{nfCO.format(a.autorizados)} <span className="text-lg text-[var(--fg-muted)]">de {nfCO.format(a.suscritos)} suscriptores</span></p>
        </div>
        <p className="text-sm tabular-nums text-[var(--fg-muted)]">{pct.toLocaleString("es-CO", { maximumFractionDigits: 0 })} % autorizó · {nfCO.format(a.vinculados)} con un navegador vinculado</p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} /></div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--fg-muted)]">Solo aparecen las personas que marcaron la casilla de autorización al suscribirse. Sus enlaces del boletín llevan una firma que vincula su navegador con su suscripción, y solo cuentan las lecturas posteriores al vínculo. Quien se da de baja desaparece de aquí.</p>
    </Card>
  );
}

export function TablaPersonas({ filas, base, seleccionado }: { filas: FilaSuscriptor[]; base: string; seleccionado?: string }) {
  if (!filas.length) return <p className="text-sm text-[var(--fg-muted)]">Todavía nadie ha autorizado: la casilla aparece en el formulario de suscripción del sitio.</p>;
  const enlace = (id: string) => `?${base}${base ? "&" : ""}vista=suscriptores&suscriptor=${id}#persona`;
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <caption className="sr-only">Suscriptores que autorizaron, con lo que leyeron en el periodo</caption>
        <thead>
          <tr className="border-b border-[var(--border-strong)] text-left text-xs text-[var(--fg-muted)]">
            {["Persona", "Vínculo", "Notas", "Tiempo", "% leído", "Terminó", "Última lectura", "Hora", "Dispositivo", "Sección"].map((t, i) => (
              <th key={t} scope="col" className={`px-2 py-2 font-semibold ${i >= 2 && i <= 5 ? "text-right" : ""}`}>{t}</th>
            ))}
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.id} className={`border-b border-[var(--border)] align-middle transition hover:bg-[var(--surface-2)] ${seleccionado === p.id ? "bg-[var(--surface-2)]" : ""}`}>
              <th scope="row" className="max-w-[16rem] px-2 py-2.5 text-left font-medium">
                <Link href={enlace(p.id)} className="block truncate hover:text-[var(--accent)]">{p.nombre || p.correo}</Link>
                {p.nombre && <span className="block truncate text-[0.7rem] font-normal text-[var(--fg-muted)]">{p.correo}</span>}
              </th>
              <td className="px-2"><Vinculo verificado={p.verificado} /></td>
              <td className="px-2 text-right tabular-nums"><strong>{nfCO.format(p.notas)}</strong></td>
              <td className="px-2 text-right tabular-nums">{p.notas ? duracion(p.segundos) : "—"}</td>
              <td className="px-2 text-right tabular-nums">{p.notas ? `${Math.round(p.scroll)} %` : "—"}</td>
              <td className="px-2 text-right tabular-nums">{p.notas ? `${nfCO.format(p.completas)}/${nfCO.format(p.notas)}` : "—"}</td>
              <td className="px-2 text-xs text-[var(--fg-muted)]">{hace(p.ultima)}</td>
              <td className="px-2 text-xs tabular-nums">{p.horaHabitual === null ? "—" : horaEtiqueta(p.horaHabitual)}</td>
              <td className="px-2 text-xs">{p.dispositivo ? DISPOSITIVO[p.dispositivo] ?? p.dispositivo : "—"}</td>
              <td className="max-w-[9rem] truncate px-2 text-xs">{p.seccion ?? "—"}</td>
              <td className="pr-1"><Link href={enlace(p.id)} aria-label={`Ver la lectura de ${p.nombre || p.correo}`} className="text-[var(--fg-muted)] hover:text-[var(--accent)]"><ChevronRight size={16} aria-hidden /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FichaPersona({ persona, lecturas, cerrar }: { persona: FilaSuscriptor; lecturas: Lectura[]; cerrar: string }) {
  const total = lecturas.reduce((t, l) => t + l.segundos, 0);
  const completas = lecturas.filter((l) => l.scroll >= 85).length;
  const secciones = new Map<string, number>();
  for (const l of lecturas) secciones.set(l.seccion ?? "Sin sección", (secciones.get(l.seccion ?? "Sin sección") ?? 0) + 1);
  const top = [...secciones].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <Card id="persona" className="scroll-mt-24 border-[var(--accent)]/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]"><UserRound size={22} /></span>
          <div className="min-w-0">
            <h3 className="lx-display truncate text-2xl font-semibold">{persona.nombre || persona.correo}</h3>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)]"><span className="inline-flex items-center gap-1"><Mail size={12} aria-hidden /> {persona.correo}</span>{persona.ciudad && <span>{persona.ciudad}</span>}<span>Suscrita el {persona.alta}</span><Vinculo verificado={persona.verificado} /></p>
          </div>
        </div>
        <Link href={cerrar} className="inline-flex min-h-9 items-center rounded-full border border-[var(--border-strong)] px-4 text-xs font-semibold text-[var(--fg-muted)] transition hover:text-[var(--fg)]">Cerrar</Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Notas leídas", nfCO.format(lecturas.length)], ["Tiempo leyendo", lecturas.length ? duracion(total) : "—"], ["Llegó al final", `${completas} de ${lecturas.length}`], ["Tiempo por nota", lecturas.length ? duracion(total / lecturas.length) : "—"]] as const).map(([t, v]) => (
          <div key={t} className="rounded-[var(--radius)] bg-[var(--surface-2)] p-3"><dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{t}</dt><dd className="lx-display mt-1 text-xl font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>
      {top.length > 0 && <p className="mt-3 text-sm text-[var(--fg-muted)]">Lo que más lee: {top.map(([s, n], i) => <span key={s}>{i > 0 && " · "}<strong className="text-[var(--fg)]">{s}</strong> ({n})</span>)}</p>}
      <h4 className="mt-5 flex items-center gap-2 text-sm font-semibold"><Clock3 size={15} aria-hidden /> Lecturas en el periodo</h4>
      {lecturas.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--fg-muted)]">Sin lecturas en este periodo. Aparecerán cuando esta persona lea con el navegador vinculado.</p>
      ) : (
        <div className="-mx-2 mt-2 overflow-x-auto px-2">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">Notas que leyó esta persona</caption>
            <thead><tr className="border-b border-[var(--border-strong)] text-left text-xs text-[var(--fg-muted)]"><th className="py-2 pr-3 font-semibold">Cuándo</th><th className="px-2 font-semibold">Nota</th><th className="px-2 text-right font-semibold">Tiempo</th><th className="px-2 text-right font-semibold">% leído</th><th className="px-2 font-semibold">Dispositivo</th><th className="px-2 font-semibold">Llegó por</th></tr></thead>
            <tbody>
              {lecturas.map((l) => (
                <tr key={l.cuando + l.slug} className="border-b border-[var(--border)] align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs tabular-nums text-[var(--fg-muted)]">{fecha(l.cuando)}</td>
                  <td className="max-w-[20rem] px-2 py-2"><Link href={`/articulo/${l.slug}`} target="_blank" className="line-clamp-2 font-medium leading-snug hover:text-[var(--accent)]">{l.titulo}</Link>{l.seccion && <span className="text-[0.68rem] uppercase tracking-wider text-[var(--fg-muted)]">{l.seccion}</span>}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{duracion(l.segundos)}</td>
                  <td className="px-2 py-2 text-right tabular-nums"><span className={l.scroll >= 85 ? "font-bold text-[#157a4a]" : ""}>{l.scroll} %</span></td>
                  <td className="px-2 py-2 text-xs">{DISPOSITIVO[l.dispositivo] ?? l.dispositivo}</td>
                  <td className="px-2 py-2 text-xs">{l.fuente ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
