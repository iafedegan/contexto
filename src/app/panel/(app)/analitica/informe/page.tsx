import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { requirePermiso } from "@/lib/auth";
import { leerFiltros } from "@/lib/lectores-filtros";
import { panorama, type Desglose } from "@/lib/lectores-consulta";
import { panoramaSuscriptores } from "@/lib/suscriptores-consulta";
import { resumenSuperApp } from "@/lib/superapp/personas";
import { configSuperApp } from "@/lib/superapp/config";
import { informeEquipo, type PapelNota, type PersonaInforme } from "@/lib/informe-equipo";
import { duracion, variacionPct } from "@/lib/lectores-formato";
import { nfCO as nf } from "@/lib/format";
import { etiquetaRol } from "@/lib/notas-asignadas-reglas";
import { ESTADO_LABEL } from "@/lib/estados";
import { BotonImprimir } from "@/components/panel/boton-imprimir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Informe" };

type Q = Record<string, string | string[] | undefined>;

const PAPEL: Record<PapelNota, { texto: string; clase: string }> = {
  autor: { texto: "La escribió", clase: "bg-[#157a4a]/12 text-[#0f5a37]" },
  intervino: { texto: "Intervino", clase: "bg-[#b26a00]/12 text-[#7a4a00]" },
  reviso: { texto: "Revisó", clase: "bg-[#2f5f9e]/12 text-[#1f4377]" },
  "sin-abrir": { texto: "Sin abrir", clase: "bg-black/5 text-[var(--fg-muted)]" },
  participo: { texto: "Participó", clase: "bg-black/5 text-[var(--fg-muted)]" },
};

const fecha = (d: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

function Seccion({ titulo, kicker, children }: { titulo: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] print:border-black/20 print:shadow-none">
      <p className="lx-kicker text-[var(--accent)]">{kicker}</p>
      <h2 className="lx-display mt-0.5 text-xl font-semibold">{titulo}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Cifras({ items }: { items: { t: string; v: string; d?: number | null }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.t} className="rounded-[var(--radius)] bg-[var(--surface-2)]/60 p-3">
          <dt className="text-xs text-[var(--fg-muted)]">{i.t}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{i.v}</dd>
          {i.d != null && <dd className={`text-xs font-semibold ${i.d >= 0 ? "text-[#157a4a]" : "text-[#b4232a]"}`}>{i.d >= 0 ? "▲" : "▼"} {Math.abs(i.d).toFixed(0)} % vs. periodo anterior</dd>}
        </div>
      ))}
    </dl>
  );
}

