import { getTopLevelCategories } from "@/lib/content";
import { getSiteIdentity } from "@/lib/site-identity";
import { ReadingProgress } from "@/components/reading-progress";
import { SiteHeader, type NavItem } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { Theme } from "@/lib/theme";
import { DEFAULT_LOCALE, categoryLabel, t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
 * con el navbar. El artículo es la excepción a propósito: un texto largo se
 * lee mal a 96 rem, y su cuerpo mantiene su columna de lectura.
 */
const SHELL: Record<ShellVariant, { main: string; fx: string }> = {
  portada: { main: "shell flex-1 py-12", fx: "lx-grain" },
  articulo: { main: "mx-auto w-full max-w-3xl flex-1 px-6 py-14", fx: "lx-grain" },
  seccion: { main: "shell flex-1 py-12", fx: "lx-grain lx-aurora lx-vignette" },
  autor: { main: "shell flex-1 py-14", fx: "lx-grain" },
  buscar: { main: "shell flex-1 py-12", fx: "lx-grain lx-aurora" },
  asistente: { main: "shell flex-1 py-12", fx: "lx-grain lx-aurora" },
  institucional: { main: "shell flex-1 py-14", fx: "lx-grain" },
  archivo: { main: "shell flex-1 py-16", fx: "lx-grain lx-aurora" },
};

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
}) {
  const [nav, identity] = await Promise.all([navItems(locale), getSiteIdentity()]);
  const shell = SHELL[variant];

  return (
    <div data-theme={theme} className={cn("lx-shell", shell.fx)} style={style}>
      {/* El progreso de lectura acompaña al artículo en cualquier plantilla. */}
      {variant === "articulo" && (
        <div className="sticky top-0 z-50 h-0">
          <ReadingProgress />
        </div>
      )}
      <SiteHeader theme={theme} nav={nav} locale={locale} identity={identity} />
      <main id="contenido" className={mainClassName ?? shell.main}>
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
      <SiteFooter theme={theme} nav={nav} locale={locale} identity={identity} />
    </div>
  );
}

export async function navItems(locale: Locale = DEFAULT_LOCALE): Promise<NavItem[]> {
  try {
    // Solo las de primer nivel: las subcategorías se navegan desde los filtros
    // de la propia sección, no desde la barra.
    const categories = await getTopLevelCategories();
    return categories.map((c) => ({
      href: `/categoria/${c.slug}`,
      label: categoryLabel(locale, c.slug, c.name),
    }));
  } catch {
    // Build sin base de datos: el navbar se degrada a su forma mínima.
    return [];
  }
}
