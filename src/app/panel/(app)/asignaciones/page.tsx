import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { Card } from "@/components/ui";
import { TabsConsejo } from "@/components/panel/tabs-consejo";
import { AsignarNotaForm } from "@/components/panel/asignar-nota-form";
import { editoresParaAsignar, misAsignaciones, type FilaAsignada } from "./consultas";
import { ESTADOS_PENDIENTES, puedeEnviarAEditor, recibeNotas } from "@/lib/notas-asignadas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notas para editores" };

const ESTADO: Record<string, string> = { borrador: "Borrador", en_revision: "En revisión", programado: "Programada", publicado: "Publicada", archivado: "Archivada" };
const cuando = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(new Date(iso));

// Una fila de la lista: título, estado y a quién va o de quién viene; lleva al editor de la nota.
function Fila({ f, de }: { f: FilaAsignada; de: "por" | "para" }) {
  return (
    <li>
      <Link href={`/panel/articulos/${f.articleId}?modo=manual`} className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3 transition hover:border-[var(--accent)]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{f.titulo}</span>
          <span className="block text-xs text-[var(--fg-muted)]">
            {de === "para" ? `De ${f.por}` : `Para ${f.editor}`} · {cuando(f.fecha)} · {ESTADO[f.estado] ?? f.estado}
          </span>
          {f.mensaje && <span className="mt-1 block text-xs">{f.mensaje}</span>}
        </span>
        <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--fg-muted)]" />
      </Link>
    </li>
  );
}

// Preescribir una nota y asignarla al editor que se elija, y ver lo que le asignaron a uno y lo que uno asignó.
export default async function NotasParaEditores() {
  const yo = await requirePermiso("notas_editores");
  // Envían los administradores y los redactores; el editor recibe. Cualquier otro rol no tiene nada que hacer aquí.
  const envia = puedeEnviarAEditor(yo.role);
  const recibe = recibeNotas(yo.role);
  if (!envia && !recibe) redirect("/panel");
  const [editores, secciones, { paraMi: todasParaMi, porMi }] = await Promise.all([
    editoresParaAsignar(yo.id),
    db.select({ id: categories.id, nombre: categories.name }).from(categories).orderBy(asc(categories.name)),
    misAsignaciones(yo.id),
  ]);
  // A quien recibe solo le quedan a la vista las pendientes (borrador o en revisión); las publicadas o archivadas salen de la lista.
  const paraMi = todasParaMi.filter((f) => (ESTADOS_PENDIENTES as readonly string[]).includes(f.estado));
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* El administrador llega desde el «Grupo de redacción» y vuelve a sus otras pestañas; un editor solo ve esta página. */}
      {yo.role === "administrador" && <TabsConsejo activa="notas" abiertas={0} notas={paraMi.length} />}
      <header>
        <p className="lx-kicker text-[var(--accent)]">Para editores</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Notas para editores</h1>
        <p className="mt-2 max-w-2xl text-[var(--fg-muted)]">
          {envia
            ? "Escribe una nota (o su esquema) y déjasela al editor que elijas: le llega en «Artículos», la termina, la revisa y la publica él. Nada se publica solo. También puedes enviar una nota desde el asistente de redacción («Sección y autor»)."
            : "Las notas que te enviaron los redactores y los administradores: ábrelas, revísalas y publícalas. Nada se publica solo."}
        </p>
      </header>
      {envia && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Asignar una nota</h2>
          <AsignarNotaForm editores={editores} secciones={secciones} />
        </Card>
      )}
      <div className={`grid gap-5 ${envia && recibe ? "lg:grid-cols-2" : ""}`}>
        {recibe && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Pendientes para mí <span className="text-sm font-normal text-[var(--fg-muted)]">({paraMi.length})</span></h2>
          {paraMi.length ? <ul className="flex flex-col gap-2">{paraMi.map((f) => <Fila key={f.articleId} f={f} de="para" />)}</ul> : <p className="text-sm text-[var(--fg-muted)]">No tienes notas pendientes.</p>}
        </Card>
        )}
        {envia && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Las que asigné <span className="text-sm font-normal text-[var(--fg-muted)]">({porMi.length})</span></h2>
          {porMi.length ? <ul className="flex flex-col gap-2">{porMi.map((f) => <Fila key={f.articleId} f={f} de="por" />)}</ul> : <p className="text-sm text-[var(--fg-muted)]">Todavía no has asignado ninguna.</p>}
        </Card>
        )}
      </div>
    </div>
  );
}
