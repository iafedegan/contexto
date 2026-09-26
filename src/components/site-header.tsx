import Link from "next/link";
import type { NavbarId } from "@/lib/template-parts";
import { ReadingProgress } from "@/components/reading-progress";
import { LocaleSwitch } from "@/components/locale-switch";
import type { Theme } from "@/lib/theme";
import { DEFAULT_IDENTITY, type SiteIdentity } from "@/lib/site-identity";
import { DEFAULT_LOCALE, INTL_LOCALE, localePath, t, type Locale } from "@/lib/i18n";
import { MoreMenu } from "@/components/more-menu";
import { MobileNav, type MobileLook } from "@/components/mobile-nav";
import { RadioPlayer } from "@/components/radio-player";
import { ThemeToggle } from "@/components/theme-toggle";

export type NavItem = { href: string; label: string };

type Props = {
  theme: Theme;
  nav: NavItem[];
  /** Secciones que no caben en la barra principal (N-04): van al menú «Más». */
  extraNav?: NavItem[];
  locale?: Locale;
  /** Nombre y lema editables en /panel/configuracion. */
  identity?: SiteIdentity;
};

/** Familia de navbar de móvil que corresponde a cada variante o plantilla. */
function mobileLook(theme: Theme, variant?: NavbarId): MobileLook {
  if (variant) return variant;
  switch (theme) {
    case "home":
    case "esmeralda":
    case "clasico":
    case "articulo":
      return "masthead";
    case "revista":
    case "autor":
      return "couture";
    case "vanguardia":
    case "asistente":
      return "glass";
    case "institucional":
      return "crest";
    default:
      return "bold";
  }
}

/**
 * Cabecera del sitio. Debajo de 1024 px se ve el navbar de móvil (barra
 * compacta + menú a pantalla completa) y desde ahí la cabecera de la
 * plantilla; ambas viven en el HTML y se alternan con CSS.
 */
export function SiteHeader(props: Props & { variant?: NavbarId }) {
  const { theme, nav, extraNav = [], locale = DEFAULT_LOCALE, identity = DEFAULT_IDENTITY, variant } = props;
  return (
    <>
      <MobileNav
        look={mobileLook(theme, variant)}
        name={identity.name}
        nav={nav}
        extra={extraNav}
        locale={locale}
        radioStreamUrl={identity.radioStreamUrl}
      />
      {/* `contents`: la cabecera de escritorio sigue siendo `sticky` respecto a la página. */}
      <div className="hidden lg:contents">
        <DesktopHeader {...props} />
      </div>
    </>
  );
}

/** Cada plantilla estrena navbar: estructura, altura, ritmo y efectos propios. */
function DesktopHeader({
  theme,
  nav,
  extraNav = [],
  locale = DEFAULT_LOCALE,
  identity = DEFAULT_IDENTITY,
  variant,
}: Props & { variant?: NavbarId }) {
  // Las secciones sobrantes viajan con el resto de enlaces del menú «Más».
  const masExtra = extraNav;
  const props = { nav, extra: masExtra, locale, identity };
  // Navbar elegido al componer la plantilla: manda sobre el de la paleta.
  switch (variant) {
    case "masthead":
      return <MastheadHeader {...props} />;
    case "couture":
      return <CoutureHeader {...props} />;
    case "bold":
      return <BoldHeader {...props} />;
    case "glass":
      return <GlassHeader {...props} />;
    case "crest":
      return <CrestHeader {...props} />;
  }
  switch (theme) {
    case "home":
    case "esmeralda":
    case "clasico":
      return <MastheadHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "revista":
      return <CoutureHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "compacto":
      return <BoldHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "vanguardia":
      return <GlassHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "articulo":
      return <ReadingHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "seccion":
      return <BoldHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "autor":
      return <CoutureHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "buscar":
      return <CommandHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "asistente":
      return <GlassHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    case "institucional":
      return <CrestHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
    default:
      return <ArchiveHeader nav={nav} extra={masExtra} locale={locale} identity={identity} />;
  }
}

