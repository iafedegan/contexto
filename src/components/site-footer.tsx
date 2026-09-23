import Link from "next/link";
import type { NavItem } from "@/components/site-header";
import { THEME_LABEL, type Theme } from "@/lib/theme";
import { DEFAULT_IDENTITY, type SiteIdentity } from "@/lib/site-identity";
import { DEFAULT_LOCALE, localePath, t, type Locale } from "@/lib/i18n";
import { MENU_SECUNDARIO } from "@/content/institucional";

/**
 * Menú secundario completo del §2.2: institucional, legal y comercial. Vive en
 * el pie porque es donde el lector lo busca, y en el menú «Más» de la cabecera.
 */
function legalLinks(locale: Locale) {
  return MENU_SECUNDARIO.map((m) => ({
    href: localePath(locale, `/${m.slug}`),
    label: m.label[locale],
  }));
}

/** Herramientas del portal: canales de sindicación y acceso al panel. */
function toolLinks(locale: Locale) {
  return [
    { href: localePath(locale, "/buscar"), label: t(locale, "nav.search") },
    { href: "/feed.xml", label: "RSS" },
    { href: "/sitemap.xml", label: "Sitemap" },
    { href: "/llms.txt", label: "llms.txt" },
    { href: "/panel", label: t(locale, "footer.panel") },
  ];
}

const YEAR = new Date().getFullYear();


/** Un footer por plantilla: mismo contenido legal, puesta en escena distinta. */
export function SiteFooter({
  theme,
  nav,
  locale = DEFAULT_LOCALE,
  identity = DEFAULT_IDENTITY,
}: {
  theme: Theme;
  nav: NavItem[];
  locale?: Locale;
  identity?: SiteIdentity;
}) {
  const LEGAL = legalLinks(locale);
  const TOOLS = toolLinks(locale);
  const ARCHIVE_NOTE = t(locale, "footer.archiveNote");
  const props = { nav, theme, locale, LEGAL, TOOLS, ARCHIVE_NOTE, SITE_NAME: identity.name };
  switch (theme) {
    case "home":
    case "esmeralda":
    case "clasico":
      return <GrandFooter {...props} />;
    case "revista":
      return <AtelierFooter {...props} />;
    case "compacto":
      return <CopperFooter {...props} />;
    case "vanguardia":
      return <AuroraFooter {...props} />;
    case "articulo":
      return <ColophonFooter {...props} />;
    case "seccion":
      return <CopperFooter {...props} />;
    case "autor":
      return <AtelierFooter {...props} />;
    case "buscar":
      return <StatusFooter {...props} />;
    case "asistente":
      return <AuroraFooter {...props} />;
    case "institucional":
      return <SealFooter {...props} />;
    default:
      return <SepiaFooter {...props} />;
  }
}

type FooterProps = {
  SITE_NAME: string;
  nav: NavItem[];
  theme: Theme;
  locale: Locale;
  LEGAL: Array<{ href: string; label: string }>;
  TOOLS: Array<{ href: string; label: string }>;
  ARCHIVE_NOTE: string;
};

function Signature({ theme, locale = "es" }: { theme: Theme; locale?: Locale }) {
  return (
    <span className="lx-kicker text-[0.58rem] text-[var(--fg-muted)] opacity-70">
      {t(locale, "footer.template")} «{THEME_LABEL[theme]}»
    </span>
  );
}

/* ------------------------------------------------------------------ HOME */
function GrandFooter({ nav, theme, locale, LEGAL, TOOLS, ARCHIVE_NOTE, SITE_NAME }: FooterProps) {
  return (
    <footer className="relative mt-24 border-t border-[var(--border)] bg-[var(--bg-2)]">
      <div
        aria-hidden
        className="h-px w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
      />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <div>
            <span className="lx-display lx-foil text-3xl font-semibold">{SITE_NAME}</span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--fg-muted)]">
{t(locale, "footer.blurb")}
            </p>
            <Link href={localePath(locale, "/asistente")} className="lx-btn mt-6">
              {t(locale, "footer.consultArchive")}
            </Link>
          </div>
          <FooterColumn title={t(locale, "footer.sections")} items={nav.map((n) => ({ ...n, href: localePath(locale, n.href) }))} />
          <FooterColumn title={t(locale, "footer.institutional")} items={LEGAL.slice(0, 4)} />
          <FooterColumn title={t(locale, "footer.legal")} items={LEGAL.slice(4)} />
          <FooterColumn title={t(locale, "footer.tools")} items={TOOLS} />
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-xs text-[var(--fg-muted)]">
          <p>
            © {YEAR} {SITE_NAME}. {ARCHIVE_NOTE}
          </p>
          <Signature theme={theme} locale={locale} />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <h2 className="lx-kicker text-[var(--accent)]">{title}</h2>
      <ul className="mt-4 flex flex-col gap-2.5 text-sm text-[var(--fg-muted)]">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="lx-link">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- ARTÍCULO */
