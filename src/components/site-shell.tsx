import { ViewTransition } from "react";
import { getBreakingArticle, getTopLevelCategories } from "@/lib/content";
import { getSiteIdentity } from "@/lib/site-identity";
import { getSiteTheme } from "@/lib/site-theme";
import { getSitePopup } from "@/lib/popup";
import { SitePopup } from "@/components/site-popup";
import { ReadingProgress } from "@/components/reading-progress";
import { AdsBanner } from "@/components/ads-banner";
import { SiteHeader, type NavItem } from "@/components/site-header";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SiteFooter } from "@/components/site-footer";
import type { Theme } from "@/lib/theme";
import { DEFAULT_LOCALE, categoryLabel, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { NAV_VISIBLE } from "@/lib/nav-limits";

/**
 * Estructura del contenido por tipo de página (ancho, aire y texturas). Es lo
 * ÚNICO que depende de la ruta: el color, la tipografía, la cabecera y el pie
 * vienen del tema de la plantilla activa.
 */
export type ShellVariant =
  | "portada"
  | "articulo"
  | "seccion"
  | "autor"
  | "buscar"
  | "asistente"
  | "institucional"
  | "archivo";

/**
 * `shell` es la MISMA medida que usan cabecera y pie en las cinco plantillas:
 * así las subpáginas ocupan todo el ancho útil y su contenido queda alineado
 * con el navbar. El artículo también ocupa todo el ancho, por decisión
 * editorial.
 */
const SHELL: Record<ShellVariant, { main: string; fx: string }> = {
  portada: { main: "shell flex-1 pb-8 pt-4 sm:py-12", fx: "lx-grain" },
  articulo: { main: "shell flex-1 py-10 sm:py-14", fx: "lx-grain" },
  seccion: { main: "shell flex-1 pb-8 pt-3 sm:pb-12 sm:pt-4", fx: "lx-grain lx-aurora lx-vignette" },
  autor: { main: "shell flex-1 py-10 sm:py-14", fx: "lx-grain" },
  buscar: { main: "shell flex-1 py-8 sm:py-12", fx: "lx-grain lx-aurora" },
  asistente: { main: "shell flex-1 py-8 sm:py-12", fx: "lx-grain lx-aurora" },
  institucional: { main: "shell flex-1 py-10 sm:py-14", fx: "lx-grain" },
  archivo: { main: "shell flex-1 py-10 sm:py-16", fx: "lx-grain lx-aurora" },
};

/**
 * Insignia «Última hora» en la esquina de la imagen de la tarjeta de la nota marcada (la más reciente). Es CSS y no un componente
 * porque las tarjetas se pintan también desde componentes de cliente; cada tarjeta lleva su `data-bs-root` con el slug.
 */
function estiloUltimaHora(slug: string, etiqueta: string): string {
  const texto = `⚡ ${etiqueta}`.toUpperCase().replace(/["\\\n]/g, "");
  return `[data-bs-root="${slug}"] .lx-media{position:relative;container-type:inline-size}[data-bs-root="${slug}"] .lx-media::after{content:"${texto}";position:absolute;top:.6rem;left:.6rem;z-index:5;pointer-events:none;background:var(--danger,#c0392b);color:#fff;font:700 .66rem/1 var(--font-ui,system-ui,sans-serif);letter-spacing:.14em;padding:.4rem .65rem;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.4);white-space:nowrap}@container (max-width:150px){[data-bs-root="${slug}"] .lx-media::after{content:"⚡";top:.35rem;left:.35rem;padding:.3rem .42rem;font-size:.75rem}}`;
}

/**
 * Envoltorio de plantilla: fija el tema (`data-theme`), las capas de textura y
 * la pareja navbar/footer. Las categorías se consultan una sola vez por página.
 */
export async function SiteShell({
  theme,
  variant,
  children,
  mainClassName,
  style,
  locale = DEFAULT_LOCALE,
  aboveMain,
}: {
  /** Plantilla activa: paleta, tipografías, cabecera y pie. */
  theme: Theme;
  /** Tipo de página: solo decide el ancho y las texturas del contenido. */
  variant: ShellVariant;
  children: React.ReactNode;
  mainClassName?: string;
  /** Sobrescribe los tokens de color (fondo elegido en /panel/portada). */
  style?: React.CSSProperties;
  /** Idioma de la INTERFAZ (el contenido sigue en español). */
  locale?: Locale;
  /**
   * Contenido a todo el ancho entre la cabecera y `<main class="shell">`
   * (p. ej. el cintillo de titulares). Va aquí y no dentro de `children`
   * porque `shell` limita el ancho al del contenido — cualquier cosa que
   * necesite ir borde a borde tiene que quedar FUERA de ese contenedor, no
   * forzarse con trucos de `100vw` (que se rompen dentro de vistas previas
   * incrustadas, como el mockup de /panel/portada, donde 100vw mide la
   * ventana real del navegador y no el recuadro del mockup).
   */
  aboveMain?: React.ReactNode;
}) {
  const [nav, extraNav, identity, site, popup, ultimaHora] = await Promise.all([
    navItems(locale),
    navOverflow(locale),
    getSiteIdentity(),
    getSiteTheme(),
    getSitePopup(),
    getBreakingArticle().catch(() => null),
  ]);
  const shell = SHELL[variant];

  // Transición entre páginas: al navegar, la página que sale se desvanece y la que entra aparece con un leve ascenso (CSS en globals.css,
  // «page-in» / «page-out»). Va aquí y no en el layout: cada página monta su SiteShell, y es lo que React necesita para animar la entrada y la salida.
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
    <div data-theme={theme} data-site-root className={cn("lx-shell", shell.fx)} style={style}>
      {/* Estilo por componente elegido en /panel/portada (ya validado). */}
      {site.css && <style dangerouslySetInnerHTML={{ __html: site.css }} />}
      {/* El progreso de lectura acompaña al artículo en cualquier plantilla. */}
      {variant === "articulo" && (
        <div className="sticky top-0 z-50 h-0">
          <ReadingProgress />
        </div>
      )}
      {/* «Última hora» ya no es una franja roja: la nota marcada lleva una insignia en la esquina de su imagen (ver `estiloUltimaHora`). */}
      {ultimaHora && /^[a-z0-9-]+$/.test(ultimaHora.slug) && <style dangerouslySetInnerHTML={{ __html: estiloUltimaHora(ultimaHora.slug, t(locale, "breaking.label")) }} />}
      <SiteHeader theme={theme} nav={nav} extraNav={extraNav} locale={locale} identity={identity} variant={site.parts.navbar} />
      {aboveMain}
      <main id="contenido" data-region="body" className={mainClassName ?? shell.main}>
        {/* Honestidad con el lector: la interfaz cambia de idioma, las notas no. */}
        {locale === "en" && (
          <p
            lang="en"
            className="mb-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--fg-muted)]"
          >
            {t(locale, "locale.notice")}
          </p>
        )}
        {children}
      </main>
      {/* Leaderboard antes del pie (§9.1). Vacío = no ocupa espacio. */}
      <div className="shell pb-10">
        <AdsBanner zone="footer" className="mx-auto" />
      </div>
      {/* Popup diseñado en /panel/portada (si está activo). */}
      {popup.enabled && <SitePopup config={popup} />}
      <SiteFooter theme={theme} nav={nav} locale={locale} identity={identity} variant={site.parts.footer} />
      {/* Barra de pestañas del celular: DENTRO del contenedor con `data-theme`, para heredar la paleta de la plantilla. */}
      <MobileTabBar />
    </div>
    </ViewTransition>
  );
}

/** Secciones a partir de la novena: no caben en la barra, van al menú «Más». */
export async function navOverflow(locale: Locale = DEFAULT_LOCALE): Promise<NavItem[]> {
  try {
    const categories = await getTopLevelCategories();
    return categories.slice(NAV_VISIBLE).map((c) => ({
      href: `/categoria/${c.slug}`,
      label: categoryLabel(locale, c.slug, c.name),
    }));
  } catch {
    return [];
  }
}

// Secciones principales del sitio para la navegación, traducidas al idioma.
export async function navItems(locale: Locale = DEFAULT_LOCALE): Promise<NavItem[]> {
  try {
    // Solo las de primer nivel, y como mucho ocho (N-04): más opciones
    // visibles sobrecargan la navegación. El resto está en el menú «Más».
    const categories = await getTopLevelCategories();
    return [
      ...categories.slice(0, NAV_VISIBLE).map((c) => ({
        href: `/categoria/${c.slug}`,
        label: categoryLabel(locale, c.slug, c.name),
      })),
      // El Observatorio (indicadores y mapa) es una página fija del sitio, no una sección: va aparte del límite N-04.
      { href: "/observatorio", label: t(locale, "nav.observatory") },
    ];
  } catch {
    // Build sin base de datos: el navbar se degrada a su forma mínima.
    return [];
  }
}
