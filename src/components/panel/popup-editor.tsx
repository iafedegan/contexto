"use client";

import { useState } from "react";
import { Eye, EyeOff, ImagePlus, Loader2 } from "lucide-react";
import { subirMedia } from "./subir-media";
import { parseEmbed } from "@/lib/embeds";
import type { PopupConfig } from "@/lib/popup-types";

/**
 * Diseño de la ventana emergente del portal: formato, imagen o vídeo, textos,
 * botón, colores, tamaño y reglas de aparición. Se ve en vivo en el lienzo con
 * «Ver en el lienzo» y se publica junto con el resto con «Publicar cambios».
 */
export function PopupEditor({
  value,
  onChange,
  previewing,
  onPreview,
}: {
  value: PopupConfig;
  onChange: (next: PopupConfig) => void;
  previewing?: boolean;
  /** Muestra u oculta la ventana en el lienzo sin activarla. Sin esto no hay botón: en la vista previa real la ventana se ve sola cuando está activada. */
  onPreview?: (on: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  // Cambia la configuración de la ventana emergente.
  const set = (p: Partial<PopupConfig>) => {
    setMsg("");
    onChange({ ...value, ...p });
  };

  // Sube la imagen de la ventana emergente.
  async function upload(file: File) {
    setUploading(true);
    setMsg("");
    try {
      const res = await subirMedia(file);
      if (!res.ok) return setMsg(res.error);
      set({ mediaUrl: res.url, mediaType: res.kind === "video" ? "video" : "image" });
    } catch {
      setMsg("No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  const embedOk = value.mediaType !== "embed" || !value.mediaUrl || !!parseEmbed(value.mediaUrl);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
        <span className="font-semibold">{value.enabled ? "Ventana emergente activada" : "Ventana emergente apagada"}</span>
        <input type="checkbox" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />
      </label>

      <Group title="Formato">
        <Seg
          value={value.layout}
          onChange={(layout) => set({ layout })}
          options={[
            ["modal", "Ventana centrada"],
            ["banner", "Franja inferior"],
            ["corner", "Esquina"],
          ]}
        />
      </Group>

      <Group title="Imagen o vídeo">
        <Seg
          value={value.mediaType}
          onChange={(mediaType) => set({ mediaType })}
          options={[
            ["none", "Sin medio"],
            ["image", "Imagen"],
            ["video", "Vídeo"],
            ["embed", "YouTube/Vimeo"],
          ]}
        />
        {value.mediaType !== "none" && (
          <div className="mt-2 flex flex-col gap-2">
            {value.mediaType !== "embed" && (
              <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)]">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                {uploading ? "Subiendo…" : value.mediaType === "video" ? "Subir vídeo (MP4/WebM)" : "Subir imagen"}
                <input
                  type="file"
                  accept={value.mediaType === "video" ? "video/mp4,video/webm" : "image/*"}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void upload(f);
                  }}
                />
              </label>
            )}
            <input
              value={value.mediaUrl}
              onChange={(e) => set({ mediaUrl: e.target.value })}
              placeholder={value.mediaType === "embed" ? "https://www.youtube.com/watch?v=…" : "…o pega la URL (https://…)"}
              className="lx-input !py-1.5 !text-xs"
            />
            {!embedOk && <p className="text-xs text-[var(--danger,#b4442e)]">Solo enlaces de YouTube o Vimeo.</p>}
            {value.layout === "modal" && (
              <Seg
                value={value.mediaPosition}
                onChange={(mediaPosition) => set({ mediaPosition })}
                options={[
                  ["top", "Arriba"],
                  ["left", "Al lado"],
                  ["background", "De fondo"],
                ]}
              />
            )}
          </div>
        )}
      </Group>

      <Group title="Textos y botón">
        <input value={value.kicker} onChange={(e) => set({ kicker: e.target.value })} placeholder="Antetítulo (opcional)" className="lx-input !py-1.5 !text-sm" />
        <input value={value.title} onChange={(e) => set({ title: e.target.value })} placeholder="Título" className="lx-input !py-1.5 !text-sm font-semibold" />
        <textarea value={value.text} onChange={(e) => set({ text: e.target.value })} rows={3} placeholder="Texto" className="lx-input resize-y !py-1.5 !text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input value={value.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} placeholder="Texto del botón" className="lx-input !py-1.5 !text-xs" />
          <input value={value.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="Enlace (/… o https://…)" className="lx-input !py-1.5 !text-xs" />
        </div>
      </Group>

      <Group title="Diseño">
        <div className="grid grid-cols-3 gap-2">
          <Color label="Fondo" value={value.bg} onChange={(bg) => set({ bg })} />
          <Color label="Texto" value={value.fg} onChange={(fg) => set({ fg })} />
          <Color label="Botón" value={value.accent} onChange={(accent) => set({ accent })} />
        </div>
        {value.layout === "modal" && (
          <Range label="Ancho" unit="px" min={320} max={960} step={20} value={value.width} onChange={(width) => set({ width })} />
        )}
        <Range label="Esquinas" unit="px" min={0} max={40} step={2} value={value.radius} onChange={(radius) => set({ radius })} />
      </Group>

      <Group title="Cuándo aparece">
        <Range label="Espera antes de salir" unit="s" min={0} max={60} step={1} value={value.delay} onChange={(delay) => set({ delay })} />
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--fg-muted)]">Frecuencia por lector</span>
          <select value={value.frequency} onChange={(e) => set({ frequency: e.target.value as PopupConfig["frequency"] })} className="lx-input !w-auto !py-1 !text-xs">
            <option value="always">En cada página</option>
            <option value="session">Una vez por visita</option>
            <option value="daily">Una vez al día</option>
            <option value="weekly">Una vez por semana</option>
            <option value="once">Solo una vez</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--fg-muted)]">Páginas</span>
          <select value={value.pages} onChange={(e) => set({ pages: e.target.value as PopupConfig["pages"] })} className="lx-input !w-auto !py-1 !text-xs">
            <option value="all">Todo el sitio</option>
            <option value="home">Solo la portada</option>
            <option value="articles">Solo en las notas</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[var(--fg-muted)]">Desde (opcional)</span>
            <input type="date" value={value.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className="lx-input !py-1 !text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--fg-muted)]">Hasta (opcional)</span>
            <input type="date" value={value.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className="lx-input !py-1 !text-xs" />
          </label>
        </div>
      </Group>

      <div className="flex flex-wrap items-center gap-2">
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(!previewing)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3.5 py-2 text-xs font-semibold transition hover:border-[var(--accent)]"
          >
            {previewing ? <EyeOff size={13} /> : <Eye size={13} />} {previewing ? "Ocultar del lienzo" : "Ver en el lienzo"}
          </button>
        )}
        {msg && <span className="text-xs text-[var(--fg-muted)]">{msg}</span>}
        {!embedOk && <span role="alert" className="basis-full text-xs font-semibold text-[#b4442e]">La dirección del vídeo no es de YouTube ni Vimeo: así no se mostrará.</span>}
        <span className="basis-full text-xs text-[var(--fg-muted)]">Los cambios quedan en el borrador y se publican con «Publicar cambios».</span>
      </div>
    </div>
  );
}

// Grupo de opciones con título.
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
      <legend className="meta pr-2 !text-xs">{title}</legend>
      {children}
    </fieldset>
  );
}

// Selector segmentado de opciones.
function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-md border px-2.5 py-1 text-xs transition ${
            value === v ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Selector de color con su etiqueta.
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
      {label}
    </label>
  );
}

// Deslizador con su etiqueta y su valor.
function Range({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-xs">
      <span className="flex justify-between">
        <span className="text-[var(--fg-muted)]">{label}</span>
        <span className="font-semibold tabular-nums">
          {value} {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" />
    </label>
  );
}
