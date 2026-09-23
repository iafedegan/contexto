import type { HomeStyle } from "@/db/schema";
import { homeFontFamily } from "@/lib/home-fonts";

/**
 * Estilo de título fijado a mano en /panel/portada, resuelto a CSS. Compartido
 * por `ArticleCard` y las fichas propias de cada plantilla de portada, para
 * que el control por-tarjeta del panel (fuente, negrilla, cursiva, escala)
 * funcione igual sin importar qué tan distinto sea el diseño de la plantilla.
 */
export function homeStyleTitleCss(
  style: HomeStyle | null | undefined,
  basePx: number,
  lineHeight = 1.2,
): React.CSSProperties {
  const scale = (style?.titleScale ?? 100) / 100;
  return {
    fontSize: `${(basePx * scale) / 16}rem`,
    lineHeight,
    fontFamily: homeFontFamily(style?.font),
    fontWeight: style?.bold ? 800 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    // Sin color elegido no se declara la propiedad: el titular sigue heredando
    // el del tema (y sus estados :hover), en vez de quedar congelado.
    color: style?.color || undefined,
  };
}

export function homeStyleImageScale(style: HomeStyle | null | undefined): number {
  return style?.imageScale ?? 100;
}
