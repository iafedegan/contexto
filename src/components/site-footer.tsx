import Link from "next/link";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "CONtexto Ganadero";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--line)] bg-[var(--surface-2)]">
      <div className="mx-auto max-w-[var(--maxw)] px-4 py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 text-[15px] font-extrabold text-[var(--ink)]">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--brand)] text-[11px] font-black text-[var(--brand-fg)]">
                CG
              </span>
              {SITE_NAME}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              Noticias, análisis y datos del sector ganadero y agropecuario de Colombia. El archivo
              histórico permanece disponible en sus URLs originales.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-[var(--ink-soft)]">
            <Link href="/politica-editorial" className="hover:text-[var(--brand)]">
              Política editorial
            </Link>
            <Link href="/asistente" className="hover:text-[var(--brand)]">
              Asistente
            </Link>
            <Link href="/feed.xml" className="hover:text-[var(--brand)]">
              RSS
            </Link>
            <Link href="/sitemap.xml" className="hover:text-[var(--brand)]">
              Sitemap
            </Link>
            <Link href="/llms.txt" className="hover:text-[var(--brand)]">
              llms.txt
            </Link>
            <Link href="/panel" className="hover:text-[var(--brand)]">
              Panel editorial
            </Link>
          </nav>
        </div>
        <p className="mt-10 border-t border-[var(--line)] pt-6 text-xs text-[var(--ink-faint)]">
          © {new Date().getFullYear()} {SITE_NAME}.
        </p>
      </div>
    </footer>
  );
}
