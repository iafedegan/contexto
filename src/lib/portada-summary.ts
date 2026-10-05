import type { HomeLayoutConfig, HomeStyle } from "@/db/schema";
import type { AdDraft } from "@/components/panel/ads-zone-form";
import { HOME_TEMPLATES } from "@/lib/home-layout";
import { REGIONS } from "@/lib/home-regions";
import type { PopupConfig } from "@/lib/popup-types";

// Diseño de portada con todos sus campos.
type Layout = Required<HomeLayoutConfig>;

/**
 * Lo que se compara entre «lo publicado» y «lo que se está editando». Es el
 * mismo cuadro que guarda el borrador (ver portada-draft.ts), más un indicador
 * de «orden y estilo automáticos» para «Volver al diseño original».
 */
export type PortadaState = {
  layout: Layout;
  items: { slug: string; homeStyle: HomeStyle | null }[];
  popup: PopupConfig;
  /** Anuncios con borrador, por clave de zona. */
  ads: Record<string, AdDraft>;
  /** true = la portada vuelve al orden y estilo automáticos al publicar. */
  auto?: boolean;
};

// Una línea del resumen de cambios pendientes de publicar.
export type ChangeLine = {
  id: string;
  text: string;
  /** Algo que conviene saber antes de publicar (p. ej. un anuncio que no se verá). */
  warn?: boolean;
};

/** JSON con las claves ordenadas: compara contenido, no el orden en que se escribió. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

// Anuncio vacío, sin creatividad ni fechas.
export const emptyAd: AdDraft = { imageUrl: "", clickUrl: "", html: "", active: false, startsAt: "", endsAt: "" };

// Nombre de una plantilla por su id.
const templateName = (id: string | undefined) => HOME_TEMPLATES.find((t) => t.id === id)?.name ?? "Personalizada";

// Lista de nombres separados por comas, resumida si son más de los permitidos.
const listar = (xs: string[], max = 3) =>
  xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} y ${xs.length - max} más`;

/** Popup sin el contador de versión (cambia solo al guardar). */
const popupCmp = (p: PopupConfig) => stable({ ...p, version: 0 });

/** Un anuncio sin los campos de fecha vacíos, para que «sin fecha» no cuente como cambio. */
const adCmp = (d: AdDraft) => stable({ ...d, startsAt: d.startsAt || "", endsAt: d.endsAt || "" });

/**
 * Lista legible de lo que cambia al publicar. Cada línea es una «cosa» distinta
 * (plantilla, partes, notas, ventana, anuncios…), no una por cada ajuste.
 */
export function summarizeChanges(
  base: PortadaState,
  cur: PortadaState,
  ctx: {
    /** Título de cada nota por slug. */
    titles: Record<string, string>;
    /** Anuncios guardados (para saber qué cambió) y el nombre de cada zona. */
    adsBase: Record<string, AdDraft>;
    adNames: Record<string, string>;
  },
): ChangeLine[] {
  const out: ChangeLine[] = [];

  // --- Plantilla y disposición ---------------------------------------------
  const bl = base.layout;
  const cl = cur.layout;
  if (bl.templateId !== cl.templateId) {
    out.push({ id: "plantilla", text: `Plantilla: ${templateName(bl.templateId)} → ${templateName(cl.templateId)}` });
  }
  if (stable(bl.parts) !== stable(cl.parts)) {
    out.push({ id: "composicion", text: "Composición de cabecera, cuerpo o pie" });
  }
  if (bl.breveDirection !== cl.breveDirection || bl.breveColumns !== cl.breveColumns || bl.riverColumns !== cl.riverColumns) {
    out.push({ id: "disposicion", text: "Disposición de «En breve» y «Lo más reciente»" });
  }
  if (stable(bl.background) !== stable(cl.background)) {
    out.push({ id: "fondo", text: "Fondo de la página" });
  }
  const partes = REGIONS.filter((r) => stable(bl.regions?.[r.id]) !== stable(cl.regions?.[r.id])).map((r) => r.label);
  if (partes.length) {
    out.push({ id: "partes", text: `${partes.length === 1 ? "Parte" : "Partes"} de la portada: ${listar(partes, 5)}` });
  }
  if (stable(bl.sectionEls) !== stable(cl.sectionEls) || bl.sectionFilters !== cl.sectionFilters) {
    out.push({ id: "secciones", text: "Encabezado de las secciones" });
  }
  if (stable(bl.zones) !== stable(cl.zones)) {
    out.push({ id: "zonas", text: "Zonas de la cuadrícula (columnas, filas, espacio)" });
  }

  // --- Notas: orden y estilo -----------------------------------------------
  if (cur.auto && !base.auto) {
    out.push({ id: "auto", text: "Notas: vuelven al orden y estilo automáticos" });
  } else if (!cur.auto) {
    const baseOrder = base.items.map((i) => i.slug).join("|");
    const curOrder = cur.items.map((i) => i.slug).join("|");
    if (baseOrder !== curOrder) out.push({ id: "orden", text: "Orden de las notas en la portada" });
    const baseStyle = new Map(base.items.map((i) => [i.slug, stable(i.homeStyle ?? null)]));
    const cambiadas = cur.items.filter((i) => (baseStyle.get(i.slug) ?? stable(null)) !== stable(i.homeStyle ?? null));
    if (cambiadas.length) {
      const nombres = cambiadas.map((i) => `«${(ctx.titles[i.slug] ?? i.slug).slice(0, 42)}»`);
      out.push({ id: "estilo", text: `Estilo de ${cambiadas.length === 1 ? "la nota" : `${cambiadas.length} notas`}: ${listar(nombres, 2)}` });
    }
  }

  // --- Ventana emergente -----------------------------------------------------
  if (popupCmp(base.popup) !== popupCmp(cur.popup)) {
    out.push({
      id: "popup",
      text: cur.popup.enabled
        ? base.popup.enabled
          ? "Ventana emergente: contenido o diseño modificado"
          : "Ventana emergente: se activa"
        : base.popup.enabled
          ? "Ventana emergente: se apaga"
          : "Ventana emergente: modificada (sigue apagada)",
    });
  }

  // --- Anuncios ----------------------------------------------------------------
  const anuncios = Object.entries(cur.ads).filter(([key, d]) => adCmp(d) !== adCmp(ctx.adsBase[key] ?? emptyAd));
  if (anuncios.length) {
    out.push({ id: "anuncios", text: `Publicidad: ${anuncios.length} ${anuncios.length === 1 ? "anuncio con cambios" : "anuncios con cambios"}` });
    for (const [key, d] of anuncios) {
      const tiene = !!d.html || /^https?:\/\//i.test(d.imageUrl);
      if (tiene && !d.active) {
        out.push({
          id: `anuncio-${key}`,
          text: `«${ctx.adNames[key] ?? key}» tiene contenido pero no está marcado como activo: no se verá en el sitio`,
          warn: true,
        });
      }
    }
  }

  return out;
}

/** Cuántos «cambios» cuenta el aviso de estado (las advertencias no suman). */
export const countChanges = (lines: ChangeLine[]) => lines.filter((l) => !l.warn).length;
