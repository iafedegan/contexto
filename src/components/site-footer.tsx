import Link from "next/link";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "CONtexto Ganadero";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-[var(--fg-muted)]">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/politica-editorial">Política editorial</Link>
          <Link href="/feed.xml">RSS</Link>
          <Link href="/sitemap.xml">Sitemap</Link>
          <Link href="/llms.txt">llms.txt</Link>
          <Link href="/panel">Panel editorial</Link>
        </div>
        <p className="mt-4">
          © {new Date().getFullYear()} {SITE_NAME}. El archivo histórico permanece disponible en
          sus URLs originales.
        </p>
      </div>
    </footer>
  );
}
