import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { LogoMark } from "@/components/logo-mark";
import { users } from "@/db/schema";
import { auth, cuentaPorId, signOut } from "@/lib/auth";
import { PanelNav, PanelSidebarNav } from "@/components/panel/panel-nav";
import { HeaderHeightVar } from "@/components/panel/header-height";
import { IrASeguridad } from "@/components/panel/ir-a-seguridad";
import { efectivos, exige2fa } from "@/lib/permisos";
import { getAjustes } from "@/lib/permisos-server";

/** Panel editorial — plantilla «Grafito & Jade». */
export const dynamic = "force-dynamic";

// Pantalla a la que se envía a quien debe activar su segundo factor.
const RUTA_SEGURIDAD = "/panel/configuracion";

// Estructura del panel: comprueba la sesión, obliga a activar el segundo factor si corresponde y pinta el menú según los permisos.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/panel/login?motivo=sesion");

  /**
   * El segundo factor es obligatorio para TODAS las cuentas, sin excepción
   * de rol. Mientras una cuenta no lo tenga activo, se le bloquea el resto
   * del panel y solo puede ver Configuración → Seguridad de mi cuenta, para
   * poder activarlo — así una cuenta nueva (que siempre arranca sin 2FA)
   * nunca queda sin forma de entrar.
   */
  // Por id y, si el id de la sesión no aparece, por correo (como requireRole):
  // sin esto una sesión con id desfasado se saltaba la exigencia de 2FA.
  // La cuenta y los ajustes de permisos se piden a la vez (y la cuenta ya viene resuelta de la sesión: no es otro viaje).
  const [yoPorId, ajustes, cabeceras] = await Promise.all([cuentaPorId(session.user.id), getAjustes(), headers()]);
  let yo: { totpEnabled: boolean } | undefined = yoPorId;
  if (!yo && session.user.email) {
    [yo] = await db
      .select({ totpEnabled: users.totpEnabled })
      .from(users)
      .where(eq(users.email, session.user.email.toLowerCase().trim()));
  }
  const pathname = cabeceras.get("x-pathname") ?? "";
  const ajustesYo = ajustes[session.user.id];
  const debeActivar2fa = yo != null && !yo.totpEnabled && exige2fa(session.user.role, ajustesYo);
  // Sin `redirect()`: ver IrASeguridad. Mientras la cuenta no tenga 2FA, fuera
  // de Configuración no se renderiza el contenido (solo la ida a Seguridad) y
  // dentro se oculta el menú para que no pueda salir de ahí.
  const permisos = efectivos(session.user.role, ajustesYo);
  const bloqueado = debeActivar2fa && !pathname.startsWith(RUTA_SEGURIDAD);

  // La cuenta (nombre, «Ver sitio», «Salir») va en la barra en escritorio y dentro del menú en el teléfono.
  const cuenta = (
    <>
      <span className="lx-chip max-w-full truncate border-[var(--border)] text-[var(--fg-muted)]">
        {session.user.name} · {session.user.role}
      </span>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-medium text-[var(--fg-muted)] transition hover:text-[var(--accent)] lg:min-h-0"
      >
        Ver sitio
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/panel/login" });
        }}
      >
        <button className="min-h-11 rounded-[var(--radius)] border border-[var(--border-strong)] px-4 font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] lg:min-h-0 lg:px-3 lg:py-1.5">
          Salir
        </button>
      </form>
    </>
  );

  const inicial = (session.user.name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div data-theme="panel" className="lx-shell">
      {/* Barra lateral (escritorio): azul marino con la navegación agrupada y la cuenta al pie. */}
      <aside data-theme="panel-header" className="peer/sb group/sb fixed inset-y-0 left-0 z-50 hidden w-16 flex-col gap-6 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#16315c,#0f2347)] px-3 py-6 text-[var(--fg)] shadow-[8px_0_30px_-18px_rgba(10,25,60,0.6)] transition-[width] duration-200 ease-out hover:w-64 focus-within:w-64 lg:flex">
        <Link href="/panel" className="flex items-center gap-3 rounded-xl px-1">
          <span className="shrink-0"><LogoMark size={36} /></span>
          <span className="lx-display whitespace-nowrap text-base font-semibold leading-tight opacity-0 transition-opacity duration-150 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">Panel editorial</span>
        </Link>
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl p-0 transition-[padding,background-color] group-hover/sb:bg-white/8 group-hover/sb:p-3 group-focus-within/sb:bg-white/8 group-focus-within/sb:p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-lg font-bold text-[var(--accent-fg)]">{inicial}</span>
          <div className="min-w-0 opacity-0 transition-opacity duration-150 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">
            <p className="truncate text-sm font-semibold">{session.user.name}</p>
            <p className="truncate text-xs capitalize text-[var(--fg-muted)]">{session.user.role}</p>
          </div>
        </div>
        {!debeActivar2fa && <PanelSidebarNav role={session.user.role} permisos={permisos} />}
        <div className="mt-auto flex items-center justify-between gap-2 whitespace-nowrap border-t border-white/10 pt-4 text-sm opacity-0 transition-opacity duration-150 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">
          <Link href="/" className="font-medium text-[var(--fg-muted)] transition hover:text-white">Ver sitio</Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/panel/login" }); }}>
            <button className="rounded-lg border border-white/25 px-3 py-1.5 font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]">Salir</button>
          </form>
        </div>
      </aside>
      {/* Al desplegarse el menú lateral (cursor o foco encima) el contenido se encoge en vez de quedar tapado. */}
      <div className="flex min-h-dvh flex-col transition-[padding-left] duration-200 ease-out lg:pl-16 lg:peer-hover/sb:pl-64 lg:peer-focus-within/sb:pl-64">
      {/* La barra del panel va en claro (tema `panel-ui`), igual que la barra
          del editor de portada: es cromo de herramienta, no parte del sitio.
          El contenido de cada pantalla conserva su propio tema debajo. */}
      <HeaderHeightVar />
      <header
        data-panel-header
        data-theme="panel-header"
        className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-[var(--shadow)] lg:hidden"
      >
        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-[var(--accent)] via-[var(--accent-2)] to-transparent opacity-70"
        />
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6 lg:flex-wrap lg:gap-5 lg:py-3.5">
          <Link href="/panel" className="flex min-h-11 min-w-0 items-center gap-2.5">
            <LogoMark size={32} />
            <span className="lx-display truncate text-sm font-semibold tracking-tight">
              Panel editorial
            </span>
          </Link>

          {!debeActivar2fa && (
            <PanelNav role={session.user.role} permisos={permisos}>
              {cuenta}
            </PanelNav>
          )}

          {/* Sin 2FA no hay menú: la cuenta (con «Salir») se queda siempre a la vista. */}
          <div className={`ml-auto items-center gap-3 text-xs ${debeActivar2fa ? "flex flex-wrap justify-end" : "hidden"}`}>{cuenta}</div>
        </div>
      </header>

      {/* Lienzo ámbar para TODAS las pantallas del panel (Resumen, Artículos,
          Diseño…): la barra queda como cromo claro y el contenido comparte un
          mismo fondo, en vez de mezclar pantallas claras y oscuras. */}
      <main data-theme="panel-amber" className="lx-pearl-canvas flex-1 text-[var(--fg)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {debeActivar2fa && (
            <p className="mb-6 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--accent)]/40 bg-[var(--surface-2)] p-4 text-sm leading-relaxed">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              La verificación en dos pasos es obligatoria para todas las cuentas. Actívala aquí abajo
              para poder usar el resto del panel.
            </p>
          )}
          {bloqueado ? <IrASeguridad href={`${RUTA_SEGURIDAD}#seguridad`} /> : children}
        </div>
      </main>

      <footer data-theme="panel-amber" className="border-t border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        <p className="mx-auto max-w-6xl text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
          CONtexto Ganadero · plantilla «Grafito & Jade» · ningún contenido de IA se publica sin
          aprobación humana
        </p>
      </footer>
      </div>
    </div>
  );
}
