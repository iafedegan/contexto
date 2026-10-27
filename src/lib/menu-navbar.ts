import { HOME_FONTS, homeFontFamily, type HomeTitleFont } from "@/lib/home-fonts";
import { acotar, colorHex } from "@/lib/validate";

/**
 * Ajustes del menú de la barra de navegación que se editan en /panel/portada (Cabecera › Menú): qué secciones principales se muestran, enlaces
 * propios al final y si las secciones despliegan sus subsecciones. Es presentación (borrador y publicación como el resto del diseño); el orden y los
 * nombres de las secciones siguen en «Menú y secciones». Sin `server-only`: lo usa el editor (cliente).
 */
export type MenuNavbar = {
  /** Slugs de secciones principales (o `observatorio`) que no se muestran en la barra. */
  ocultas?: string[];
  /** Enlaces propios que se añaden al final de la barra. */
  extras?: { label: string; href: string }[];
  /** `false` quita los menús desplegables de subsecciones. */
  submenus?: boolean;
  /** Aspecto de los enlaces de la barra. */
  estilo?: EstiloMenu;
};

export type EstiloMenu = {
  /** Color del texto de los enlaces. */
  color?: string;
  font?: HomeTitleFont;
  /** Tamaño del texto, en px (10-24). */
  tamano?: number;
  /** Espacio entre enlaces, en px (0-60). */
  espacio?: number;
  /** Espaciado entre letras, en décimas de px (0-60 = 0-6 px). */
  letras?: number;
  /** Mayúsculas (`true`) o minúsculas normales (`false`). */
  mayusculas?: boolean;
};

function sanitizeEstilo(input: unknown): EstiloMenu | undefined {
  if (!input || typeof input !== "object") return undefined;
  const e = input as Record<string, unknown>;
  const s: EstiloMenu = {
    color: colorHex(e.color),
    font: HOME_FONTS.some((f) => f.id === e.font) ? (e.font as HomeTitleFont) : undefined,
    tamano: acotar(e.tamano, 10, 24),
    espacio: acotar(e.espacio, 0, 60),
    letras: acotar(e.letras, 0, 60),
    mayusculas: typeof e.mayusculas === "boolean" ? e.mayusculas : undefined,
  };
  const limpio = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as EstiloMenu;
  return Object.keys(limpio).length ? limpio : undefined;
}

/** Hoja CSS del aspecto de los enlaces de la barra (valores ya validados). */
export function menuNavCss(menu: MenuNavbar | undefined, scope = "[data-site-root]"): string {
  const e = menu?.estilo;
  if (!e) return "";
  // El menú a pantalla completa del móvil (#mobile-menu) tiene su propia tipografía: el estilo es solo de la barra.
  const nav = `${scope} [data-region="navbar"] nav:not(#mobile-menu nav)`;
  const enlaces = `${nav} a:not([role="menuitem"])`;
  const nd: string[] = [];
  const ld: string[] = [];
  if (e.espacio !== undefined) nd.push(`gap:${e.espacio}px!important`);
  if (e.tamano) {
    nd.push(`font-size:${e.tamano}px!important`);
    ld.push(`font-size:${e.tamano}px!important`);
  }
  if (e.color) ld.push(`color:${e.color}!important`);
  const fam = homeFontFamily(e.font);
  if (fam) ld.push(`font-family:${fam}!important`);
  if (e.letras !== undefined) ld.push(`letter-spacing:${e.letras / 10}px!important`);
  if (e.mayusculas !== undefined) ld.push(`text-transform:${e.mayusculas ? "uppercase" : "none"}!important`);
  return [nd.length ? `${nav}{${nd.join(";")}}` : "", ld.length ? `${enlaces}{${ld.join(";")}}` : ""].filter(Boolean).join("\n");
}

export const MAX_EXTRAS = 6;
const MAX_ETIQUETA = 30;

// Solo rutas del sitio o enlaces https: nada de `javascript:` ni esquemas raros.
const hrefValido = (v: string) => /^\/(?!\/)[\w\-./?=&#%]*$/.test(v) || /^https:\/\/[^\s<>"']+$/.test(v);

/** Valida lo que llegue del navegador o de la base; `undefined` si no hay ningún ajuste. */
export function sanitizeMenuNavbar(input: unknown): MenuNavbar | undefined {
  if (!input || typeof input !== "object") return undefined;
  const m = input as Record<string, unknown>;
  const out: MenuNavbar = {};
  if (Array.isArray(m.ocultas)) {
    const o = [...new Set(m.ocultas.filter((s): s is string => typeof s === "string" && /^[\w-]{1,80}$/.test(s)))].slice(0, 40);
    if (o.length) out.ocultas = o;
  }
  if (Array.isArray(m.extras)) {
    const e = m.extras
      .map((x) => {
        const r = (x ?? {}) as Record<string, unknown>;
        const label = typeof r.label === "string" ? r.label.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ETIQUETA) : "";
        const href = typeof r.href === "string" ? r.href.trim().slice(0, 300) : "";
        return label && hrefValido(href) ? { label, href } : null;
      })
      .filter((x): x is { label: string; href: string } => !!x)
      .slice(0, MAX_EXTRAS);
    if (e.length) out.extras = e;
  }
  if (m.submenus === false) out.submenus = false;
  const estilo = sanitizeEstilo(m.estilo);
  if (estilo) out.estilo = estilo;
  return Object.keys(out).length ? out : undefined;
}

/** Aplica los ajustes a la lista de la barra (el Observatorio se identifica por su dirección). */
export function aplicarMenu<T extends { href: string; label: string; children?: T[] }>(items: T[], menu?: MenuNavbar): T[] {
  if (!menu) return items;
  const ocultas = new Set(menu.ocultas ?? []);
  const slugDe = (href: string) => href.split("/").pop() ?? href;
  const base = items
    .filter((i) => !ocultas.has(slugDe(i.href)))
    .map((i) => (menu.submenus === false && i.children ? { ...i, children: undefined } : i));
  return [...base, ...(menu.extras ?? []).map((e) => ({ href: e.href, label: e.label }) as T)];
}
