import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Download, Mail, MailPlus, Newspaper, Settings2, Sparkles, UserMinus, Users } from "lucide-react";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterEditions, newsletterSubscribers } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { getNewsletterSettings, getProviderStatus } from "@/lib/newsletter/settings";
import { createEdition, deleteSubscriber, unsubscribeSubscriber } from "./actions";
import { SettingsForm } from "./settings-form";
import { BorrarEdicion } from "./borrar-edicion";
import { TEMAS_INTERES } from "@/lib/newsletter/audiencia-tipos";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";
// Hasta cinco minutos: el envío por tandas puede tardar.
export const maxDuration = 300;

// Formatea una fecha y hora en español de Colombia.
const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(d) : "—");

// Pantalla del boletín en pestañas: ediciones, suscriptores y ajustes (exige el permiso «newsletter»).
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
  const [{ n: totalEdiciones }] = await db.select({ n: sql<number>`count(*)::int` }).from(newsletterEditions);
  const esAdmin = user.role === "administrador";
  // «Ajustes» (remitente y clave del correo) es solo de administradores: a los demás ni se les muestra.
  const tabs = [
    ["ediciones", "Ediciones", Newspaper, totalEdiciones],
    ["suscriptores", "Suscriptores", Users, counts.activos + counts.pendientes],
    ...(esAdmin ? ([["ajustes", "Ajustes", Settings2, null]] as const) : []),
  ] as const;
  // Quien no es administrador y abre ?tab=ajustes a mano vuelve a las ediciones.
  const pestana = tab === "ajustes" && !esAdmin ? "ediciones" : tab;
  // Cada indicador con su ícono y su tono, para leerlos de un vistazo.
  const indicadores = [
    { l: "Activos", v: counts.activos, ayuda: "reciben el boletín", Icono: CheckCircle2, tono: "text-[#15803d] bg-[#16a34a]/12" },
    { l: "Pendientes de confirmar", v: counts.pendientes, ayuda: "aún no confirman el correo", Icono: Clock, tono: "text-amber-700 bg-amber-500/15" },
    { l: "Bajas", v: counts.bajas, ayuda: "se dieron de baja", Icono: UserMinus, tono: "text-[var(--fg-muted)] bg-[var(--surface-2)]" },
    { l: "Nuevos (30 días)", v: counts.nuevos, ayuda: "se suscribieron este mes", Icono: Sparkles, tono: "text-[var(--accent)] bg-[var(--accent)]/12" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Redactor</p>
          <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">Newsletter</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--fg-muted)]">Arma el boletín con tus mejores notas, cuida su diseño, pruébalo y envíalo a tus suscriptores.</p>
        </div>
        <form action={createEdition}>
          <button className="lx-btn"><MailPlus size={16} aria-hidden /> Nueva edición</button>
        </form>
      </header>

      {!provider.configured && (
        <div role="alert" className="flex flex-wrap items-start gap-3 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-700"><AlertTriangle size={18} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Todavía no se pueden enviar correos</p>
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--fg-muted)]">
              Puedes armar y probar ediciones, pero el envío real necesita conectar el servicio de correo (Resend).{" "}
              {esAdmin ? "Es un paso de unos minutos." : "Pídele a un administrador que lo conecte."}
            </p>
          </div>
          {esAdmin && (
            <Link href="?tab=ajustes" className="lx-btn-ghost shrink-0">Conectar el envío <ArrowRight size={14} aria-hidden /></Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map(({ l, v, ayuda, Icono, tono }) => (
          <div key={l} className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
            <div>
              <p className="text-xs font-medium text-[var(--fg-muted)]">{l}</p>
              <p className="lx-display mt-1 text-3xl font-semibold tabular-nums">{v}</p>
              <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{ayuda}</p>
            </div>
            <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tono}`}><Icono size={17} aria-hidden /></span>
          </div>
        ))}
      </div>

      <nav aria-label="Secciones del newsletter" className="flex flex-wrap gap-1.5 border-b border-[var(--border)] pb-3">
        {tabs.map(([id, label, Icono, n]) => (
          <Link
            key={id}
            href={`?tab=${id}`}
            aria-current={pestana === id ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${pestana === id ? "bg-[var(--accent)] !text-[var(--accent-fg)]" : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"}`}
          >
            <Icono size={15} aria-hidden /> {label}
            {n !== null && <span className={`rounded-full px-1.5 text-xs tabular-nums ${pestana === id ? "bg-white/20" : "bg-[var(--surface-2)]"}`}>{n}</span>}
          </Link>
        ))}
      </nav>

      {pestana === "ediciones" && <Ediciones />}
      {pestana === "suscriptores" && <Suscriptores admin={esAdmin} />}
      {pestana === "ajustes" && esAdmin && (
        <SettingsForm settings={await getNewsletterSettings()} provider={provider} canManage />
      )}
    </div>
  );
}

