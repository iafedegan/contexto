import Link from "next/link";
import { localePath, t, type Locale } from "@/lib/i18n";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";

/** 404 — plantilla «Sepia & Ámbar», la del archivo histórico. */
async function NotFound({ locale }: { locale: Locale }) {
  const site = await getSiteTheme();
  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="archivo">
      <div className="py-16 text-center">
        <p className="lx-display text-[7rem] font-normal leading-none text-[var(--accent)] opacity-30">
          404
        </p>
        <h1 className="lx-display -mt-6 text-3xl tracking-[0.12em] uppercase md:text-4xl">
          {t(locale, "notFound.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)]">
          {t(locale, "notFound.text")}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href={localePath(locale, "/")} className="lx-btn">
            {t(locale, "notFound.home")}
          </Link>
          <Link href={localePath(locale, "/buscar")} className="lx-btn lx-btn-ghost">
            {t(locale, "notFound.search")}
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}


/** Fábrica: el mismo 404 en cualquier idioma de interfaz. */
export function makeNotFound(locale: Locale) {
  return function NotFoundPage() {
    return NotFound({ locale });
  };
}
