"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { ColorRow, FontSelect, Group } from "@/components/panel/region-editor";
import { MAX_EXTRAS, type EstiloMenu, type MenuNavbar } from "@/lib/menu-navbar";

/**
 * «Menú» de la barra: qué secciones principales se ven, enlaces propios al final y si se despliegan subsecciones. Cada cambio entra al borrador y
 * se ve al momento en el lienzo. El orden y los nombres de las secciones se editan en «Menú y secciones».
 */
export function MenuNavbarEditor({
  value,
  onChange,
  secciones,
}: {
  value: MenuNavbar | undefined;
  onChange: (next: MenuNavbar | undefined) => void;
  secciones: { slug: string; name: string }[];
}) {
  const m = value ?? {};
  const ocultas = new Set(m.ocultas ?? []);
  const extras = m.extras ?? [];
  // Aplica un cambio quitando lo que queda vacío (sin ajustes = `undefined`).
  function patch(p: Partial<MenuNavbar>) {
    const merged: MenuNavbar = { ...m, ...p };
    if (!merged.ocultas?.length) delete merged.ocultas;
    if (!merged.extras?.length) delete merged.extras;
    if (merged.submenus !== false) delete merged.submenus;
    onChange(Object.keys(merged).length ? merged : undefined);
  }
  const alternar = (slug: string) => {
    const s = new Set(ocultas);
    if (s.has(slug)) s.delete(slug);
    else s.add(slug);
    patch({ ocultas: [...s] });
  };
  const setExtra = (i: number, p: Partial<{ label: string; href: string }>) => patch({ extras: extras.map((e, j) => (j === i ? { ...e, ...p } : e)) });
  // Cambia el aspecto de los enlaces quitando lo que queda sin valor.
  function estilo(p: Partial<EstiloMenu>) {
    const e: EstiloMenu = { ...m.estilo, ...p };
    for (const k of Object.keys(e) as (keyof EstiloMenu)[]) if (e[k] === undefined) delete e[k];
    patch({ estilo: Object.keys(e).length ? e : undefined });
  }
  const num = (label: string, v: number | undefined, min: number, max: number, k: "tamano" | "espacio" | "letras") => (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={v ?? ""}
        placeholder="auto"
        onChange={(e) => estilo({ [k]: e.target.value === "" ? undefined : Math.min(max, Math.max(min, Number(e.target.value))) })}
        className="w-20 rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-1 text-sm text-[#0b0b0b]"
      />
    </label>
  );
  const campo = "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-white px-2 py-1.5 text-sm text-[#0b0b0b] placeholder:text-[var(--fg-muted)]";
  return (
    <Group title="Menú de la barra">
      <p className="text-xs leading-relaxed text-[var(--fg-muted)]">Marca las secciones que se muestran. Las demás no aparecen en la barra.</p>
      <div className="flex flex-col gap-1.5">
        {[...secciones, { slug: "observatorio", name: "Observatorio" }].map((s) => (
          <label key={s.slug} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!ocultas.has(s.slug)} onChange={() => alternar(s.slug)} />
            {s.name}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={m.submenus !== false} onChange={(e) => patch({ submenus: e.target.checked ? undefined : false })} />
        Desplegar subsecciones
      </label>
      <p className="mt-1 text-sm font-semibold">Aspecto de los enlaces</p>
      <ColorRow label="Color del texto" value={m.estilo?.color} onChange={(color) => estilo({ color })} />
      <FontSelect label="Tipo de letra" value={m.estilo?.font} onChange={(font) => estilo({ font })} />
      {num("Tamaño del texto (px)", m.estilo?.tamano, 10, 24, "tamano")}
      {num("Espacio entre enlaces (px)", m.estilo?.espacio, 0, 60, "espacio")}
      {num("Espaciado entre letras (décimas de px)", m.estilo?.letras, 0, 60, "letras")}
      <label className="flex items-center gap-2 text-sm">
        <select
          value={m.estilo?.mayusculas === undefined ? "" : m.estilo.mayusculas ? "si" : "no"}
          onChange={(e) => estilo({ mayusculas: e.target.value === "" ? undefined : e.target.value === "si" })}
          className={campo}
        >
          <option value="">Mayúsculas: según la plantilla</option>
          <option value="si">MAYÚSCULAS</option>
          <option value="no">Minúsculas normales</option>
        </select>
      </label>
      <p className="mt-1 text-sm font-semibold">Enlaces propios</p>
      {extras.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input className={campo} value={e.label} maxLength={30} placeholder="Texto" onChange={(ev) => setExtra(i, { label: ev.target.value })} />
          <input className={campo} value={e.href} placeholder="/ruta o https://…" onChange={(ev) => setExtra(i, { href: ev.target.value })} />
          <button type="button" aria-label="Quitar enlace" onClick={() => patch({ extras: extras.filter((_, j) => j !== i) })} className="text-[var(--fg-muted)] hover:text-[var(--danger)]">
            <X size={14} />
          </button>
        </div>
      ))}
      {extras.length < MAX_EXTRAS && (
        <button type="button" onClick={() => patch({ extras: [...extras, { label: "", href: "" }] })} className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-[var(--accent)] hover:underline">
          <Plus size={12} aria-hidden /> Añadir enlace
        </button>
      )}
      <p className="text-xs text-[var(--fg-muted)]">Solo se muestran los enlaces con texto y una dirección válida (empieza por / o https://).</p>
      {value && (
        <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-[var(--accent)] hover:underline">
          <RotateCcw size={12} aria-hidden /> Volver al menú original
        </button>
      )}
    </Group>
  );
}
