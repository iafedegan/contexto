import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth, signOut } from "@/lib/auth";
import { PanelNav } from "@/components/panel/panel-nav";
import { HeaderHeightVar } from "@/components/panel/header-height";

/** Panel editorial — plantilla «Grafito & Jade». */
export const dynamic = "force-dynamic";

const RUTA_SEGURIDAD = "/panel/configuracion";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/panel/login");

  /**
   * El segundo factor es obligatorio para TODAS las cuentas, sin excepción
   * de rol. Mientras una cuenta no lo tenga activo, se le bloquea el resto
   * del panel y solo puede ver Configuración → Seguridad de mi cuenta, para
   * poder activarlo — así una cuenta nueva (que siempre arranca sin 2FA)
   * nunca queda sin forma de entrar.
   */
  const [yo] = await db
    .select({ totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, session.user.id));
  const pathname = (await headers()).get("x-pathname") ?? "";
  const debeActivar2fa = yo != null && !yo.totpEnabled;
  if (debeActivar2fa && !pathname.startsWith(RUTA_SEGURIDAD)) {
    redirect(`${RUTA_SEGURIDAD}#seguridad`);
  }

  return (
    <div data-theme="panel" className="lx-shell lx-grain">
      {/* La barra del panel va en claro (tema `panel-ui`), igual que la barra
          del editor de portada: es cromo de herramienta, no parte del sitio.
          El contenido de cada pantalla conserva su propio tema debajo. */}
      <HeaderHeightVar />
      <header
        data-panel-header
        data-theme="panel-ui"
        className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--nav-bg)] text-[var(--fg)]"
      >
        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-[var(--accent)] via-[var(--accent-2)] to-transparent opacity-70"
        />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-6 py-3.5">
          <Link href="/panel" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[var(--radius)] bg-gradient-to-br from-[#4ade9c] to-[#d8b558] text-[0.6rem] font-bold text-[#06170f]">
              CG
            </span>
            <span className="lx-display text-sm font-semibold tracking-tight">
              Panel editorial
            </span>
          </Link>

          <PanelNav />


          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="lx-chip border-[var(--border)] text-[var(--fg-muted)]">
              {session.user.name} · {session.user.role}
            </span>
            <Link href="/" className="font-medium text-[var(--fg-muted)] transition hover:text-[var(--accent)]">
              Ver sitio
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/panel/login" });
              }}
            >
              <button className="rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-1.5 font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Lienzo ámbar para TODAS las pantallas del panel (Resumen, Artículos,
          Diseño…): la barra queda como cromo claro y el contenido comparte un
          mismo fondo, en vez de mezclar pantallas claras y oscuras. */}
      <main data-theme="panel-amber" className="flex-1 bg-[var(--bg)] text-[var(--fg)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          {debeActivar2fa && (
            <p className="mb-6 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--accent)]/40 bg-[var(--surface-2)] p-4 text-sm leading-relaxed">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              La verificación en dos pasos es obligatoria para todas las cuentas. Actívala aquí abajo
              para poder usar el resto del panel.
            </p>
          )}
          {children}
        </div>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-5">
        <p className="mx-auto max-w-6xl text-[0.68rem] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
          CONtexto Ganadero · plantilla «Grafito & Jade» · ningún contenido de IA se publica sin
          aprobación humana
        </p>
      </footer>
    </div>
  );
}
