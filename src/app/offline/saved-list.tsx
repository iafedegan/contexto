"use client";

import { useEffect, useState } from "react";

type Saved = { slug: string; title: string };

/**
 * Notas descargadas por el Service Worker para leer sin conexión (índice en
 * la caché `cg-meta`). Solo se listan las que siguen guardadas.
 */
export function SavedList() {
  const [items, setItems] = useState<Saved[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const meta = await caches.open("cg-meta");
        const res = await meta.match("/__offline-index");
        if (!res) return setItems([]);
        const data = (await res.json()) as { savedAt: number; articles: Saved[] };
        const pages = await caches.open("cg-pages");
        const present: Saved[] = [];
        for (const a of data.articles) {
          if (await pages.match(new URL(`/articulo/${a.slug}`, location.origin).href, { ignoreSearch: true })) present.push(a);
        }
        setSavedAt(data.savedAt);
        setItems(present);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  if (!items || items.length === 0) return null;
  return (
    <div className="mt-6 w-full text-left">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fg-muted)]">
        Disponibles sin conexión
        {savedAt && ` · actualizado ${new Date(savedAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}`}
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
        {items.map((a) => (
          <li key={a.slug}>
            <a href={`/articulo/${a.slug}`} className="block px-4 py-3 text-sm font-medium hover:bg-[var(--surface-2)]">
              {a.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
