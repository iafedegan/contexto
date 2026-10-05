/**
 * Bandeja de los formularios públicos. Sin esto los mensajes se quedarían en la
 * base sin que nadie los viera: el formulario no envía correo a nadie.
 */
import { desc } from "drizzle-orm";
import { Mail, Megaphone } from "lucide-react";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { marcarAtendido } from "./actions";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// Bandeja de mensajes de contacto y pauta (exige el permiso «mensajes»).
export default async function MensajesPage() {
  await requirePermiso("mensajes");
  const filas = await db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
    .limit(200);

  const pendientes = filas.filter((f) => !f.handled).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Panel editorial</p>
        <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">Mensajes recibidos</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Formularios de contacto y de pauta comercial. {pendientes} sin atender de {filas.length}.
        </p>
      </header>

      {filas.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--fg-muted)]">
          Todavía no hay mensajes.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filas.map((m) => (
            <li
              key={m.id}
              className={`rounded-[var(--radius-lg)] border bg-[var(--surface)] p-5 shadow-[var(--shadow)] ${
                m.handled ? "border-[var(--border)] opacity-60" : "border-[var(--accent)]/40"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                  {m.kind === "comercial" ? <Megaphone size={12} /> : <Mail size={12} />}
                  {m.kind === "comercial" ? "Pauta" : "Contacto"}
                </span>
                <span className="text-sm font-semibold">{m.name}</span>
                <a href={`mailto:${m.email}`} className="text-sm text-[var(--accent)] underline-offset-4 hover:underline">
                  {m.email}
                </a>
                {m.organization && (
                  <span className="text-sm text-[var(--fg-muted)]">· {m.organization}</span>
                )}
                <time className="ml-auto text-xs text-[var(--fg-muted)]" dateTime={m.createdAt.toISOString()}>
                  {m.createdAt.toLocaleString("es-CO")}
                </time>
              </div>

              {m.subject && <p className="mt-3 text-sm font-medium">{m.subject}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg-muted)]">
                {m.message}
              </p>

              <form action={marcarAtendido} className="mt-4">
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="handled" value={m.handled ? "0" : "1"} />
                <button
                  type="submit"
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {m.handled ? "Marcar como pendiente" : "Marcar como atendido"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
