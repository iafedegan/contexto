"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdDraft } from "@/components/panel/ads-zone-form";
import type { Item, Layout } from "@/components/panel/portada-types";
import type { PopupConfig } from "@/lib/popup-types";
import { stable } from "@/lib/portada-summary";

/** Todo lo que se edita en la portada y se puede deshacer. */
export type EditorSnap = {
  items: Item[];
  layout: Layout;
  popup: PopupConfig;
  adDrafts: Record<string, AdDraft>;
  auto: boolean;
};

const key = (s: EditorSnap) =>
  stable({ i: s.items.map((i) => [i.slug, i.homeStyle ?? null]), l: s.layout, p: s.popup, a: s.adDrafts, u: s.auto });

/**
 * Deshacer y rehacer del editor (Cmd/Ctrl+Z y Mayús+Cmd/Ctrl+Z).
 *
 * Cada «ráfaga» de cambios seguidos (arrastrar un deslizador, escribir en un
 * campo) cuenta como UN paso: el estado anterior a la ráfaga se guarda al
 * primer cambio y no otra vez hasta que pasa un momento sin tocar nada.
 */
export function usePortadaHistory(current: EditorSnap, apply: (s: EditorSnap) => void) {
  const past = useRef<EditorSnap[]>([]);
  const future = useRef<EditorSnap[]>([]);
  const last = useRef<EditorSnap>(current);
  const lastKey = useRef(key(current));
  const burst = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  // Se actualiza fuera del cuerpo de los efectos (setTimeout) para no provocar renders en cascada.
  const bump = useCallback(() => {
    setTimeout(() => setCounts({ undo: past.current.length, redo: future.current.length }), 0);
  }, []);

  const k = key(current);
  useEffect(() => {
    if (k === lastKey.current) return;
    if (!burst.current) {
      past.current.push(last.current);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      burst.current = true;
      bump();
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      burst.current = false;
    }, 700);
    last.current = current;
    lastKey.current = k;
    // `current` se lee solo cuando `k` (su contenido) cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return false;
    future.current.push(last.current);
    last.current = prev;
    lastKey.current = key(prev);
    burst.current = false;
    apply(prev);
    bump();
    return true;
  }, [apply, bump]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return false;
    past.current.push(last.current);
    last.current = next;
    lastKey.current = key(next);
    burst.current = false;
    apply(next);
    bump();
    return true;
  }, [apply, bump]);

  /** Marca el estado actual como punto de partida (p. ej. tras publicar). */
  const clear = useCallback(() => {
    past.current = [];
    future.current = [];
    burst.current = false;
    bump();
  }, [bump]);

  return { undo, redo, clear, canUndo: counts.undo > 0, canRedo: counts.redo > 0 };
}
