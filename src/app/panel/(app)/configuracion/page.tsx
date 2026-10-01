import { asc, eq, or } from "drizzle-orm";
import { BarChart3, Globe, ShieldCheck, Sparkles, Users } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSiteIdentity } from "@/lib/site-identity";
import { UserRow } from "@/components/panel/user-row";
import { AddUserForm } from "@/components/panel/add-user-form";
import { MiPerfilForm } from "@/components/panel/mi-perfil-form";
import { getKeyStatus } from "@/lib/ai-provider";
import { ApiKeyForm } from "@/components/panel/api-key-form";
import { MfaForm } from "@/components/panel/mfa-form";
import { PasskeyForm } from "@/components/panel/passkey-form";
import { listarPasskeys } from "./passkey-actions";
import { ConfigTabs } from "@/components/panel/config-tabs";
import { getAnalyticsStatus } from "@/lib/analytics-server";
import { saveAnalyticsSettings, saveSiteIdentity } from "./actions";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const MONTHLY_BUDGET = env(process.env.ASSISTANT_MONTHLY_BUDGET_USD, "150");
const SESSION_LIMIT = env(process.env.ASSISTANT_SESSION_QUERY_LIMIT, "15");

export default async function ConfiguracionPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "administrador";

  const [identity, keyStatus, analytics, people, misPasskeys] = await Promise.all([
    getSiteIdentity(),
    getKeyStatus(),
    getAnalyticsStatus(),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
        totpEnabled: users.totpEnabled,
      })
      .from(users)
      // Quien no es administrador solo recibe su propia cuenta: la lista de
      // personas no debe viajar al navegador de un editor.
      .where(
        isAdmin
          ? undefined
          : or(eq(users.id, session?.user.id ?? ""), eq(users.email, session?.user.email ?? "")),
      )
      .orderBy(asc(users.name)),
    listarPasskeys(),
  ]);

  const yoMismo = people.find((p) => p.id === session?.user.id || p.email === session?.user.email);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Panel editorial</p>
        <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--fg-muted)]">
          Lo que se cambia aquí afecta a todo el portal: nombre, lema y descripción salen en la
          cabecera, el pie y los metadatos de cada página.
        </p>
      </header>

      <ConfigTabs
        tabs={[
          { id: "sitio", label: "Identidad del sitio", icon: <Globe size={13} /> },
          { id: "usuarios", label: isAdmin ? "Personas y roles" : "Mis datos", icon: <Users size={13} /> },
          { id: "seguridad", label: "Seguridad de mi cuenta", icon: <ShieldCheck size={13} /> },
          { id: "analitica", label: "Analítica y SEO", icon: <BarChart3 size={13} /> },
          { id: "asistente", label: "Asistente y agentes de IA", icon: <Sparkles size={13} /> },
        ]}
      >
      {/* ------------------------------------------------ Identidad del sitio */}
      <Section
        id="sitio"
        icon={<Globe size={14} />}
        title="Identidad del sitio"
        hint={isAdmin ? undefined : "Solo un administrador puede modificarla."}
      >
        <form action={saveSiteIdentity} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" hint="Cabecera, pie y plantilla de títulos">
            <input
              name="name"
              defaultValue={identity.name}
              required
              disabled={!isAdmin}
              className="lx-input"
            />
          </Field>
          <Field label="Lema" hint="Bajo el logotipo de portada">
            <input
              name="tagline"
              defaultValue={identity.tagline}
              disabled={!isAdmin}
              className="lx-input"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción" hint="Meta description por defecto (70–155 car.)">
              <textarea
                name="description"
                defaultValue={identity.description}
                rows={2}
                disabled={!isAdmin}
                className="lx-input resize-y"
              />
            </Field>
          </div>
          <Field label="Dominio canónico" hint="Sin https:// · vacío = el del entorno">
            <input
              name="domain"
              defaultValue={identity.domain}
              placeholder="contextoganadero.com"
              disabled={!isAdmin}
              className="lx-input"
            />
          </Field>

          <Field label="Emisora en directo" hint="URL del stream · vacío = sin botón de radio">
            <input
              name="radioStreamUrl"
              defaultValue={identity.radioStreamUrl}
              placeholder="https://stream.emisora.com/live"
              disabled={!isAdmin}
              className="lx-input"
            />
          </Field>

          {isAdmin && (
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90"
              >
                Guardar cambios
              </button>
            </div>
          )}
        </form>
      </Section>

      {/* ---------------------------------------------------------- Personas */}
      <Section
        id="usuarios"
        icon={<Users size={14} />}
        title={isAdmin ? "Personas y roles" : "Mis datos"}
        hint={isAdmin ? `${people.length} cuentas · redactor < editor < administrador` : "Tu nombre, correo y contraseña"}
      >
        {yoMismo && <MiPerfilForm name={yoMismo.name} email={yoMismo.email} />}

        {isAdmin && (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {["Persona", "Rol", "2FA", "Estado"].map((h) => (
                  <th
                    key={h}
                    className="lx-kicker border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left text-[var(--fg-muted)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <UserRow
                  key={p.id}
                  user={p}
                  canManage={isAdmin && p.id !== session?.user.id}
                  isSelf={p.id === session?.user.id}
                />
              ))}
            </tbody>
          </table>
        </div>
        )}

        {isAdmin && (
          <div className="mt-4">
            <AddUserForm />
          </div>
        )}
      </Section>


      {/* --------------------------------------------- Seguridad de mi cuenta */}
      <Section
        id="seguridad"
        icon={<ShieldCheck size={14} />}
        title="Seguridad de mi cuenta"
        hint="Segundo factor de acceso al panel"
      >
        <MfaForm activo={yoMismo?.totpEnabled ?? false} />
        <PasskeyForm passkeys={misPasskeys} />
      </Section>

      {/* ---------------------------------------------- Analítica y SEO */}
      <Section
        id="analitica"
        icon={<BarChart3 size={14} />}
        title="Analítica y SEO"
        hint="Medición del portal y auditoría de Google antes de publicar"
      >
        <form action={saveAnalyticsSettings} className="grid gap-4 sm:grid-cols-2">
          <Field label="ID de medición GA4" hint="Del tipo G-XXXXXXXXXX · se carga solo en el portal público">
            <input
              name="ga4Id"
              defaultValue={analytics.ga4Id}
              placeholder="G-XXXXXXXXXX"
              disabled={!isAdmin}
              className="lx-mono w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
            />
          </Field>

          <Field label="Contenedor de Google Tag Manager" hint="GTM-XXXXXXX · se carga solo en el portal público">
            <input
              name="gtmId"
              defaultValue={analytics.gtmId}
              placeholder="GTM-XXXXXXX"
              disabled={!isAdmin}
              className="lx-mono w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
            />
          </Field>

          <Field
            label="Verificación de Search Console"
            hint="Pega el código o la etiqueta meta completa"
          >
            <input
              name="searchConsoleToken"
              defaultValue={analytics.searchConsoleToken}
              placeholder="google-site-verification=…"
              disabled={!isAdmin}
              className="lx-mono w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
            />
          </Field>

          <Field
            label="Clave de PageSpeed Insights"
            hint={
              analytics.psiPresent
                ? `Configurada (${analytics.psiMasked}) desde ${analytics.psiSource}`
                : "Gratuita, se genera en Google Cloud"
            }
          >
            <input
              name="psiKey"
              type="password"
              autoComplete="off"
              placeholder={analytics.psiPresent ? "Déjalo vacío para conservar la actual" : "AIza…"}
              disabled={!isAdmin}
              className="lx-mono w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Base pública para auditar"
              hint="Solo en local: el túnel (ngrok y afines) con el que Google puede abrir el sitio"
            >
              <input
                name="publicBaseUrl"
                defaultValue={analytics.publicBaseUrl}
                placeholder="https://mi-tunel.ngrok-free.app"
                disabled={!isAdmin}
                className="lx-mono w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
              />
            </Field>
          </div>

          {isAdmin && (
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90"
              >
                Guardar analítica
              </button>
            </div>
          )}
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="GA4" value={analytics.ga4Id || "Sin configurar"} ok={Boolean(analytics.ga4Id)} />
          <Stat
            label="PageSpeed Insights"
            value={analytics.psiPresent ? `Desde ${analytics.psiSource}` : "Sin configurar"}
            ok={analytics.psiPresent}
          />
          <Stat label="Tag Manager" value={analytics.gtmId || "Sin configurar"} ok={Boolean(analytics.gtmId)} />
          <Stat
            label="Search Console"
            value={analytics.searchConsoleToken ? "Verificado" : "Sin verificar"}
            ok={Boolean(analytics.searchConsoleToken)}
          />
          <Stat label="Base para auditar" value={analytics.publicBaseUrl || identity.domain || "Sin dominio"} />
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-[var(--radius)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--fg-muted)]">
          <ShieldCheck size={14} className="mt-px shrink-0 text-[var(--accent-2)]" />
          GA4 mide el portal <strong>después</strong> de publicar y nunca se carga en el panel ni en
          las vistas previas. PageSpeed audita la nota <strong>antes</strong>: para un borrador se le
          pasa un enlace de vista previa firmado y caducable, con <code className="lx-mono">noindex</code>.
          Google necesita alcanzar la dirección, así que en <code className="lx-mono">localhost</code>{" "}
          solo funciona a través de un túnel.
        </p>
      </Section>

      {/* ------------------------------------------------ Asistente / agentes */}
      <Section
        id="asistente"
        icon={<Sparkles size={14} />}
        title="Asistente y agentes de IA"
        hint="La clave de la API se puede guardar aquí, cifrada"
      >
        <ApiKeyForm status={keyStatus} canManage={isAdmin} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Origen de la clave"
            value={keyStatus.source ? `Desde ${keyStatus.source}` : "Sin configurar"}
            ok={keyStatus.present}
          />
          <Stat label="Modelo" value={keyStatus.model} />
          <Stat label="Presupuesto mensual" value={`US$ ${MONTHLY_BUDGET}`} />
          <Stat label="Tope por sesión" value={`${SESSION_LIMIT} consultas`} />
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-[var(--radius)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--fg-muted)]">
          <ShieldCheck size={14} className="mt-px shrink-0 text-[var(--accent-2)]" />
          Sin clave, el asistente responde en modo búsqueda (recupera y cita fuentes, sin generar) y
          la redacción asistida entrega un esqueleto en vez de inventar hechos. Ningún contenido de
          IA se publica sin la aprobación de un editor.
        </p>
      </Section>
      </ConfigTabs>
    </div>
  );
}

/* ------------------------------------------------------------------ Piezas */

function Section({
  id,
  icon,
  title,
  hint,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]"
    >
      <header className="mb-4 flex flex-wrap items-baseline gap-2">
        <span className="text-[var(--accent)]">{icon}</span>
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {title}
        </h2>
        {hint && <span className="text-xs text-[var(--fg-muted)]">· {hint}</span>}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {label}
        </span>
        {hint && <span className="text-[0.7rem] text-[var(--fg-muted)]/75">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-3">
      <p className="lx-kicker text-[var(--fg-muted)]">{label}</p>
      <p
        className={`mt-1.5 text-sm font-semibold ${
          ok === undefined ? "" : ok ? "text-[var(--accent-2)]" : "text-[var(--danger)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
