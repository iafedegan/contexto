import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CircleCheck, ClipboardList, PenLine, Send, Sparkles, type LucideIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { MarcarVistos } from "@/components/panel/marcar-vistos";
import { sincronizarCasillas } from "@/lib/ai/consejo-ejecucion";
import { contarMisPendientes } from "./consultas";
import { tableroDe, type Columna, type Tarjeta } from "./tablero";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis pendientes" };

const cuando = (d: Date) => new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(d);

const COLUMNAS: { id: Columna; titulo: string; vacia: string; Icono: LucideIcon; tono: string }[] = [
  { id: "pendiente", titulo: "Pendiente", vacia: "Nada por empezar.", Icono: ClipboardList, tono: "bg-red-600" },
  { id: "editando", titulo: "Editando", vacia: "No tienes notas a medio camino.", Icono: PenLine, tono: "bg-amber-500" },
  { id: "publicado", titulo: "Publicado", vacia: "Nada publicado en los últimos 30 días.", Icono: CircleCheck, tono: "bg-[#157a4a]" },
];

const ORIGEN: Record<Tarjeta["origen"], { texto: string; Icono: LucideIcon }> = {
  pieza: { texto: "Grupo de redacción", Icono: Sparkles },
  enviada: { texto: "Te la enviaron", Icono: Send },
  propia: { texto: "Tuya", Icono: PenLine },
};

// Una tarjeta del tablero: de dónde viene, estado, título, contexto y la fecha que importa; lleva a la nota.
function TarjetaNota({ t }: { t: Tarjeta }) {
  const o = ORIGEN[t.origen];
  return (
    <li>
      <Link href={t.href} className="group block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)] transition hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-[var(--fg-muted)]">
          <span className="inline-flex items-center gap-1 font-semibold"><o.Icono size={12} aria-hidden /> {o.texto}</span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${t.alerta ? "bg-red-600/15 text-red-700" : "bg-[var(--surface-2)]"}`}>{t.estado}</span>
        </p>
        <p className="mt-1.5 text-sm font-semibold leading-snug group-hover:text-[var(--accent)]">{t.titulo}</p>
        {t.detalle && <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{t.detalle}</p>}
        {t.mensaje && <p className={`mt-1 line-clamp-2 text-xs ${t.alerta ? "text-red-700" : ""}`}>«{t.mensaje}»</p>}
        {t.fecha && (
          <p className="mt-2 flex items-center gap-1 text-[0.7rem] text-[var(--fg-muted)]">
            <CalendarClock size={12} aria-hidden /> {t.fechaTexto} <span className="font-medium text-[var(--fg)]">{cuando(t.fecha)}</span>
          </p>
        )}
      </Link>
    </li>
  );
}

// «Mis pendientes» como tablero: lo que le toca a quien entra, en tres columnas (pendiente, editando, publicado). Reúne las piezas del grupo de
// redacción, las notas que le enviaron los redactores o los administradores y sus propias notas.
export default async function MisPendientes() {
  const session = await auth();
  if (!session?.user) redirect("/panel/login?motivo=sesion");
  await sincronizarCasillas().catch(() => {});
  const [tarjetas, { nuevas }] = await Promise.all([tableroDe(session.user.id), contarMisPendientes(session.user.id)]);
  const de = (c: Columna) =>
    tarjetas
      .filter((t) => t.columna === c)
      // Pendiente y editando: lo más urgente (o lo que sale antes) arriba; publicado: lo último arriba.
      .sort((a, b) => (c === "publicado" ? (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0) : (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity)));
  const n = (c: Columna) => tarjetas.filter((t) => t.columna === c).length;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <MarcarVistos hayNuevas={nuevas > 0} />
      <header>
        <p className="lx-kicker text-[var(--accent)]">Grupo de redacción</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Mis pendientes</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {n("pendiente")} {n("pendiente") === 1 ? "pendiente" : "pendientes"} · {n("editando")} editando · {n("publicado")} {n("publicado") === 1 ? "publicada" : "publicadas"} en los últimos 30 días.
          Aquí llegan las piezas del grupo de redacción y las notas que te envían.
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {COLUMNAS.map(({ id, titulo, vacia, Icono, tono }) => {
          const lista = de(id);
          return (
            <section key={id} aria-label={titulo} className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)] p-3">
              <h2 className="flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-[0.12em]">
                <span aria-hidden className={`size-2 rounded-full ${tono}`} />
                <Icono size={15} aria-hidden className="text-[var(--fg-muted)]" />
                {titulo}
                <span className="ml-auto rounded-full bg-[var(--surface)] px-2 text-xs tabular-nums text-[var(--fg-muted)]">{lista.length}</span>
              </h2>
              {lista.length ? (
                <ul className="flex flex-col gap-2">{lista.map((t) => <TarjetaNota key={t.clave} t={t} />)}</ul>
              ) : (
                <p className="rounded-[var(--radius)] border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--fg-muted)]">{vacia}</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
