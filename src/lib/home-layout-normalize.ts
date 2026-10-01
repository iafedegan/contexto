import type { HomeLayoutConfig } from "@/db/schema";
import { HOME_TEMPLATES } from "@/lib/home-layout";
import { sanitizeRegions } from "@/lib/home-regions";
import { sanitizeSectionEls } from "@/lib/section-els";
import { BODIES, FOOTERS, NAVBARS } from "@/lib/template-parts";

/**
 * Valida un diseño de portada antes de guardarlo o de pintarlo: el estilo por
 * componente acaba convertido en CSS, así que no se confía en lo que llegue.
 * Lo comparten el guardado del diseño y la vista previa del borrador.
 */
export function normalizeLayout(input: HomeLayoutConfig): HomeLayoutConfig {
  const parts = {
    navbar: NAVBARS.find((n) => n.id === input.parts?.navbar)?.id,
    body: BODIES.find((b) => b.id === input.parts?.body)?.id,
    footer: FOOTERS.find((f) => f.id === input.parts?.footer)?.id,
  };
  const templateId = HOME_TEMPLATES.find((t) => t.id === input.templateId)?.id;
  const sectionFilters = (["cabecera", "izquierda", "centro", "derecha", "barra", "oculto"] as const).find((p) => p === input.sectionFilters);
  return { ...input, ...(templateId ? { templateId } : {}), regions: sanitizeRegions(input.regions), parts, sectionFilters: sectionFilters ?? "cabecera", sectionEls: sanitizeSectionEls(input.sectionEls) };
}
