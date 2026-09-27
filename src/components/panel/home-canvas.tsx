"use client";

import { FeatureStrip } from "@/components/feature-strip";
import { AdsPreview } from "@/components/panel/ads-preview";
import type { AdDraft } from "@/components/panel/ads-zone-form";
import { TEMPLATE_COMPONENTS } from "@/components/home/templates";
import { SitePopup } from "@/components/site-popup";
import type { HomeLayoutConfig } from "@/db/schema";
import type { AdsZoneRow } from "@/lib/ads";
import type { AdPosition } from "@/lib/ads-positions";
import type { ArticleListItem } from "@/lib/content";
import { homeBackgroundStyle } from "@/lib/home-background";
import { regionsCss, type RegionId } from "@/lib/home-regions";
import type { PopupConfig } from "@/lib/popup-types";
import { resolveParts, type FooterId, type NavbarId } from "@/lib/template-parts";

export type CanvasItem = ArticleListItem & { id: string; homePosition: number | null };
export type CanvasLayout = Required<HomeLayoutConfig>;

/**
 * La portada tal como se verá, con el diseño que se está editando (aunque
 * no esté guardado). La usan el lienzo del editor (dentro de un marco de
 * dispositivo) y la vista previa a tamaño real en una pestaña nueva.
 * Misma composición que la portada pública: contenido + barra lateral.
 */
export function HomeCanvasSite({
  layout,
  items,
  headerVariants,
  footerVariants,
  adsZones,
  adDrafts,
  adFocus = null,
  region = null,
  popup,
  popupPreview = false,
  onPopupClose,
  selected,
  overIndex,
  dragProps,
  hasStyle,
}: {
  layout: CanvasLayout;
  items: CanvasItem[];
  headerVariants: Record<NavbarId, React.ReactNode>;
  footerVariants: Record<FooterId, React.ReactNode>;
  adsZones: AdsZoneRow[];
  adDrafts: Record<string, AdDraft>;
  adFocus?: string | null;
  /** Componente marcado con borde punteado (el que se está editando). */
  region?: RegionId | null;
  popup?: PopupConfig;
  popupPreview?: boolean;
  onPopupClose?: () => void;
  selected?: number | null;
  overIndex?: number | null;
  dragProps?: (index: number) => React.HTMLAttributes<HTMLDivElement>;
  hasStyle?: (index: number) => boolean;
}) {
  const lead = items[0];
  const second = items[1];
  const rail = items.slice(2, 6);
  const river = items.slice(6);
  // Plantilla compuesta: la paleta es `templateId`; navbar, cuerpo y footer
  // pueden venir de plantillas distintas.
  const parts = resolveParts(layout.templateId, layout.parts);
  const Template = TEMPLATE_COMPONENTS[parts.body] ?? TEMPLATE_COMPONENTS.clasico;

  const opinion = items.find((a) => a.categorySlug === "opinion");
  const strip = [
    { label: "Actualidad", article: items[1] ?? items[0] },
    { label: "Especiales", article: items[2] ?? items[0] },
    { label: "Columna destacada", article: opinion ?? items[3] ?? items[0] },
  ].filter((x) => x.article);

  const ad = (position: AdPosition, className?: string) => (
    <AdsPreview position={position} zones={adsZones} drafts={adDrafts} focusKey={adFocus} className={className} />
  );

  return (
    <div
      className="relative flex min-h-screen flex-col bg-[var(--paper)] text-[var(--ink)] transition-colors"
      data-theme={layout.templateId}
      data-site-root
      style={homeBackgroundStyle(layout.background)}
    >
      <style
        dangerouslySetInnerHTML={{
          __html:
            regionsCss(layout.regions) +
            // Marca en el lienzo el componente que se está editando.
            (region ? `\n[data-site-root] [data-region="${region}"]{outline:2px dashed #b45309;outline-offset:-2px}` : ""),
        }}
      />
      {headerVariants[parts.navbar]}
      <main data-region="body" className="shell flex-1 py-8">
        {ad("home_top", "mx-auto mb-10")}
        {parts.body === "clasico" && (
          <div className="mb-10">
            <FeatureStrip items={strip} />
          </div>
        )}
        {/* Mismo esquema que la portada real: contenido + barra lateral. */}
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
          {/* `lx-bleed-off`, igual que en la portada real: sin él, los héroes a
              sangre (carrusel de Revista) se salen de su columna y tapan la lateral. */}
          <div className="lx-bleed-off min-w-0">
            <Template
              lead={lead}
              second={second}
              rail={rail}
              river={river}
              layout={layout}
              interactive={false}
              builderSelected={selected}
              builderOverIndex={overIndex}
              builderDragProps={dragProps}
              builderHasStyle={hasStyle}
            />
            {ad("home_billboard", "mx-auto mt-14")}
          </div>
          <aside className="flex flex-col gap-8">
            {ad("sidebar_top")}
            <div className="grid h-40 place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border)] p-4 text-center text-[0.7rem] text-[var(--fg-muted)]">
              Barra lateral: más leídas, boletín y redes
            </div>
            {ad("sidebar_bottom")}
            {ad("sidebar_sticky", "sticky top-4")}
          </aside>
        </div>
        {ad("home_bottom", "mx-auto mt-14")}
      </main>
      <div className="shell pb-10">{ad("footer", "mx-auto")}</div>
      {footerVariants[parts.footer]}
      {popup && popupPreview && <SitePopup key={JSON.stringify(popup)} config={popup} preview onClose={onPopupClose} />}
    </div>
  );
}
