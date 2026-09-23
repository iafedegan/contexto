import Link from "next/link";
import { getTopLevelCategories } from "@/lib/content";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "CONtexto Ganadero";

export async function SiteHeader() {
  let categories: Awaited<ReturnType<typeof getTopLevelCategories>> = [];
  try {
    categories = await getTopLevelCategories();
  } catch {
    // Sin DB en build local: el header se degrada a solo logo + búsqueda.
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-[var(--brand)]">
          {SITE_NAME}
        </Link>
        <nav className="hidden gap-4 text-sm md:flex" aria-label="Secciones">
          {categories.map((c) => (
            <Link key={c.slug} href={`/categoria/${c.slug}`} className="hover:text-[var(--link)]">
              {c.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/asistente" className="hover:text-[var(--link)]">
            Asistente
          </Link>
          <Link
            href="/buscar"
            aria-label="Buscar"
            className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5"
          >
            Buscar
          </Link>
        </div>
      </div>
    </header>
  );
}
