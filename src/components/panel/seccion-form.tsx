"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { actualizarSeccion, type SeccionState } from "@/app/panel/(app)/secciones/actions";

/** Una sección (categoría) editable: nombre, descripción SEO y orden en el
 * menú. Colapsada por defecto — con 8+ secciones, todas abiertas a la vez
 * es más ruido que ayuda. */
export function SeccionForm({
  id,
  slug,
  name,
  description,
  sortOrder,
  articleCount,
  defaultOpen = false,
  onSaved,
}: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  articleCount: number;
  defaultOpen?: boolean;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, action, pending] = useActionState<SeccionState, FormData>(actualizarSeccion, null);

  useEffect(() => {
    if (state?.ok) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="font-semibold">{name}</span>
          <span className="ml-2 text-xs text-[var(--fg-muted)]">
            /categoria/{slug} · {articleCount} {articleCount === 1 ? "nota" : "notas"}
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <form action={action} className="flex flex-col gap-3 border-t border-[var(--border)] p-4">
          <input type="hidden" name="id" value={id} />
          <label className="flex flex-col gap-1">
            <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Nombre</span>
            <Input name="name" defaultValue={name} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              Descripción (meta description de la sección)
            </span>
            <Textarea name="description" defaultValue={description ?? ""} rows={2} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              Posición en el menú (1 = la primera a la izquierda)
            </span>
            <Input name="sortOrder" type="number" defaultValue={sortOrder} className="max-w-32" />
          </label>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending} className="text-xs">
              {pending && <Loader2 size={13} className="animate-spin" />}
              Guardar
            </Button>
            <a
              href={`/categoria/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="lx-link text-xs text-[var(--accent)]"
            >
              Ver la página ↗
            </a>
            {state && (
              <p
                role="status"
                className={`flex items-center gap-1.5 text-xs ${
                  state.ok ? "text-[var(--accent-2)]" : "text-[var(--danger,#b4442e)]"
                }`}
              >
                {state.ok ? <Check size={13} /> : <TriangleAlert size={13} />}
                {state.message}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
