import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, ChevronRight, ClipboardList } from "lucide-react";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui";
import { misPendientes } from "./consultas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis pendientes" };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  planificada: { texto: "Por redactar", clase: "bg-[var(--surface-2)] text-[var(--fg-muted)]" },
  redactando: { texto: "Redactando", clase: "bg-amber-500/15 text-amber-700" },
  revision: { texto: "Para revisar", clase: "bg-[var(--accent)]/15 text-[var(--accent)]" },
  fallida: { texto: "Falló", clase: "bg-red-600/15 text-red-700" },
};
const cuando = (d: Date) => new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(d);

// Las piezas de los consejos de redacción activos que le tocan a quien entra: lo que le «llegó» y debe revisar o escribir.
export default async function MisPendientes() {
  const session = await auth();
  if (!session?.user) redirect("/panel/login?motivo=sesion");
  const lista = await misPendientes(session.user.id);
  const paraRevisar = lista.filter((p) => p.estado === "revision").length;
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Consejo de redacción</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Mis pendientes</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {lista.length === 0 ? "No tienes piezas asignadas por ahora." : `${lista.length} ${lista.length === 1 ? "pieza asignada" : "piezas asignadas"}${paraRevisar ? ` · ${paraRevisar} para revisar` : ""}. Salen en el orden en que se publican.`}
        </p>
      </header>

      {lista.length === 0 ? (
        <Card className="flex items-center gap-3 p-6 text-sm text-[var(--fg-muted)]">
          <ClipboardList size={20} aria-hidden /> Cuando un consejo activo te asigne una pieza, aparecerá aquí y recibirás un aviso.
        </Card>
      ) : (
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
