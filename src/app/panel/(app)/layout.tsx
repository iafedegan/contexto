import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/panel", label: "Resumen" },
  { href: "/panel/articulos", label: "Artículos" },
  { href: "/panel/borradores-ia", label: "Borradores IA" },
  { href: "/panel/demanda", label: "Demanda informativa" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/panel/login");

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/panel" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--brand)] text-[11px] font-black text-[var(--brand-fg)]">
              CG
            </span>
            <span className="text-[var(--ink)]">Panel</span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-[13.5px] font-medium">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-full px-3 py-1.5 text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-[13px] text-[var(--ink-faint)]">
            <span className="hidden sm:inline">
              {session.user.name} · <span className="text-[var(--brand)]">{session.user.role}</span>
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/panel/login" });
              }}
            >
              <button className="rounded-full border border-[var(--line-strong)] px-3 py-1 font-medium text-[var(--ink-soft)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
