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
};

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