// Lista de las últimas 50 ediciones, como tarjetas con su estado y sus cifras.
async function Ediciones() {
  const rows = await db.select().from(newsletterEditions).orderBy(desc(newsletterEditions.createdAt)).limit(50);
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border)] px-6 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]"><Mail size={22} aria-hidden /></span>
        <p className="text-base font-semibold">Aún no hay ediciones</p>
        <p className="max-w-sm text-sm text-[var(--fg-muted)]">Crea la primera, elige las notas y ajusta el diseño. Antes de enviarla puedes mandarte una prueba.</p>
        <form action={createEdition}><button className="lx-btn"><MailPlus size={16} aria-hidden /> Crear la primera edición</button></form>
      </div>
    );
  }
  const estado = {
    enviada: { t: "Enviada", c: "bg-[#16a34a]/12 text-[#15803d]" },
    enviando: { t: "Enviando…", c: "bg-amber-500/15 text-amber-700" },
    borrador: { t: "Borrador", c: "bg-[var(--surface-2)] text-[var(--fg-muted)]" },
  } as const;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((e) => {
        const est = estado[e.status as keyof typeof estado] ?? estado.borrador;
        const notas = Array.isArray(e.articleSlugs) ? (e.articleSlugs as string[]).length : 0;
        return (
          <li key={e.id} className="relative">
            <Link href={`/panel/newsletter/${e.id}`} className="group flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] transition hover:border-[var(--accent)] hover:shadow-[var(--shadow-hover)]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-base font-semibold leading-snug">{e.subject}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${est.c}`}>{est.t}</span>
              </div>
              <p className="text-xs text-[var(--fg-muted)]">
                {e.status === "enviada"
                  ? `Enviada el ${fmt(e.sentAt)}`
                  : e.status === "enviando"
                    ? `Envío en curso · ${e.delivered} de ${e.total}`
                    : `Editada el ${fmt(e.updatedAt)}`}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--fg-muted)]">
                <span className="inline-flex items-center gap-1"><Newspaper size={13} aria-hidden /> {notas} {notas === 1 ? "nota" : "notas"}</span>
                {e.status !== "borrador" && <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} aria-hidden /> {e.delivered} entregados{e.failed ? ` · ${e.failed} fallidos` : ""}</span>}
                <span className={`ml-auto inline-flex items-center gap-1 font-semibold text-[var(--accent)] opacity-0 transition group-hover:opacity-100 ${e.status === "borrador" ? "mr-10" : ""}`}>Abrir <ArrowRight size={13} aria-hidden /></span>
              </div>
            </Link>
            {/* Fuera del enlace (un botón no puede ir dentro de un <a>); solo los borradores se pueden eliminar. */}
            {e.status === "borrador" && (
              <div className="absolute bottom-2.5 right-3"><BorrarEdicion id={e.id} asunto={e.subject} /></div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Lista de los últimos 200 suscriptores, con su estado y acciones.
async function Suscriptores({ admin }: { admin: boolean }) {
  const rows = await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(200);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm text-[var(--fg-muted)]">
        <span>Últimos {rows.length} suscriptores</span>
        <Link href="/api/boletin/exportar" prefetch={false} className="lx-btn-ghost !px-3 !py-1.5 text-xs"><Download size={13} aria-hidden /> Exportar CSV</Link>
      </div>
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span>
              {r.firstName || r.lastName ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() + " · " : ""}
              {r.email}
              {(r.city || r.signupCity) && (
                <span className="ml-2 text-xs text-[var(--fg-muted)]">· {r.city || r.signupCity}</span>
              )}
              {Array.isArray(r.interests) && r.interests.length > 0 && (
                <span className="ml-2 text-xs text-[var(--fg-muted)]">· {(r.interests as string[]).map((t) => TEMAS_INTERES.find((x) => x.id === t)?.es ?? t).join(", ")}</span>
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
              <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${r.unsubscribedAt ? "bg-[var(--surface-2)] text-[var(--fg-muted)]" : r.confirmed ? "bg-[#16a34a]/12 text-[#15803d]" : "bg-amber-500/15 text-amber-700"}`}>{r.unsubscribedAt ? "Baja" : r.confirmed ? "Activo" : "Pendiente"}</span> {fmt(r.createdAt)}
              {!r.unsubscribedAt && <form action={unsubscribeSubscriber.bind(null, r.id)}><button className="underline">Dar de baja</button></form>}
              {admin && <form action={deleteSubscriber.bind(null, r.id)}><button className="text-red-600 underline">Eliminar</button></form>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