/* ------------------------------------------------------------------ HOME */
function MastheadHeader({ nav, extra, locale, identity }: { nav: NavItem[]; extra: NavItem[]; locale: Locale; identity: SiteIdentity }) {
  const today = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <header data-region="navbar" className="relative z-40 bg-[var(--nav-bg)] sm:sticky sm:top-0">
      <div className="border-b border-[var(--border)]/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-[0.58rem] uppercase tracking-[0.16em] text-[var(--fg-muted)] sm:px-6 sm:text-[0.62rem] sm:tracking-[0.3em]">
          <span className="hidden sm:block">{today}</span>
          <span className="lx-foil min-w-0 truncate font-semibold">{t(locale, "nav.digitalEdition")}</span>
          <span className="flex shrink-0 items-center gap-3">
            <LocaleSwitch locale={locale} />
        <ThemeToggle locale={locale} />
        {identity.radioStreamUrl && <RadioPlayer src={identity.radioStreamUrl} locale={locale} />}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-6 pt-10 text-center">
        <div className="flex items-center justify-center gap-6">
          <span className="hidden h-px flex-1 bg-gradient-to-r from-transparent to-[var(--border-strong)] md:block" />
          <Link href={localePath(locale, "/")} className="block">
            <span className="lx-display lx-foil block text-4xl font-semibold leading-none tracking-tight md:text-6xl">
              {identity.name}
            </span>
            <span className="lx-kicker mt-3 block text-[var(--fg-muted)]">
              {identity.tagline || t(locale, "nav.tagline")}
            </span>
          </Link>
          <span className="hidden h-px flex-1 bg-gradient-to-l from-transparent to-[var(--border-strong)] md:block" />
        </div>
      </div>

      <nav
        aria-label={t(locale, "nav.sections")}
        className="sticky top-0 z-40 border-y border-[var(--border)] bg-[var(--nav-bg)] sm:static"
      >
        <div className="lx-navrail mx-auto max-w-7xl items-center justify-start gap-x-7 gap-y-2 px-6 py-3 text-[0.68rem] uppercase tracking-[0.2em] sm:justify-center">
          {nav.map((n) => (
            <Link key={n.href} href={localePath(locale, n.href)} className="lx-link lx-ui">
              {n.label}
            </Link>
          ))}
          <Link
            href={localePath(locale, "/buscar")}
            className="lx-ui rounded-full border border-[var(--border-strong)] px-4 py-1 text-[var(--accent)] transition hover:bg-[var(--surface-2)]"
          >
            {t(locale, "nav.search")}
          </Link>
          <MoreMenu locale={locale} extra={extra} />
        </div>
      </nav>
    </header>
  );
}

