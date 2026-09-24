import "server-only";
import { cache } from "react";
import type { CSSProperties } from "react";
import { getHomeLayoutConfig } from "@/lib/content";
import { homeBackgroundStyle } from "@/lib/home-background";
import { DEFAULT_HOME_LAYOUT } from "@/lib/home-layout";
import { regionsCss } from "@/lib/home-regions";
import type { Theme } from "@/lib/theme";

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
export const getSiteTheme = cache(
  async (): Promise<{ theme: Theme; style?: CSSProperties; css?: string }> => {
    try {
      const layout = await getHomeLayoutConfig();
      return {
        theme: layout.templateId as Theme,
        style: homeBackgroundStyle(layout.background),
        css: regionsCss(layout.regions),
      };
    } catch {
      // Sin base de datos (build local): la plantilla por defecto.
      return { theme: DEFAULT_HOME_LAYOUT.templateId as Theme };
    }
  },
);
