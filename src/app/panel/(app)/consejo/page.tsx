import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, CalendarRange, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { editorialPlans, editorialSlots } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { ConsejoNuevo } from "@/components/panel/consejo-nuevo";
import { ConsejoBorrar } from "@/components/panel/consejo-borrar";
import { lunesDe, sumarDias } from "@/lib/consejo/plan";

export const metadata = { title: "Consejo de redacción" };
export const dynamic = "force-dynamic";

const ESTADO = { borrador: "Borrador", activo: "Activo", cerrado: "Cerrado" } as const;

/** Lista de consejos de redacción y alta de uno nuevo. */
export default async function ConsejosPage() {
  await requirePermiso("articulos");
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const proximoLunes = sumarDias(lunesDe(hoy), 7);
  const planes = await db
    .select({
      id: editorialPlans.id, title: editorialPlans.title, weekStart: editorialPlans.weekStart, status: editorialPlans.status,
      total: sql<number>`count(${editorialSlots.id}) filter (where ${editorialSlots.status} <> 'omitida')::int`,
      publicadas: sql<number>`count(${editorialSlots.id}) filter (where ${editorialSlots.status} = 'publicada')::int`,
      porAprobar: sql<number>`count(${editorialSlots.id}) filter (where ${editorialSlots.status} = 'revision')::int`,
    })
    .from(editorialPlans)
    .leftJoin(editorialSlots, eq(editorialSlots.planId, editorialPlans.id))
    .groupBy(editorialPlans.id)
    .orderBy(desc(editorialPlans.weekStart))
    .limit(30);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/panel/articulos/nuevo?modo=ia-opciones" className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--accent)]"><ArrowLeft size={15} /> Volver</Link>
        <p className="lx-kicker text-[var(--accent)]">Con asistente de IA</p>
        <h1 className="lx-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Consejo de redacción</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--fg-muted)]">Como en una sala de redacción: se planea la semana (temas, cuántas notas por día y sección, horas de publicación y quién aprueba), y la IA redacta cada pieza a su tiempo. Nada sale sin que un editor lo haya autorizado.</p>
      </div>
      <ConsejoNuevo proximoLunes={proximoLunes} />
      {planes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {planes.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Link href={`/panel/consejo/${p.id}`} className="lx-card group flex min-w-0 flex-1 flex-wrap items-center gap-4 p-4 transition hover:border-[var(--accent)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]"><CalendarRange size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{ESTADO[p.status as keyof typeof ESTADO] ?? p.status} · {p.total} piezas · {p.publicadas} publicadas{p.porAprobar ? ` · ${p.porAprobar} esperan aprobación` : ""}</p>
                </div>
                <ChevronRight size={18} className="text-[var(--accent)]" />
              </Link>
              <ConsejoBorrar id={p.id} titulo={p.title} piezas={p.total} activo={p.status === "activo"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
