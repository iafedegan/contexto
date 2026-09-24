"use client";

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Presente solo dentro de /panel/portada: deja seleccionar (para abrir el
 * inspector de estilo) y arrastrar cada tarjeta tal como se ve realmente en
 * la plantilla — ya no hay una lista genérica aparte para "editar". */
export type BuilderProps = {
  builderSelected?: number | null;
  builderOverIndex?: number | null;
  builderDragProps?: (index: number) => React.HTMLAttributes<HTMLDivElement>;
  builderHasStyle?: (index: number) => boolean;
};

/** Envuelve una tarjeta real para hacerla seleccionable/arrastrable dentro
 * del editor — sin envoltorio (ni cambio de DOM) cuando se renderiza en el
 * sitio público, donde `builderDragProps` nunca se pasa. */
export function EditableCard({
  index,
  builderSelected,
  builderOverIndex,
  builderDragProps,
  hasStyle,
  className,
  children,
}: {
  index: number;
  builderSelected?: number | null;
  builderOverIndex?: number | null;
  builderDragProps?: (index: number) => React.HTMLAttributes<HTMLDivElement>;
  hasStyle?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // La principal es el «hero»; el resto, «tarjetas». Lo usa el estilo por
  // componente de /panel/portada (src/lib/home-regions.ts).
  const region = index === 0 ? "hero" : "cards";
  if (!builderDragProps) return <div data-region={region} className={className}>{children}</div>;

  const isSelected = builderSelected === index;
  const isOver = builderOverIndex === index;
  return (
    <div
      {...builderDragProps(index)}
      data-region={region}
      className={cn(
        "group/editable relative h-full cursor-pointer outline-2 outline-offset-2 transition",
        isSelected
          ? "outline outline-[var(--brand)]"
          : isOver
            ? "outline-dashed outline-[var(--brand)]"
            : "outline-dashed outline-transparent hover:outline-[color-mix(in_srgb,var(--brand)_45%,transparent)]",
        className,
      )}
    >
      <span className="pointer-events-none absolute -left-2 -top-2 z-20 flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[var(--ink-faint)] opacity-0 shadow-sm ring-1 ring-[var(--rule)] transition-opacity group-hover/editable:opacity-100">
        <GripVertical size={10} />
        {index + 1}
      </span>
      {hasStyle && (
        <span className="pointer-events-none absolute -top-2 right-1 z-20 rounded-full bg-[var(--ink)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
          Estilo
        </span>
      )}
      {children}
    </div>
  );
}
