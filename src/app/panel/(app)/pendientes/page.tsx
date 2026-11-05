import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, ChevronRight, ClipboardList, Send } from "lucide-react";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui";
import { MarcarVistos } from "@/components/panel/marcar-vistos";
import { sincronizarCasillas } from "@/lib/ai/consejo-ejecucion";
import { contarMisPendientes, misPendientes } from "./consultas";
import { misAsignaciones } from "@/app/panel/(app)/asignaciones/consultas";
import { ESTADOS_PENDIENTES } from "@/lib/notas-asignadas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis pendientes" };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  planificada: { texto: "Por redactar", clase: "bg-[var(--surface-2)] text-[var(--fg-muted)]" },
  redactando: { texto: "Redactando", clase: "bg-amber-500/15 text-amber-700" },
  revision: { texto: "Para revisar", clase: "bg-[var(--accent)]/15 text-[var(--accent)]" },
  fallida: { texto: "Falló", clase: "bg-red-600/15 text-red-700" },
};
const cuando = (d: Date) => new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(d);

// Lo que le «llegó» a quien entra y debe revisar o escribir: las piezas de los consejos activos del grupo de redacción y las notas que le
// enviaron los redactores o los administradores (desde el asistente o desde «Notas para editores») y siguen sin publicar.
export default async function MisPendientes() {
  const session = await auth();
  if (!session?.user) redirect("/panel/login?motivo=sesion");
  await sincronizarCasillas().catch(() => {});
  const [lista, { nuevas }, { paraMi }] = await Promise.all([misPendientes(session.user.id), contarMisPendientes(session.user.id), misAsignaciones(session.user.id)]);
  const paraRevisar = lista.filter((p) => p.estado === "revision").length;
  const enviadas = paraMi.filter((f) => (ESTADOS_PENDIENTES as readonly string[]).includes(f.estado));
  const nada = lista.length === 0 && enviadas.length === 0;
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <MarcarVistos hayNuevas={nuevas > 0} />
      <header>
        <p className="lx-kicker text-[var(--accent)]">Grupo de redacción</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Mis pendientes</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {nada
            ? "No tienes pendientes por ahora."
            : [
                lista.length ? `${lista.length} ${lista.length === 1 ? "pieza del grupo de redacción" : "piezas del grupo de redacción"}${paraRevisar ? ` (${paraRevisar} para revisar)` : ""}` : "",
                enviadas.length ? `${enviadas.length} ${enviadas.length === 1 ? "nota que te enviaron" : "notas que te enviaron"}` : "",
              ].filter(Boolean).join(" · ") + "."}
        </p>
      </header>

      {/* Notas que le enviaron (redactores y administradores): van primero, porque ya están escritas y esperan revisión. */}
      {enviadas.length > 0 && (
        <section aria-label="Notas que te enviaron" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Notas que te enviaron</h2>
          <ul className="flex flex-col gap-3">
            {enviadas.map((f) => (
              <li key={f.articleId}>
                <Link href={`/panel/articulos/${f.articleId}?modo=manual&paso=vista`} className="group block rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-2">
                  <Card className="lx-shine flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition group-hover:border-[var(--border-strong)] sm:p-5">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                        <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 font-semibold text-[var(--accent)]">{f.estado === "en_revision" ? "Para revisar" : "Borrador"}</span>
                        <span className="inline-flex items-center gap-1"><Send size={12} aria-hidden /> De <span className="font-medium text-[var(--fg)]">{f.por}</span></span>
                      </p>
                      <p className="mt-1 text-base font-semibold leading-snug">{f.titulo}</p>
                      {f.mensaje && <p className="mt-0.5 text-sm text-[var(--fg-muted)]">«{f.mensaje}»</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">Revisar la nota <ChevronRight size={16} aria-hidden className="transition group-hover:translate-x-0.5" /></span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {enviadas.length > 0 && lista.length > 0 && <h2 className="text-lg font-semibold">Piezas del grupo de redacción</h2>}
      {nada ? (
        <Card className="flex items-center gap-3 p-6 text-sm text-[var(--fg-muted)]">
          <ClipboardList size={20} aria-hidden /> Cuando el grupo de redacción te asigne una pieza o alguien te envíe una nota, aparecerá aquí con un punto rojo en el menú.
        </Card>
      ) : lista.length === 0 ? null : (
        <ul className="flex flex-col gap-3">
          {lista.map((p) => {
            const e = ESTADO[p.estado] ?? ESTADO.planificada;
            const href = p.articleId ? `/panel/articulos/${p.articleId}?modo=ia&paso=vista` : `/panel/articulos/nuevo?modo=ia&pieza=${p.id}`;
            return (
              <li key={p.id}>
                <Link href={href} className="group block rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-2">
                  <Card className="lx-shine flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition group-hover:border-[var(--border-strong)] sm:p-5">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                        <span className={`rounded-full px-2.5 py-0.5 font-semibold ${e.clase}`}>{e.texto}</span>
                        <span className="font-medium text-[var(--fg)]">{p.seccion}</span>
                      </p>
                      <p className="mt-1 text-base font-semibold leading-snug">{p.tema || "Sin tema"}</p>
                      <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{p.plan}</p>
                      {p.estado === "fallida" && p.error && <p className="mt-1 text-xs text-red-700">{p.error}</p>}
                    </div>
                    <p className="flex items-center gap-1.5 text-sm text-[var(--fg-muted)]"><CalendarClock size={15} aria-hidden /> Sale <span className="font-medium capitalize text-[var(--fg)]">{cuando(p.publicaEn)}</span></p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">{p.articleId ? "Seguir con la nota" : "Escribir esta nota"} <ChevronRight size={16} aria-hidden className="transition group-hover:translate-x-0.5" /></span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
