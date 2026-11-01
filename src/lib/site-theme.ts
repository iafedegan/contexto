import "server-only";
import type { HomeLayoutConfig } from "@/db/schema";
import { cache } from "react";
import type { CSSProperties } from "react";
import { getHomeLayoutConfig } from "@/lib/content";
import { homeBackgroundStyle } from "@/lib/home-background";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";
import { regionsCss } from "@/lib/home-regions";
import { sectionElsCss } from "@/lib/section-els";
import { zonesCss } from "@/lib/zones";
import { resolveParts, PRESET_PARTS, type TemplateParts } from "@/lib/template-parts";
import type { Theme } from "@/lib/theme";
import type { TextosCabecera } from "@/lib/textos-cabecera";
import { menuNavCss, type MenuNavbar } from "@/lib/menu-navbar";
import { cssPorPantalla } from "@/lib/pantallas";
import { getPreviewDraft } from "@/lib/preview-draft";
import type { PortadaDraft } from "@/lib/portada-draft";

// La hoja del diseño: cada parte, general o por pantalla según lo que se haya ajustado.
function disenoCss(layout: HomeLayoutConfig): string {
  const pant = layout.pantallas ?? {};
  return [
    cssPorPantalla(layout.regions, (p) => pant[p]?.regions, (v) => regionsCss(v)),
    cssPorPantalla(layout.sectionEls, (p) => pant[p]?.sectionEls, (v) => sectionElsCss(v)),
    cssPorPantalla(layout.zones, (p) => pant[p]?.zones, (v) => zonesCss(v)),
    cssPorPantalla(layout.menuNav?.estilo, (p) => pant[p]?.menuEstilo, (v) => menuNavCss(v ? { estilo: v } : undefined)),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Tema activo del sitio = la plantilla elegida en /panel/portada.
 *
 * Todas las páginas públicas lo usan, no solo la portada: si un editor elige
 * "Revista", el artículo, la sección y el buscador se ven de esa marca. Antes
 * cada ruta tenía su tema fijo y el sitio parecía cinco sitios distintos.
 *
 * `cache()` lo memoiza por render: layout, página y generateMetadata lo piden
 * por separado y solo se paga una consulta.
 */
const temaDe = cache(
  // El borrador solo separa la memoria: quien lo aplica es getHomeLayoutConfig. Lo pide también el layout del panel, antes de que la vista previa fije el suyo.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_draft: PortadaDraft | null): Promise<{ theme: Theme; style?: CSSProperties; css?: string; parts: Required<TemplateParts>; textos?: TextosCabecera; menuNav?: MenuNavbar }> => {
    try {
      const layout = await getHomeLayoutConfig();
      // Solo en desarrollo: cookie `cg-tema` para revisar cada plantilla sin
      // cambiar la configuración. En producción nunca se lee (no rompe ISR).
      let override: string | undefined;
      let devParts: TemplateParts | undefined;
      if (process.env.NODE_ENV === "development") {
        const { cookies } = await import("next/headers");
        const jar = await cookies();
        override = jar.get("cg-tema")?.value;
        // `cg-partes=navbar,cuerpo,footer` (p. ej. glass,clasico,seal).
        const [navbar, body, footer] = (jar.get("cg-partes")?.value ?? "").split(",");
        if (navbar) devParts = { navbar, body, footer } as TemplateParts;
      }
      return {
        theme: (override || layout.templateId) as Theme,
        style: homeBackgroundStyle(layout.background),
        textos: layout.textos,
        menuNav: layout.menuNav,
        css: disenoCss(layout),
        // Piezas de la plantilla compuesta (navbar, cuerpo, footer). Con la
        // cookie de desarrollo se ve la plantilla prediseñada entera.
        parts: resolveParts(override || layout.templateId, devParts ?? (override ? undefined : layout.parts)),
      };
    } catch {
      // Sin base de datos (build local): la plantilla por defecto.
      return { theme: DEFAULT_HOME_LAYOUT.templateId as Theme, parts: PRESET_PARTS[DEFAULT_HOME_LAYOUT.templateId] };
    }
  },
);
export const getSiteTheme = () => temaDe(getPreviewDraft());
