import Link from "next/link";
import { cn } from "@/lib/utils";
import type { FooterId } from "@/lib/template-parts";
import type { NavItem } from "@/components/site-header";
import { THEME_LABEL, type Theme } from "@/lib/theme";
import { DEFAULT_IDENTITY, type SiteIdentity } from "@/lib/site-identity";
import { DEFAULT_LOCALE, localePath, t, type Locale } from "@/lib/i18n";
import { MENU_SECUNDARIO } from "@/content/institucional";
import { LogoMark } from "@/components/logo-mark";

/**
 * Menú secundario completo del §2.2: institucional, legal y comercial. Vive en
 * el pie porque es donde el lector lo busca, y en el menú «Más» de la cabecera.
 */
function legalLinks(locale: Locale) {
  return [
    ...MENU_SECUNDARIO.map((m) => ({
      href: localePath(locale, `/${m.slug}`),
      label: m.label[locale],
    })),
    // El acceso al panel editorial vive siempre en el pie, en todos los
    // diseños (no en la cabecera).
    { href: "/panel", label: t(locale, "footer.panel") },
  ];
}

/** Herramientas del portal: búsqueda y canales de sindicación. */
function toolLinks(locale: Locale) {
  return [
    { href: localePath(locale, "/buscar"), label: t(locale, "nav.search") },
    { href: localePath(locale, "/boletin"), label: t(locale, "newsletter.title") },
    { href: "/feeds", label: "RSS" },
    { href: "/sitemap.xml", label: "Sitemap" },
  ];
}

// Año en curso, para el aviso de derechos.
const YEAR = new Date().getFullYear();