/* -------------------------------------------------------------- ARTÍCULO */
function ReadingHeader({ nav, extra, locale, identity }: { nav: NavItem[]; extra: NavItem[]; locale: Locale; identity: SiteIdentity }) {
  return (
    <header data-region="navbar" className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--nav-bg)]">
      <ReadingProgress />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
        <Link href={localePath(locale, "/")} className="lx-display text-lg font-medium tracking-[0.14em] uppercase">
          {identity.name}
        </Link>
        <nav aria-label={t(locale, "nav.sections")} className="hidden gap-6 text-[0.72rem] uppercase tracking-[0.18em] lg:flex">
          {nav.slice(0, 4).map((n) => (
            <Link key={n.href} href={localePath(locale, n.href)} className="lx-link lx-ui text-[var(--fg-muted)]">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitch locale={locale} />
        <ThemeToggle locale={locale} />
        {identity.radioStreamUrl && <RadioPlayer src={identity.radioStreamUrl} locale={locale} />}
          <Link
            href={localePath(locale, "/buscar")}
            className="lx-ui text-[0.7rem] uppercase tracking-[0.18em] text-[var(--fg-muted)] hover:text-[var(--accent)]"
          >
            {t(locale, "nav.search")}
          </Link>
          <MoreMenu locale={locale} extra={extra} />
          <Link
            href={localePath(locale, "/asistente")}
            className="lx-ui rounded-[var(--radius)] border border-[var(--accent)] px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-fg)]"
          >
            {t(locale, "nav.assistant")}
          </Link>
        </div>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- SECCIÓN */
function BoldHeader({ nav, extra, locale, identity }: { nav: NavItem[]; extra: NavItem[]; locale: Locale; identity: SiteIdentity }) {
  return (
    <header data-region="navbar" className="sticky top-0 z-40 bg-[var(--nav-bg)] px-4 py-4">
      <div className="mx-auto flex max-w-7xl items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--nav-bg)] px-4 py-3 shadow-[var(--shadow)] sm:gap-4 sm:px-5 sm:py-4 lg:flex-wrap">
        <Link href={localePath(locale, "/")} className="lx-display mr-auto min-w-0 truncate text-lg font-extrabold tracking-tight sm:text-xl">
{identity.name}
        </Link>
        {/* Móvil y tablet: todas las secciones en «Más» para no ocupar media pantalla. */}
        <div className="shrink-0 text-sm lg:hidden">
          <MoreMenu locale={locale} extra={[...nav, ...extra]} />
        </div>
        <nav aria-label={t(locale, "nav.sections")} className="hidden flex-wrap items-center gap-2 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={localePath(locale, n.href)}
              className="lx-ui rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-medium transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--accent-2)]"
            >
              {n.label}
            </Link>
          ))}
          <MoreMenu locale={locale} extra={extra} />
        </nav>
        <LocaleSwitch locale={locale} className="shrink-0" />
        <ThemeToggle locale={locale} />
        {identity.radioStreamUrl && <RadioPlayer src={identity.radioStreamUrl} locale={locale} />}
        <Link
          href={localePath(locale, "/buscar")}
          aria-label={t(locale, "nav.search")}
          className="lx-ui grid size-9 shrink-0 place-items-center rounded-full sm:size-10 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-base font-bold text-[var(--accent-fg)] transition hover:scale-105"
        >
          ⌕
        </Link>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ AUTOR */
function CoutureHeader({ nav, extra, locale, identity }: { nav: NavItem[]; extra: NavItem[]; locale: Locale; identity: SiteIdentity }) {
  return (
    <header data-region="navbar" className="relative z-40 bg-[var(--nav-bg)] px-0 pb-0 pt-16 text-center sm:sticky sm:top-0 sm:px-6 sm:pb-6 sm:pt-12">
      <div className="mx-auto max-w-4xl px-6">
        <Link href={localePath(locale, "/")} className="lx-display block text-2xl font-light tracking-[0.42em] uppercase">
          {identity.name}
        </Link>
        <div className="mx-auto mt-5 flex max-w-sm items-center gap-4">
          <span className="h-px flex-1 bg-[var(--border-strong)]/60" />
          <span className="lx-kicker text-[var(--accent)]">{t(locale, "nav.signatures")}</span>
          <span className="h-px flex-1 bg-[var(--border-strong)]/60" />
        </div>
        {/* Idioma y modo: siempre en la esquina superior derecha. */}
        <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-6">
          <LocaleSwitch locale={locale} />
        <ThemeToggle locale={locale} />
        {identity.radioStreamUrl && <RadioPlayer src={identity.radioStreamUrl} locale={locale} />}
        </div>
        <nav
          aria-label={t(locale, "nav.sections")}
          className="lx-navrail sticky top-0 z-40 mt-4 items-center justify-start gap-x-5 gap-y-2 bg-[var(--nav-bg)] px-6 py-3 text-[0.78rem] font-light tracking-[0.1em] text-[var(--fg-muted)] sm:static sm:justify-center sm:bg-transparent sm:py-0"
        >
          {nav.map((n, i) => (
            <span key={n.href} className="flex items-center gap-5">
              {i > 0 && <span aria-hidden className="text-[var(--accent)]">·</span>}
              <Link href={localePath(locale, n.href)} className="lx-link">
                {n.label}
              </Link>
            </span>
          ))}
          <MoreMenu locale={locale} extra={extra} />
        </nav>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- BUSCADOR */
function CommandHeader({ nav, extra, locale, identity }: { nav: NavItem[]; extra: NavItem[]; locale: Locale; identity: SiteIdentity }) {
  return (
    <header data-region="navbar" className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--nav-bg)]">
      <div
        aria-hidden
        className="h-px w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-70"
      />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
        <Link href={localePath(locale, "/")} className="lx-mono text-sm font-bold tracking-tight">
          <span className="text-[var(--accent)]">~/</span>
          {identity.name.split(" ")[0].toLowerCase()}
          <span className="lx-pulse text-[var(--accent)]">_</span>
        </Link>
        <nav aria-label={t(locale, "nav.sections")} className="ml-4 hidden gap-4 text-xs md:flex">
          {nav.slice(0, 5).map((n) => (
            <Link key={n.href} href={localePath(locale, n.href)} className="lx-link lx-mono text-[var(--fg-muted)]">
              {n.label.toLowerCase()}
            </Link>
          ))}
          <MoreMenu locale={locale} extra={extra} />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitch locale={locale} />
        <ThemeToggle locale={locale} />
        {identity.radioStreamUrl && <RadioPlayer src={identity.radioStreamUrl} locale={locale} />}
          <span className="lx-chip lx-mono border-[var(--border-strong)] text-[var(--accent)]">
            {t(locale, "search.kicker").toLowerCase()}
          </span>
          <Link href={localePath(locale, "/asistente")} className="lx-chip lx-mono hover:text-[var(--accent)]">
            {t(locale, "nav.assistant").toLowerCase()}
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- ASISTENTE */
function GlassHeader({ nav, extra, locale, identity }: { nav: NavItem[]; extra: NavItem[]; locale: Locale; identity: SiteIdentity }) {
  return (
    <header data-region="navbar" className="sticky top-0 z-40 bg-[var(--nav-bg)] px-4 py-4">
      <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-full sm:gap-3 border border-[var(--border)] bg-[var(--nav-bg)] px-4 py-2 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)] sm:px-5 sm:py-2.5">
        <Link href={localePath(locale, "/")} className="lx-display min-w-0 truncate text-sm font-semibold tracking-tight">
          {identity.name}
        </Link>
        <span className="hidden items-center gap-2 whitespace-nowrap rounded-full bg-[var(--surface-2)] px-3 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--accent-2)] md:flex">
          <span className="lx-pulse size-1.5 rounded-full bg-[var(--accent-2)]" />
          {t(locale, "nav.online")}
        </span>
        <LocaleSwitch locale={locale} className="ml-auto shrink-0" />
        <ThemeToggle locale={locale} />
        {identity.radioStreamUrl && <RadioPlayer src={identity.radioStreamUrl} locale={locale} />}
        {/* Tablet y móvil: todas las secciones dentro de «Más» (no caben en la píldora). */}
        <div className="text-xs text-[var(--fg-muted)] lg:hidden">
          <MoreMenu locale={locale} extra={[...nav, ...extra]} />
        </div>
        <nav aria-label={t(locale, "nav.sections")} className="hidden items-center gap-4 whitespace-nowrap text-xs text-[var(--fg-muted)] lg:flex">
          {nav.slice(0, 3).map((n) => (
            <Link key={n.href} href={localePath(locale, n.href)} className="lx-link">
              {n.label}
            </Link>
          ))}
          <Link href={localePath(locale, "/buscar")} className="lx-link text-[var(--accent)]">
            {t(locale, "nav.search")}
          </Link>
          <MoreMenu locale={locale} extra={extra} />
        </nav>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------- INSTITUCIONAL */
function CrestHeader({ nav, extra, locale, identity }: { nav: NavItem[]; extra: NavItem[]; locale: Locale; identity: SiteIdentity }) {
  return (
    <header data-region="navbar" className="relative z-40 border-b-2 border-[var(--accent)] bg-[var(--nav-bg)] sm:sticky sm:top-0">
      <div className="mx-auto max-w-5xl px-6 pb-8 pt-16 text-center sm:pt-10">
        <Link href={localePath(locale, "/")} className="inline-flex flex-col items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full border-2 border-[var(--accent)] text-lg tracking-[0.1em] text-[var(--accent)]">
            CG
          </span>
          <span className="lx-display text-xl tracking-[0.3em] uppercase">{identity.name}</span>
        </Link>
        <p className="lx-kicker mt-2 text-[var(--accent-2)]">{t(locale, "nav.institutional")}</p>
        {/* Idioma y modo: siempre en la esquina superior derecha. */}
        <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-6">
          <LocaleSwitch locale={locale} />
        <ThemeToggle locale={locale} />
        {identity.radioStreamUrl && <RadioPlayer src={identity.radioStreamUrl} locale={locale} />}
        </div>
      </div>
      <nav
        aria-label={t(locale, "nav.sections")}
        className="sticky top-0 z-40 border-t border-[var(--border)] bg-[var(--nav-bg)] sm:static"
      >
        <div className="lx-navrail mx-auto max-w-5xl justify-start gap-x-8 gap-y-2 px-6 py-3 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--fg-muted)] sm:justify-center">
          {nav.map((n) => (
            <Link key={n.href} href={localePath(locale, n.href)} className="lx-link lx-ui">
              {n.label}
            </Link>
          ))}
        </div>
        <MoreMenu locale={locale} extra={extra} />
        </nav>
    </header>
  );
}

/* ---------------------------------------------------------------- ARCHIVO */
function ArchiveHeader({ nav, extra, locale, identity }: { nav: NavItem[]; extra: NavItem[]; locale: Locale; identity: SiteIdentity }) {
  return (
    <header data-region="navbar" className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--nav-bg)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-5">
        <Link href={localePath(locale, "/")} className="lx-display text-lg tracking-[0.22em] uppercase text-[var(--accent)]">
          {identity.name}
        </Link>
        <span className="lx-chip">{t(locale, "nav.archive")}</span>
        <LocaleSwitch locale={locale} className="ml-auto" />
        <ThemeToggle locale={locale} />
        {identity.radioStreamUrl && <RadioPlayer src={identity.radioStreamUrl} locale={locale} />}
        <nav aria-label={t(locale, "nav.sections")} className="flex gap-5 text-xs tracking-wide text-[var(--fg-muted)]">
          {nav.slice(0, 3).map((n) => (
            <Link key={n.href} href={localePath(locale, n.href)} className="lx-link">
              {n.label}
            </Link>
          ))}
          <Link href={localePath(locale, "/buscar")} className="lx-link text-[var(--accent)]">
            {t(locale, "nav.search")}
          </Link>
          <MoreMenu locale={locale} extra={extra} />
        </nav>
      </div>
    </header>
  );
}
