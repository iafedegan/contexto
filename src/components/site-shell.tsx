import { getBreakingSlugs, getNavChildren, getTopLevelCategories } from "@/lib/content";
import { getSiteIdentity } from "@/lib/site-identity";
import { getSiteTheme } from "@/lib/site-theme";
import { getSitePopup } from "@/lib/popup";
import { BackToTop } from "@/components/back-to-top";
import { SitePopupDiferido } from "@/components/site-popup-diferido";
import { ReadingProgress } from "@/components/reading-progress";
import { AdsBanner } from "@/components/ads-banner";
import { AdsBannerCliente } from "@/components/ads-banner-cliente";
import { UltimaHoraInsignias } from "@/components/ultima-hora-cliente";
import { SiteHeader, type NavItem } from "@/components/site-header";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SiteFooter } from "@/components/site-footer";
import { CintilloMercado } from "@/components/cintillo-mercado";
import type { Theme } from "@/lib/theme";
import { DEFAULT_LOCALE, categoryLabel, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { NAV_VISIBLE } from "@/lib/nav-limits";
import { aplicarMenu, sinOcultas } from "@/lib/menu-navbar";
import { conTextos } from "@/lib/textos-cabecera";

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
  portada: { main: "shell flex-1 pb-8 pt-0 sm:pb-12 sm:pt-0", fx: "lx-grain" },
  articulo: { main: "shell flex-1 py-10 sm:py-14", fx: "lx-grain" },
  seccion: { main: "shell flex-1 pb-8 pt-3 sm:pb-12 sm:pt-4", fx: "lx-grain lx-aurora lx-vignette" },
  autor: { main: "shell flex-1 py-10 sm:py-14", fx: "lx-grain" },
  buscar: { main: "shell flex-1 py-8 sm:py-12", fx: "lx-grain lx-aurora" },
  asistente: { main: "shell flex-1 py-8 sm:py-12", fx: "lx-grain lx-aurora" },
  institucional: { main: "shell flex-1 py-10 sm:py-14", fx: "lx-grain" },
  archivo: { main: "shell flex-1 py-10 sm:py-16", fx: "lx-grain lx-aurora" },
};

/**
 * Envoltorio de plantilla: fija el tema (`data-theme`), las capas de textura y
 * la pareja navbar/footer. Las categorías se consultan una sola vez por página.
 *
 * Todo lo que lee aquí dura 30 días en la caché de datos y se renueva solo cuando el panel lo cambia (ver data-cache.ts): las notas
 * son estáticas y una lectura con un TTL más corto las haría regenerarse solas. Lo que cambia a menudo («Última hora», anuncios,
 * cotizaciones) lo pide el navegador, salvo con `datosEnServidor` (portada y secciones, que se pintan en cada visita).
 */
export async function SiteShell({
  theme,
  variant,
  children,
  mainClassName,
  style,
  locale = DEFAULT_LOCALE,
  aboveMain,
  topBar,
  datosEnServidor = false,
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
  /** Franja a todo el ancho por ENCIMA de la cabecera, en lo más alto de la página (el cintillo de la portada). */
  topBar?: React.ReactNode;
  /**
   * Solo páginas DINÁMICAS (portada, secciones): «Última hora», la pauta del pie y las cotizaciones se pintan en el servidor. En una
   * página estática (nota, autor) deben ir al navegador: si no, la página guardada llevaría su TTL corto y se regeneraría sola.
   */
  datosEnServidor?: boolean;
}) {
  const [navTodo, extraNav, identity, site, popup, ultimaHora] = await Promise.all([
    navItems(locale),
    navOverflow(locale),
    getSiteIdentity(),
    getSiteTheme(),
    getSitePopup(),
    datosEnServidor ? getBreakingSlugs().catch(() => [] as string[]) : null,
  ]);
  // Ajustes del editor: secciones visibles, enlaces propios y submenús.
  const nav = aplicarMenu(navTodo, site.menuNav);
  const shell = SHELL[variant];

  return (
    <div data-theme={theme} data-site-root className={cn("lx-shell", shell.fx)} style={style}>
      {/* Estilo por componente elegido en /panel/portada (ya validado). */}
      {site.css && <style dangerouslySetInnerHTML={{ __html: site.css }} />}
      {/* El progreso de lectura acompaña al artículo en cualquier plantilla. */}
      {variant === "articulo" && (
        <div aria-hidden className="sticky top-0 z-50 h-0">
          <ReadingProgress />
        </div>
      )}
      {/* «Última hora» ya no es una franja roja: la nota marcada lleva una insignia en la esquina de su imagen (ver ultima-hora-cliente.tsx). */}
      <UltimaHoraInsignias locale={locale} inicial={ultimaHora ? { slugs: ultimaHora, nota: null } : undefined} />
      {/* En el celular el cintillo y la cabecera quedan fijos arriba al hacer scroll; en pantallas grandes el envoltorio no existe (contents) y la barra de secciones conserva su propio sticky. */}
      <div className="cg-cabecera-fija sticky top-0 z-50 lg:contents">
        {topBar ?? <CintilloMercado locale={locale} enServidor={datosEnServidor} />}
        <SiteHeader theme={theme} nav={nav} extraNav={sinOcultas(extraNav, site.menuNav)} locale={locale} identity={conTextos(identity, site.textos)} variant={site.parts.navbar} />
      </div>
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
        {datosEnServidor ? <AdsBanner zone="footer" className="mx-auto" /> : <AdsBannerCliente zone="footer" className="mx-auto" />}
      </div>
      {/* Popup diseñado en /panel/portada (si está activo). */}
      {popup.enabled && <SitePopupDiferido config={popup} />}
      <BackToTop locale={locale} />
      <SiteFooter theme={theme} nav={nav} locale={locale} identity={identity} variant={site.parts.footer} />
      {/* Barra de pestañas del celular: DENTRO del contenedor con `data-theme`, para heredar la paleta de la plantilla. */}
      <MobileTabBar />
    </div>
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
    // Solo las de primer nivel, y como mucho NAV_VISIBLE (N-04): más opciones
    // visibles sobrecargan la navegación. El resto está en el menú «Más».
    const [categories, hijas] = await Promise.all([getTopLevelCategories(), getNavChildren().catch(() => ({}) as Awaited<ReturnType<typeof getNavChildren>>)]);
    return [
      // «Portada» abre la barra, como en el sitio anterior.
      { href: "/", label: t(locale, "nav.home") },
      ...categories.slice(0, NAV_VISIBLE).map((c) => ({
        href: `/categoria/${c.slug}`,
        label: categoryLabel(locale, c.slug, c.name),
        // Subsecciones que se despliegan bajo la sección en la barra de navegación.
        children: (hijas[c.slug] ?? []).map((h) => ({
          href: `/categoria/${h.slug}`,
          label: categoryLabel(locale, h.slug, h.name),
          children: (h.children ?? []).map((n) => ({ href: `/categoria/${n.slug}`, label: categoryLabel(locale, n.slug, n.name) })),
        })),
      })),
      // El Observatorio (indicadores y mapa) es una página fija del sitio, no una sección: va aparte del límite N-04.
      { href: "/observatorio", label: t(locale, "nav.observatory") },
    ];
  } catch {
    // Build sin base de datos: el navbar se degrada a su forma mínima.
    return [];
  }
}
