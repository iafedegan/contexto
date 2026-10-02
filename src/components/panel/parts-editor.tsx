"use client";

import { Check } from "lucide-react";
import type { HomeLayoutConfig } from "@/db/schema";
import { HOME_TEMPLATES } from "@/lib/home-layout";
import { BODIES, FOOTERS, NAVBARS, PRESET_PARTS, resolveParts, type TemplateParts } from "@/lib/template-parts";

type Layout = Required<HomeLayoutConfig>;

/**
 * Componer una plantilla desde cero: paleta (colores y tipografías), navbar,
 * cuerpo y footer se eligen por separado. Los cambios se ven al instante en el
 * lienzo y se guardan con «Guardar diseño».
 */
export function PartsEditor({ layout, onChange }: { layout: Layout; onChange: (p: Partial<Layout>) => void }) {
  const parts = resolveParts(layout.templateId, layout.parts);
  const preset = PRESET_PARTS[layout.templateId];
  const custom = (Object.keys(parts) as (keyof TemplateParts)[]).some((k) => parts[k] !== preset[k]);

  const setPart = (p: TemplateParts) => onChange({ parts: { ...parts, ...p } });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
        Combina piezas de distintas plantillas. {custom ? "Estás usando una plantilla personalizada." : "Ahora mismo coincide con la plantilla base."}
      </p>

      <Group title="1 · Paleta (colores y tipografías)">
        <div className="grid grid-cols-5 gap-1.5">
          {HOME_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.name}
              onClick={() => onChange({ templateId: t.id, parts })}
              aria-pressed={layout.templateId === t.id}
              className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[0.72rem] transition ${
                layout.templateId === t.id ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : "border-[var(--border)]"
              }`}
            >
              <span data-theme={t.id} className="flex h-6 w-full overflow-hidden rounded">
                <span className="flex-1 bg-[var(--bg)]" />
                <span className="w-2 bg-[var(--accent)]" />
                <span className="w-2 bg-[var(--fg)]" />
              </span>
              <span className="truncate">{t.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="2 · Navbar">
        <Options options={NAVBARS} value={parts.navbar} onPick={(navbar) => setPart({ navbar })} />
      </Group>
      <Group title="3 · Cuerpo (portada, secciones y notas)">
        <Options options={BODIES} value={parts.body} onPick={(body) => setPart({ body })} />
      </Group>
      <Group title="4 · Footer">
        <Options options={FOOTERS} value={parts.footer} onPick={(footer) => setPart({ footer })} />
      </Group>

      {custom && (
        <button
          type="button"
          onClick={() => onChange({ parts: {} })}
          className="self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Volver a las piezas de la plantilla base
        </button>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="meta mb-2 !text-xs">{title}</p>
      {children}
    </div>
  );
}

function Options<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { id: T; label: string; description: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            aria-pressed={on}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
              on ? "border-[var(--accent)] bg-[var(--surface-2)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
            }`}
          >
            <span
              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                on ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border-strong)]"
              }`}
            >
              {on && <Check size={10} />}
            </span>
            <span>
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="block text-xs leading-snug text-[var(--fg-muted)]">{o.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
