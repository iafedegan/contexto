import Link from "next/link";
import { getAllCategories } from "@/lib/content";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "CONtexto Ganadero";

export async function SiteHeader() {
  let categories: Awaited<ReturnType<typeof getAllCategories>> = [];
  try {
    categories = await getAllCategories();
  } catch {
    /* sin DB en build: header mínimo */
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--paper)_86%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[var(--maxw)] items-center gap-6 px-4 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-[var(--ink)]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand)] text-[13px] font-black text-[var(--brand-fg)]">
            CG
          </span>
          <span className="hidden sm:inline">{SITE_NAME}</span>
        </Link>

        <nav
          className="hidden flex-1 items-center gap-5 text-[13.5px] font-medium text-[var(--ink-soft)] lg:flex"
          aria-label="Secciones"
        >
          {categories.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="transition-colors hover:text-[var(--brand)]"
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 text-sm lg:ml-0">
          <Link
            href="/asistente"
            className="rounded-full px-3 py-1.5 font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            Asistente
          </Link>
          <Link
            href="/buscar"
            aria-label="Buscar"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 py-1.5 font-medium text-[var(--ink)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Buscar
          </Link>
        </div>
      </div>
    </header>
  );
}
