"use client";

import { useMemo, useState } from "react";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { saveArticle } from "@/app/panel/articulos/actions";

type Option = { id: string; name: string };
type Initial = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  categoryId: string | null;
  authorId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  tags: string[];
  slug: string | null;
};

/** Asistencia de posicionamiento: chequeos antes de publicar (sin keyword stuffing). */
function seoHints(title: string, metaTitle: string, metaDesc: string, excerpt: string) {
  const t = (metaTitle || title).trim();
  const d = (metaDesc || excerpt).trim();
  const hints: { ok: boolean; text: string }[] = [];
  hints.push({ ok: t.length >= 15 && t.length <= 65, text: `Title ${t.length} car. (ideal 15–65)` });
  hints.push({ ok: d.length >= 70 && d.length <= 155, text: `Description ${d.length} car. (ideal 70–155)` });
  hints.push({
    ok: !/(,\s*){4,}/.test(d) && d.split(" ").length > 8,
    text: "Description en prosa, no lista de términos",
  });
  hints.push({ ok: excerpt.trim().length > 0, text: "Resumen presente (fuente de la meta description)" });
  return hints;
}

export function ArticleEditor({
  initial,
  categories,
  authors,
  canPublish,
  publishAction,
  scheduleAction,
  submitForReviewAction,
  status,
}: {
  initial: Initial;
  categories: Option[];
  authors: Option[];
  canPublish: boolean;
  publishAction: () => Promise<void>;
  scheduleAction: (iso: string) => Promise<void>;
  submitForReviewAction: () => Promise<void>;
  status: string;
}) {
  const [title, setTitle] = useState(initial.title);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [body, setBody] = useState(initial.body);
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription ?? "");
  const [schedule, setSchedule] = useState("");

  const hints = useMemo(
    () => seoHints(title, metaTitle, metaDescription, excerpt),
    [title, metaTitle, metaDescription, excerpt],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <form action={saveArticle} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={initial.id} />

        <label className="text-sm font-medium">
          Título
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className="text-sm font-medium">
          Resumen / entradilla
          <Textarea
            name="excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            required
          />
        </label>

        <label className="text-sm font-medium">
          Cuerpo (HTML)
          <Textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={16} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Sección
            <select
              name="categoryId"
              defaultValue={initial.categoryId ?? ""}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            >
              <option value="">— Sin sección —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Autor
            <select
              name="authorId"
              defaultValue={initial.authorId ?? ""}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            >
              <option value="">— Sin autor —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-sm font-medium">
          Meta title <span className="text-[var(--fg-muted)]">(opcional; por defecto = título)</span>
          <Input name="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
        </label>
        <label className="text-sm font-medium">
          Meta description{" "}
          <span className="text-[var(--fg-muted)]">(opcional; por defecto = resumen)</span>
          <Textarea
            name="metaDescription"
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={2}
          />
        </label>
        <label className="text-sm font-medium">
          Etiquetas <span className="text-[var(--fg-muted)]">(separadas por coma)</span>
          <Input name="tags" defaultValue={initial.tags.join(", ")} />
        </label>

        <Button type="submit">Guardar borrador</Button>
      </form>

      <aside className="flex flex-col gap-4">
        <Card>
          <p className="text-sm font-semibold">Estado: {status}</p>
          {initial.slug && (
            <a
              href={`/articulo/${initial.slug}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm text-[var(--link)] underline"
            >
              Vista previa pública →
            </a>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-semibold">Asistencia de posicionamiento</p>
          <ul className="flex flex-col gap-1 text-xs">
            {hints.map((h) => (
              <li key={h.text} className={h.ok ? "text-[var(--brand)]" : "text-[var(--danger)]"}>
                {h.ok ? "✓" : "✗"} {h.text}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <p className="mb-1 text-sm font-semibold">Vista previa</p>
          <p className="text-base font-bold">{metaTitle || title || "Sin título"}</p>
          <p className="text-xs text-[var(--link)]">contextoganadero.com › articulo</p>
          <p className="text-xs text-[var(--fg-muted)]">
            {(metaDescription || excerpt || "").slice(0, 160)}
          </p>
        </Card>

        {initial.id && (
          <Card className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Flujo editorial</p>
            {!canPublish && (
              <form action={submitForReviewAction}>
                <Button variant="outline" className="w-full" type="submit">
                  Enviar a revisión
                </Button>
              </form>
            )}
            {canPublish && (
              <>
                <form action={publishAction}>
                  <Button className="w-full" type="submit">
                    Publicar ahora
                  </Button>
                </form>
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => schedule && scheduleAction(new Date(schedule).toISOString())}
                  >
                    Programar
                  </Button>
                </div>
              </>
            )}
            <p className="text-xs text-[var(--fg-muted)]">
              Publicar dispara regeneración ISR de las rutas afectadas y reindexación para el
              asistente.
            </p>
          </Card>
        )}
      </aside>
    </div>
  );
}
