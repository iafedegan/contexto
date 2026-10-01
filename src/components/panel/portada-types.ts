import type { HomeLayoutConfig, HomeStyle } from "@/db/schema";
import type { PopupConfig } from "@/lib/popup-types";
import type { ArticleListItem } from "@/lib/content";

/** Una nota de la portada tal como la maneja el editor. */
export type Item = ArticleListItem & { id: string; homePosition: number | null };
/** Disposición completa de la portada (con todos los valores por defecto rellenos). */
export type Layout = Required<HomeLayoutConfig>;

/** Estado anterior que se guarda al publicar, para poder deshacer la publicación. */
export type Anterior = {
  auto: boolean;
  items: { id: string; homeStyle: HomeStyle | null }[];
  layout: Layout;
  popup: PopupConfig;
  ads: { key: string; html: string | null; imageUrl: string | null; clickUrl: string | null; active: boolean; startsAt: string | null; endsAt: string | null }[];
};