function ColophonFooter({ theme, locale, LEGAL, ARCHIVE_NOTE, SITE_NAME }: FooterProps) {
  return (
    <footer className="mt-24 border-t border-[var(--border)] bg-[var(--bg-2)]">
      <div className="mx-auto max-w-2xl px-6 py-14 text-center">
        <span className="lx-display text-2xl italic text-[var(--accent)]">{SITE_NAME}</span>
        <hr className="lx-rule mx-auto my-6 w-24" />
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
          {LEGAL.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="lx-link lx-ui">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs leading-relaxed text-[var(--fg-muted)]">
          © {YEAR} {SITE_NAME}. {ARCHIVE_NOTE}
        </p>
        <div className="mt-3">
          <Signature theme={theme} locale={locale} />
        </div>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------------- SECCIÓN */
function CopperFooter({ nav, theme, locale, LEGAL, ARCHIVE_NOTE, SITE_NAME }: FooterProps) {
  return (
    <footer className="relative mt-24 overflow-hidden rounded-t-[3rem] border-t border-[var(--border)] bg-[var(--bg-2)]">
      <span
        aria-hidden
        className="lx-display pointer-events-none absolute -bottom-10 -right-6 text-[11rem] font-extrabold leading-none text-[var(--accent)] opacity-[0.07]"
      >
        CG
      </span>
      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <h2 className="lx-display text-4xl font-extrabold tracking-tight">
              <span className="text-[var(--accent)]">{t(locale, "footer.sections")}</span>
            </h2>
            <div className="mt-6 flex flex-wrap gap-2">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={localePath(locale, n.href)}
                  className="lx-ui rounded-full border border-[var(--border)] px-4 py-1.5 text-xs transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-[var(--fg-muted)]">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="lx-link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--fg-muted)]">
          <p>
            © {YEAR} {SITE_NAME}. {ARCHIVE_NOTE}
          </p>
          <Signature theme={theme} locale={locale} />
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ AUTOR */
function AtelierFooter({ theme, locale, LEGAL, ARCHIVE_NOTE, SITE_NAME }: FooterProps) {
  return (
    <footer className="mt-28 border-t border-[var(--border)] bg-[var(--bg-2)]">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="lx-display text-2xl font-light italic leading-relaxed text-[var(--fg)]">
          {t(locale, "footer.quote")}
        </p>
        <div className="mx-auto mt-8 flex max-w-xs items-center gap-4">
          <span className="h-px flex-1 bg-[var(--border-strong)]/50" />
          <span className="lx-display text-sm tracking-[0.4em] uppercase text-[var(--accent)]">
            {SITE_NAME}
          </span>
          <span className="h-px flex-1 bg-[var(--border-strong)]/50" />
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-light tracking-[0.12em] text-[var(--fg-muted)]">
          {LEGAL.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="lx-link">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-[var(--fg-muted)]">
          © {YEAR} {SITE_NAME}. {ARCHIVE_NOTE}
        </p>
        <div className="mt-3">
          <Signature theme={theme} locale={locale} />
        </div>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------------- BUSCADOR */
function StatusFooter({ theme, locale, LEGAL, SITE_NAME }: FooterProps) {
  return (
    <footer className="mt-20 border-t border-[var(--border)] bg-[var(--bg-2)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-6 text-[0.7rem] text-[var(--fg-muted)]">
        <span className="lx-mono flex items-center gap-2 text-[var(--accent)]">
          <span className="lx-pulse size-1.5 rounded-full bg-[var(--accent)]" />
          index: pgvector + fts_es
        </span>
        <span className="lx-mono">archivo: read-only</span>
        {LEGAL.map((l) => (
          <Link key={l.href} href={l.href} className="lx-link lx-mono">
            {l.label.toLowerCase()}
          </Link>
        ))}
        <span className="lx-mono ml-auto">© {YEAR} {SITE_NAME}</span>
        <Signature theme={theme} locale={locale} />
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------- ASISTENTE */
function AuroraFooter({ theme, locale, LEGAL, SITE_NAME }: FooterProps) {
  return (
    <footer className="relative mt-20">
      <div
        aria-hidden
        className="mx-auto h-px max-w-3xl bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
      />
      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
{t(locale, "footer.assistantNote")}
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[var(--fg-muted)]">
          {LEGAL.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="lx-link">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[0.7rem] text-[var(--fg-muted)]">
          © {YEAR} {SITE_NAME}
        </p>
        <div className="mt-2">
          <Signature theme={theme} locale={locale} />
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------- INSTITUCIONAL */
function SealFooter({ theme, locale, LEGAL, ARCHIVE_NOTE, SITE_NAME }: FooterProps) {
  return (
    <footer className="mt-24 border-t-2 border-[var(--accent)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 md:grid-cols-[auto_1fr]">
        <span className="grid size-16 place-items-center rounded-full border border-[var(--accent)] text-sm tracking-[0.1em] text-[var(--accent)]">
          CG
        </span>
        <div>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
{t(locale, "footer.about")} {ARCHIVE_NOTE}
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="lx-link lx-ui">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--fg-muted)]">
            <span>© {YEAR} {SITE_NAME}</span>
            <Signature theme={theme} locale={locale} />
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- ARCHIVO */
function SepiaFooter({ theme, locale, LEGAL, SITE_NAME }: FooterProps) {
  return (
    <footer className="mt-20 border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-8 text-xs text-[var(--fg-muted)]">
        <span className="lx-display tracking-[0.2em] uppercase text-[var(--accent)]">{SITE_NAME}</span>
        {LEGAL.map((l) => (
          <Link key={l.href} href={l.href} className="lx-link">
            {l.label}
          </Link>
        ))}
        <span className="ml-auto">© {YEAR}</span>
        <Signature theme={theme} locale={locale} />
      </div>
    </footer>
  );
}
