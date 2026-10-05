"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteArticle } from "@/app/panel/(app)/articulos/actions";

/** Borra un artículo tras confirmar. En uno publicado avisa que sale del sitio. */
export function DeleteArticleButton({ id, title, published }: { id: string; title: string; published: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  // Pide confirmación y borra la nota.
  function onDelete() {
    const aviso = published
      ? `«${title}» está PUBLICADO: dejará de verse en el sitio y se borrará para siempre.\n\n¿Eliminarlo?`
      : `¿Eliminar «${title}» para siempre? No se puede deshacer.`;
    if (!window.confirm(aviso)) return;
    setError("");
    start(async () => {
      try {
        const res = await deleteArticle(id);
        if (!res.ok) return setError(res.message);
        router.refresh();
      } catch {
        setError("No se pudo eliminar (¿tu rol lo permite?).");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        title="Eliminar artículo"
        aria-label={`Eliminar ${title}`}
        className="inline-flex size-8 items-center justify-center rounded-full pointer-coarse:size-11 border border-[var(--border)] text-[var(--fg-muted)] transition hover:border-[var(--danger,#b4442e)] hover:text-[var(--danger,#b4442e)] disabled:opacity-50"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
      {error && <span className="text-xs text-[var(--danger,#b4442e)]">{error}</span>}
    </span>
  );
}
