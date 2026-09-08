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
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-extrabold text-[var(--brand)]">Panel · CONtexto Ganadero</span>
          <nav className="flex gap-3 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-[var(--link)]">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-[var(--fg-muted)]">
            <span>
              {session.user.name} · {session.user.role}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/panel/login" });
              }}
            >
              <button className="underline">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