/** Un footer por plantilla: mismo contenido legal, puesta en escena distinta. */
export function SiteFooter({
  theme,
  nav,
  locale = DEFAULT_LOCALE,
  identity = DEFAULT_IDENTITY,
  variant,
}: {
  theme: Theme;
  nav: NavItem[];
  locale?: Locale;
  identity?: SiteIdentity;
  /** Footer elegido al componer la plantilla: manda sobre el de la paleta. */
  variant?: FooterId;
}) {
  const LEGAL = legalLinks(locale);
  const TOOLS = toolLinks(locale);
  const ARCHIVE_NOTE = t(locale, "footer.archiveNote");
  const props = { nav, theme, locale, LEGAL, TOOLS, ARCHIVE_NOTE, SITE_NAME: identity.name };
  switch (variant) {
    case "grand":
      return <GrandFooter {...props} />;
    case "atelier":
      return <AtelierFooter {...props} />;
    case "copper":
      return <CopperFooter {...props} />;
    case "aurora":
      return <AuroraFooter {...props} />;
    case "seal":
      return <SealFooter {...props} />;
    case "gremial":
      return <GremialFooter {...props} />;
  }
  switch (theme) {
    case "home":
    case "esmeralda":
    case "clasico":
      return <GrandFooter {...props} />;
    case "gremial":
      return <GremialFooter {...props} />;
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

// Propiedades del pie: tema, idioma, navegación e identidad.
type FooterProps = {
  SITE_NAME: string;
  nav: NavItem[];
  theme: Theme;
  locale: Locale;
  LEGAL: Array<{ href: string; label: string }>;
  TOOLS: Array<{ href: string; label: string }>;
  ARCHIVE_NOTE: string;
};

// Firma de diseño del pie.
function Signature({ theme, locale = "es" }: { theme: Theme; locale?: Locale }) {
  return (
    <span className="lx-kicker text-[0.72rem] text-[var(--fg-muted)] opacity-70">
      {t(locale, "footer.template")} «{THEME_LABEL[theme]}»
    </span>
  );
}

/* ------------------------------------------------------------------ HOME */
function GrandFooter({ nav, theme, locale, LEGAL, TOOLS, ARCHIVE_NOTE, SITE_NAME }: FooterProps) {
  return (
    <footer data-region="footer" className="relative mt-16 sm:mt-24 border-t border-[var(--border)] bg-[var(--bg-2)]">
      <div
        aria-hidden
        className="h-px w-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
      />
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        {/* En el celular las cuatro columnas de enlaces van de a dos: antes eran una sola pila de ~1 500 px. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
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

/* ---------------------------------------------------------------- GREMIAL
   Pie del mockup del cliente: franja verde oscuro continua con la de la
   franja del boletín (ver GremialTemplate). Mismo contenido que GrandFooter
   (secciones, institucional, legal, herramientas) — solo cambia la piel. */
function GremialFooter({ nav, theme, locale, LEGAL, TOOLS, ARCHIVE_NOTE, SITE_NAME }: FooterProps) {
  return (
    <footer
      data-region="footer"
      className="mt-0 text-white"
      style={{
        background: "#173b21",
        ["--fg-muted" as string]: "rgba(255,255,255,.75)",
        ["--border" as string]: "rgba(255,255,255,.18)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        {/* En el celular las cuatro columnas de enlaces van de a dos: antes eran una sola pila de ~1 500 px. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <span className="lx-display text-3xl font-semibold">{SITE_NAME}</span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--fg-muted)]">{t(locale, "footer.blurb")}</p>
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

// Columna de enlaces del pie.
function FooterColumn({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <h2 className="lx-kicker text-[var(--accent)]">{title}</h2>
      <ul className="mt-4 flex flex-col gap-2.5 text-sm text-[var(--fg-muted)] pointer-coarse:gap-0">
        {items.map((i) => (
          <li key={i.href}>
            <FooterLink href={i.href} className="lx-link">
              {i.label}
            </FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * `sitemap.xml`, `feed.xml` y `llms.txt` son ficheros que sirve el servidor,
 * no páginas de la aplicación. Enlazarlos con <Link> hacía que Next les pidiera
 * su carga por adelantado como componentes de servidor (`?_rsc=`), lo que
 * devuelve un 500 y llena la consola de errores. Para esos destinos, un <a>
 * normal es lo correcto.
 */
function esFichero(href: string): boolean {
  return /\.(xml|txt)$/.test(href);
}

// Enlace del pie.
function FooterLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  // Con el dedo, cada enlace del pie mide 44 px de alto (antes ~17 px, imposible de acertar).
  const tap = cn(className, "pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center");
  if (esFichero(href)) {
    return (
      <a href={href} className={tap}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={tap}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------- ARTÍCULO */
function ColophonFooter({ theme, locale, LEGAL, ARCHIVE_NOTE, SITE_NAME }: FooterProps) {
  return (
    <footer data-region="footer" className="mt-16 sm:mt-24 border-t border-[var(--border)] bg-[var(--bg-2)]">
      <div className="mx-auto max-w-2xl px-6 py-14 text-center">
        <span className="lx-display text-2xl italic text-[var(--accent)]">{SITE_NAME}</span>
        <hr className="lx-rule mx-auto my-6 w-24" />
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
          {LEGAL.map((l) => (
            <li key={l.href}>
              <FooterLink href={l.href} className="lx-link lx-ui">
                {l.label}
            </FooterLink>
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
    <footer data-region="footer" className="relative mt-16 sm:mt-24 overflow-hidden rounded-t-[3rem] border-t border-[var(--border)] bg-[var(--bg-2)]">
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
                  className="lx-ui rounded-full border border-[var(--border)] px-4 py-1.5 text-xs transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-[var(--fg-muted)]">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <FooterLink href={l.href} className="lx-link">
                  {l.label}
            </FooterLink>
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
    <footer data-region="footer" className="mt-20 sm:mt-28 border-t border-[var(--border)] bg-[var(--bg-2)]">
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
              <FooterLink href={l.href} className="lx-link">
                {l.label}
            </FooterLink>
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
    <footer data-region="footer" className="mt-14 sm:mt-20 border-t border-[var(--border)] bg-[var(--bg-2)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-6 text-xs text-[var(--fg-muted)]">
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
    <footer data-region="footer" className="relative mt-14 sm:mt-20">
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
              <FooterLink href={l.href} className="lx-link">
                {l.label}
            </FooterLink>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-[var(--fg-muted)]">
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
    <footer data-region="footer" className="mt-16 sm:mt-24 border-t-2 border-[var(--accent)] bg-[var(--surface)]">
      <div className="mx-auto grid grid-cols-1 max-w-5xl gap-8 px-6 py-12 md:grid-cols-[auto_1fr]">
        <LogoMark size={64} />
        <div>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
{t(locale, "footer.about")} {ARCHIVE_NOTE}
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <FooterLink href={l.href} className="lx-link lx-ui">
                  {l.label}
            </FooterLink>
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
    <footer data-region="footer" className="mt-14 sm:mt-20 border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-8 text-xs text-[var(--fg-muted)]">
        <span className="lx-display tracking-[0.2em] uppercase text-[var(--accent)]">{SITE_NAME}</span>
        {LEGAL.map((l) => (
          <FooterLink key={l.href} href={l.href} className="lx-link">
            {l.label}
          </FooterLink>
        ))}
        <span className="ml-auto">© {YEAR}</span>
        <Signature theme={theme} locale={locale} />
      </div>
    </footer>
  );
}