function Tabla({ cab, filas }: { cab: string[]; filas: (string | number)[][] }) {
  if (!filas.length) return <p className="text-sm text-[var(--fg-muted)]">Sin datos en el periodo.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead><tr>{cab.map((c, i) => <th key={c} className={`border-b border-[var(--border)] px-2 py-1.5 text-xs font-semibold text-[var(--fg-muted)] ${i ? "text-right" : "text-left"}`}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((f, n) => <tr key={n} className="odd:bg-[var(--surface-2)]/40">{f.map((v, i) => <td key={i} className={`px-2 py-1.5 ${i ? "text-right tabular-nums" : ""}`}>{typeof v === "number" ? nf.format(v) : v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const desg = (l: Desglose[], n = 8) => l.slice(0, n).map((d) => [d.clave, d.lecturas, d.visitantes]);

function csvEquipo(p: PersonaInforme[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const filas = [["Persona", "Rol", "Nota", "Estado", "Papel", "Palabras cambiadas", "Comentarios", "Publicó", "Envió", "Última acción"]];
  for (const x of p) for (const n of x.notas) filas.push([x.nombre, etiquetaRol(x.rol), n.titulo, ESTADO_LABEL[n.estado as keyof typeof ESTADO_LABEL] ?? n.estado, PAPEL[n.papel].texto, String(n.palabras), String(n.comentarios), n.publico ? "sí" : "", n.envio ? "sí" : "", n.ultima.slice(0, 16)]);
  return `data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + filas.map((f) => f.map(esc).join(";")).join("\n"))}`;
}

/**
 * Informe completo del periodo: audiencia, lectores, suscriptores, SuperApp y lo que hizo cada persona del equipo en las notas (las que
 * escribió, las que le enviaron y en cuántas intervino o solo revisó, lo que publicó y comentó). Se imprime o se guarda en PDF, y el detalle
 * del equipo se descarga en CSV para Excel.
 */
export default async function Informe({ searchParams }: { searchParams: Promise<Q> }) {
  await requirePermiso("analitica");
  const q = await searchParams;
  const f = leerFiltros(q);
  const soloPersona = typeof q.persona === "string" ? q.persona : "";
  const fp = { desde: f.desde, hasta: f.hasta };
  const [p, s, sa, equipoTodo] = await Promise.all([
    panorama(f),
    panoramaSuscriptores(fp),
    configSuperApp() ? resumenSuperApp(fp).catch(() => null) : Promise.resolve(null),
    informeEquipo(f.desde, f.hasta),
  ]);
  const equipo = soloPersona ? equipoTodo.filter((x) => x.id === soloPersona) : equipoTodo;
  const i = p.indicadores;
  const a = p.anterior;
  const enlace = (extra: Record<string, string>) => `/panel/analitica/informe?${new URLSearchParams({ desde: f.desde, hasta: f.hasta, ...extra })}`;

  return (
    <div className="flex flex-col gap-5 print:gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/panel/analitica?desde=${f.desde}&hasta=${f.hasta}`} className="lx-link inline-flex items-center gap-1 text-sm print:hidden"><ArrowLeft size={14} aria-hidden /> Volver al análisis</Link>
          <p className="lx-kicker mt-2 text-[var(--accent)]">Informe</p>
          <h1 className="lx-display text-3xl font-semibold tracking-tight sm:text-4xl">Del {fecha(f.desde)} al {fecha(f.hasta)}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Audiencia, lectores, suscriptores, SuperApp y el trabajo del equipo en las notas.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <form className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col gap-1"><span className="text-xs text-[var(--fg-muted)]">Desde</span><input type="date" name="desde" defaultValue={f.desde} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" /></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-[var(--fg-muted)]">Hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" /></label>
            {soloPersona && <input type="hidden" name="persona" value={soloPersona} />}
            <button className="rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-1.5 font-medium">Ver</button>
          </form>
          <BotonImprimir />
        </div>
      </header>

      <Seccion kicker="Equipo" titulo="Quién hizo qué en las notas">
        <p className="-mt-2 mb-3 text-xs text-[var(--fg-muted)]">
          «Intervino»: le enviaron la nota y cambió el texto (15 palabras o más). «Revisó»: la abrió y no la cambió, o solo corrigió detalles. Las ediciones se cuentan desde que se activó este registro; los envíos, comentarios y notas escritas, desde siempre.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm print:hidden">
          <a href={csvEquipo(equipo)} download={`equipo-${f.desde}-${f.hasta}.csv`} className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-1.5 font-medium"><Download size={14} aria-hidden /> Descargar detalle (Excel)</a>
          {soloPersona && <Link href={enlace({})} className="lx-link">Ver a todo el equipo</Link>}
        </div>
        <Tabla
          cab={["Persona", "Escribió", "Le enviaron", "Intervino", "Revisó", "Sin abrir", "Palabras cambiadas", "Publicó", "Envió", "Comentarios"]}
          filas={equipo.map((x) => [`${x.nombre} · ${etiquetaRol(x.rol)}`, x.creadas, x.recibidas, x.intervino, x.reviso, x.sinAbrir, x.palabras, x.publicadas + x.programadas, x.enviadas, x.comentarios])}
        />
        <div className="mt-5 flex flex-col gap-4">
          {equipo.map((x) => (
            <details key={x.id} open className="break-inside-avoid rounded-[var(--radius)] border border-[var(--border)] p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {x.nombre} <span className="font-normal text-[var(--fg-muted)]">· {etiquetaRol(x.rol)} · {x.notas.length} notas{x.recibidas ? ` · de ${x.recibidas} que le enviaron, intervino en ${x.intervino} y revisó ${x.reviso}` : ""}</span>
                {!soloPersona && <Link href={enlace({ persona: x.id })} className="lx-link ml-2 text-xs font-normal print:hidden">solo esta persona</Link>}
              </summary>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {x.notas.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-baseline gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAPEL[n.papel].clase}`}>{PAPEL[n.papel].texto}</span>
                    <Link href={`/panel/articulos/${n.id}`} className="font-medium hover:text-[var(--accent)]">{n.titulo}</Link>
                    <span className="text-xs text-[var(--fg-muted)]">
                      {ESTADO_LABEL[n.estado as keyof typeof ESTADO_LABEL] ?? n.estado}
                      {n.palabras ? ` · ${nf.format(n.palabras)} palabras cambiadas` : ""}
                      {n.comentarios ? ` · ${n.comentarios} comentario${n.comentarios === 1 ? "" : "s"}` : ""}
                      {n.publico ? " · la publicó" : ""}
                      {n.envio ? " · la envió" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {!equipo.length && <p className="text-sm text-[var(--fg-muted)]">Nadie trabajó en notas en este periodo.</p>}
        </div>
      </Seccion>

      <Seccion kicker="Audiencia" titulo="Lecturas y lectores">
        <Cifras items={[
          { t: "Lecturas medidas", v: nf.format(i.lecturas), d: variacionPct(i.lecturas, a.lecturas) },
          { t: "Visitantes", v: nf.format(i.visitantes), d: variacionPct(i.visitantes, a.visitantes) },
          { t: "Tiempo medio", v: duracion(i.segundosMedios), d: variacionPct(i.segundosMedios, a.segundosMedios) },
          { t: "Leídas completas", v: nf.format(i.completas), d: variacionPct(i.completas, a.completas) },
        ]} />
        <p className="mt-2 text-xs text-[var(--fg-muted)]">Visitas totales contadas: {nf.format(p.lecturasTotales)} · recurrentes {nf.format(i.recurrentes)} · rebotes {nf.format(i.rebotes)} · scroll medio {Math.round(i.scrollMedio)} %.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div><h3 className="mb-2 text-sm font-semibold">Notas más leídas</h3><Tabla cab={["Nota", "Lecturas", "Visitantes", "Tiempo"]} filas={p.notas.slice(0, 15).map((n) => [n.titulo, n.lecturas, n.visitantes, duracion(n.segundos)])} /></div>
          <div><h3 className="mb-2 text-sm font-semibold">Secciones</h3><Tabla cab={["Sección", "Lecturas", "Visitantes"]} filas={desg(p.categorias, 12)} /></div>
          <div><h3 className="mb-2 text-sm font-semibold">De dónde llegan</h3><Tabla cab={["Origen", "Lecturas", "Visitantes"]} filas={desg(p.fuentes)} /></div>
          <div><h3 className="mb-2 text-sm font-semibold">Dispositivos</h3><Tabla cab={["Dispositivo", "Lecturas", "Visitantes"]} filas={desg(p.dispositivos)} /></div>
          <div><h3 className="mb-2 text-sm font-semibold">Países</h3><Tabla cab={["País", "Lecturas", "Visitantes"]} filas={desg(p.paises, 10)} /></div>
          <div><h3 className="mb-2 text-sm font-semibold">Ciudades</h3><Tabla cab={["Ciudad", "Lecturas", "Visitantes"]} filas={desg(p.ciudades, 10)} /></div>
        </div>
      </Seccion>

      <Seccion kicker="Suscriptores" titulo="Boletín">
        <Cifras items={[
          { t: "Activos", v: nf.format(s.resumen.activos) },
          { t: "Altas del periodo", v: nf.format(s.resumen.altasPeriodo), d: variacionPct(s.resumen.altasPeriodo, s.resumen.altasAnterior) },
          { t: "Bajas del periodo", v: nf.format(s.resumen.bajasPeriodo) },
          { t: "Sin confirmar", v: nf.format(s.resumen.pendientes) },
        ]} />
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div><h3 className="mb-2 text-sm font-semibold">Ciudades</h3><Tabla cab={["Ciudad", "Suscriptores"]} filas={s.ciudades.map((c) => [c.clave, c.n])} /></div>
          <div><h3 className="mb-2 text-sm font-semibold">Edades</h3><Tabla cab={["Edad", "Suscriptores"]} filas={s.edades.map((c) => [c.clave, c.n])} /></div>
        </div>
      </Seccion>

      {sa && (
        <Seccion kicker="SuperApp" titulo="Entradas desde la SuperApp">
          <Cifras items={[
            { t: "Personas", v: nf.format(sa.personas) },
            { t: "Nuevas", v: nf.format(sa.nuevas) },
            { t: "Entradas", v: nf.format(sa.entradas) },
            { t: "Lecturas", v: nf.format(sa.lecturas) },
          ]} />
          <p className="mt-2 text-xs text-[var(--fg-muted)]">{nf.format(sa.suscritas)} ya están suscritas al boletín · {nf.format(sa.lectores)} leyeron notas · {duracion(sa.segundos)} de lectura en total.</p>
        </Seccion>
      )}
    </div>
  );
}
