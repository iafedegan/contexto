import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterEditions, newsletterSubscribers } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { getNewsletterSettings, getProviderStatus } from "@/lib/newsletter/settings";
import { createEdition, deleteSubscriber, unsubscribeSubscriber } from "./actions";
import { SettingsForm } from "./settings-form";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";
// Hasta cinco minutos: el envío por tandas puede tardar.
export const maxDuration = 300;

// Formatea una fecha y hora en español de Colombia.
const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(d) : "—");

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermiso("newsletter");
  const { tab = "ediciones" } = await searchParams;
  const [counts] = await db
    .select({
      activos: sql<number>`count(*) filter (where confirmed and unsubscribed_at is null)::int`,
      pendientes: sql<number>`count(*) filter (where not confirmed and unsubscribed_at is null)::int`,
      bajas: sql<number>`count(*) filter (where unsubscribed_at is not null)::int`,
      nuevos: sql<number>`count(*) filter (where created_at > now() - interval '30 days')::int`,
    })
    .from(newsletterSubscribers);
  const provider = await getProviderStatus();
  const tabs = [["ediciones", "Ediciones"], ["suscriptores", "Suscriptores"], ["ajustes", "Ajustes"]] as const;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Redactor</p>
          <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">Newsletter</h1>
        </div>
        <form action={createEdition}><button className="lx-btn">Nueva edición</button></form>
      </header>

      {!provider.configured && (
        <div className="rounded-[var(--radius)] border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          El envío de correo aún no está conectado. Ve a <Link href="?tab=ajustes" className="underline">Ajustes</Link> y sigue la guía de Resend.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Activos", counts.activos], ["Pendientes de confirmar", counts.pendientes], ["Bajas", counts.bajas], ["Nuevos (30 días)", counts.nuevos]].map(([l, v]) => (
          <div key={l} className="rounded-[var(--radius)] border border-[var(--border)] p-4">
            <p className="text-xs text-[var(--fg-muted)]">{l}</p>
            <p className="lx-display mt-1 text-3xl font-semibold">{v}</p>
          </div>
        ))}
      </div>

      <nav className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map(([id, label]) => (
          <Link key={id} href={`?tab=${id}`} className={`px-4 py-2 text-sm ${tab === id ? "border-b-2 border-[var(--accent)] font-semibold" : "text-[var(--fg-muted)]"}`}>{label}</Link>
        ))}
      </nav>

      {tab === "ediciones" && <Ediciones />}
      {tab === "suscriptores" && <Suscriptores admin={user.role === "administrador"} />}
      {tab === "ajustes" && (
        <SettingsForm settings={await getNewsletterSettings()} provider={provider} canManage={user.role === "administrador"} />
      )}
    </div>
  );
}

async function Ediciones() {
  const rows = await db.select().from(newsletterEditions).orderBy(desc(newsletterEditions.createdAt)).limit(50);
  if (rows.length === 0) return <p className="text-sm text-[var(--fg-muted)]">Aún no hay ediciones. Crea la primera con «Nueva edición».</p>;
  return (
    <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
      {rows.map((e) => (
        <li key={e.id}>
          <Link href={`/panel/newsletter/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-[var(--surface)]">
            <span className="font-medium">{e.subject}</span>
            <span className="text-xs text-[var(--fg-muted)]">
              {e.status === "enviada" ? `Enviada · ${e.delivered} entregados${e.failed ? ` · ${e.failed} fallidos` : ""} · ${fmt(e.sentAt)}` : e.status === "enviando" ? `Enviando… ${e.delivered}/${e.total}` : `Borrador · ${fmt(e.updatedAt)}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Suscriptores({ admin }: { admin: boolean }) {
  const rows = await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(200);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-sm text-[var(--fg-muted)]">
        <span>Últimos {rows.length} suscriptores</span>
        <Link href="/api/boletin/exportar" prefetch={false} className="underline">Exportar CSV</Link>
      </div>
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span>
              {r.firstName || r.lastName ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() + " · " : ""}
              {r.email}
              {r.signupCity && (
                <span className="ml-2 text-xs text-[var(--fg-muted)]">· {r.signupCity}</span>
              )}
              {r.signupPostal && (
                <span className="ml-2 text-xs text-[var(--fg-muted)]">· C.P. {r.signupPostal}</span>
              )}
              {r.birthDate && (
                <span className="ml-2 text-xs text-[var(--fg-muted)]">
                  · {new Date(`${r.birthDate}T00:00:00`).toLocaleDateString("es-CO", { dateStyle: "medium" })}
                </span>
              )}
              {r.mobile && <span className="ml-2 text-xs text-[var(--fg-muted)]">· {r.mobile}</span>}
            </span>
            <span className="flex items-center gap-3 text-xs text-[var(--fg-muted)]">
              {r.unsubscribedAt ? "Baja" : r.confirmed ? "Activo" : "Pendiente"} · {fmt(r.createdAt)}
              {!r.unsubscribedAt && <form action={unsubscribeSubscriber.bind(null, r.id)}><button className="underline">Dar de baja</button></form>}
              {admin && <form action={deleteSubscriber.bind(null, r.id)}><button className="text-red-600 underline">Eliminar</button></form>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
