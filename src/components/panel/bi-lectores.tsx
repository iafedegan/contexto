import Link from "next/link";
import { BadgeCheck, Smartphone, Monitor, Tablet, X } from "lucide-react";
import { Card } from "@/components/ui";
import { duracion, horaEtiqueta } from "@/lib/lectores-formato";
import type { Lector, Registro } from "@/lib/lectores-detalle";
import { nfCO } from "@/lib/format";

/**
 * Detalle de la lectura: quién (el código del navegador o, si autorizó, su nombre), de dónde, a qué hora, qué nota, cuánto
 * tiempo y hasta dónde bajó, y con qué dispositivo. Dos vistas: por lector y por lectura.
 */
const TZ = "America/Bogota";
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
const DISPOSITIVO: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tableta", otro: "Otro" };

function Dispositivo({ d }: { d: string | null }) {
  const Icono = d === "mobile" ? Smartphone : d === "tablet" ? Tablet : Monitor;
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Icono size={14} aria-hidden className="text-[var(--fg-muted)]" /> {DISPOSITIVO[d ?? "otro"] ?? d}</span>;
}

// Barra de «cuánto leyó»: el porcentaje del texto al que bajó.
function Barra({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, pct)}%` }} /></span>
      {Math.round(pct)} %
    </span>
  );
}

function Quien({ codigo, nombre, correo }: { codigo: string; nombre?: string | null; correo?: string | null }) {
  return nombre || correo ? (
    <span className="inline-flex flex-col leading-tight">
      <span className="inline-flex items-center gap-1 font-semibold"><BadgeCheck size={13} aria-hidden className="text-[#157a4a]" /> {nombre || correo}</span>
      {nombre && correo && <span className="text-xs text-[var(--fg-muted)]">{correo}</span>}
    </span>
  ) : (
    <span className="lx-mono text-xs text-[var(--fg-muted)]" title="Lector anónimo: código aleatorio de su navegador">Lector {codigo}</span>
  );
}

export function TablaLectores({ lectores, total, enlace }: { lectores: Lector[]; total: number; enlace: (id: string) => string }) {
  if (!lectores.length) return <p className="text-sm text-[var(--fg-muted)]">Ninguna lectura con estos filtros.</p>;
  return (
    <>
      <p className="mb-3 text-sm text-[var(--fg-muted)]">{nfCO.format(total)} {total === 1 ? "lector" : "lectores"} con estos filtros{total > lectores.length ? `; se muestran los ${lectores.length} que más leyeron` : ""}. Pulsa uno para ver cada nota que leyó.</p>
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <caption className="sr-only">Lectores con lo que leyeron en el periodo</caption>
          <thead>
            <tr className="border-b border-[var(--border-strong)] text-left text-xs text-[var(--fg-muted)]">
              {["Lector", "Ciudad", "Dispositivo", "Notas", "Días", "Tiempo", "Leyó", "Hora habitual", "Sección", "Origen", "Última vez"].map((t, i) => (
                <th key={t} scope="col" className={`px-2 py-2 font-semibold ${i >= 3 && i <= 5 ? "text-right" : ""}`}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lectores.map((l) => (
              <tr key={l.id} className="border-b border-[var(--border)] align-middle hover:bg-[var(--surface-2)]">
                <td className="px-2 py-2.5"><Link href={enlace(l.id)} className="underline-offset-2 hover:underline"><Quien codigo={l.codigo} nombre={l.nombre} correo={l.correo} /></Link></td>
                <td className="px-2 py-2.5">{l.ciudad ?? "—"}</td>
                <td className="px-2 py-2.5"><Dispositivo d={l.dispositivo} /></td>
                <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{l.notas}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{l.dias}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{duracion(l.segundos)}</td>
                <td className="px-2 py-2.5"><Barra pct={l.scroll} /></td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{l.horaHabitual === null ? "—" : horaEtiqueta(l.horaHabitual)}</td>
                <td className="px-2 py-2.5">{l.seccion ?? "—"}</td>
                <td className="px-2 py-2.5">{l.fuente ?? "—"}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-[var(--fg-muted)]">{fecha(l.ultima)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TablaRegistro({ registros, vacio = "Ninguna lectura con estos filtros." }: { registros: Registro[]; vacio?: string }) {
  if (!registros.length) return <p className="text-sm text-[var(--fg-muted)]">{vacio}</p>;
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <caption className="sr-only">Lecturas una por una, de la más reciente a la más antigua</caption>
        <thead>
          <tr className="border-b border-[var(--border-strong)] text-left text-xs text-[var(--fg-muted)]">
            {["Cuándo", "Lector", "Ciudad", "Nota", "Tiempo", "Leyó", "Dispositivo", "Navegador", "Origen"].map((t, i) => (
              <th key={t} scope="col" className={`px-2 py-2 font-semibold ${i === 4 ? "text-right" : ""}`}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {registros.map((r, i) => (
            <tr key={`${r.lector}-${r.cuando}-${i}`} className="border-b border-[var(--border)] align-middle hover:bg-[var(--surface-2)]">
              <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{fecha(r.cuando)}</td>
              <td className="px-2 py-2.5"><Quien codigo={r.codigo} nombre={r.nombre} /></td>
              <td className="px-2 py-2.5">{r.ciudad ?? "—"}</td>
              <td className="max-w-[22rem] px-2 py-2.5"><a href={`/articulo/${r.slug}`} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium underline-offset-2 hover:underline">{r.titulo}</a>{r.seccion && <span className="text-xs text-[var(--fg-muted)]">{r.seccion}{r.recurrente ? " · ya lo había visitado" : " · primera visita"}</span>}</td>
              <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{duracion(r.segundos)}</td>
              <td className="px-2 py-2.5"><Barra pct={r.scroll} /></td>
              <td className="px-2 py-2.5"><Dispositivo d={r.dispositivo} /></td>
              <td className="whitespace-nowrap px-2 py-2.5 text-[var(--fg-muted)]">{[r.navegador, r.sistema].filter(Boolean).join(" · ") || "—"}</td>
              <td className="px-2 py-2.5">{r.fuente ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EncabezadoLector({ codigo, nombre, cerrar }: { codigo: string; nombre?: string | null; cerrar: string }) {
  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <p className="text-sm">Viendo solo lo que leyó <strong>{nombre || `el lector ${codigo}`}</strong></p>
      <Link href={cerrar} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 text-sm font-semibold hover:bg-[var(--surface-2)]"><X size={14} aria-hidden /> Ver todos</Link>
    </Card>
  );
}
