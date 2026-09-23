import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors } from "@/db/schema";
import { Badge, Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

export default async function ArticlesList() {
  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      updatedAt: articles.updatedAt,
      scheduledFor: articles.scheduledFor,
      author: authors.name,
    })
    .from(articles)
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .orderBy(desc(articles.updatedAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Contenido</p>
          <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">Artículos</h1>
        </div>
        <Link href="/panel/articulos/nuevo">
          <Button>Nuevo artículo</Button>
        </Link>
      </div>
      <table className="lx-card w-full border-separate border-spacing-0 p-0 text-sm">
        <thead className="text-left">
          <tr>
            <th className="lx-kicker border-b border-[var(--border)] px-5 py-4 text-[var(--fg-muted)]">Título</th>
            <th className="lx-kicker border-b border-[var(--border)] px-5 py-4 text-[var(--fg-muted)]">Estado</th>
            <th className="lx-kicker border-b border-[var(--border)] px-5 py-4 text-[var(--fg-muted)]">Autor</th>
            <th className="lx-kicker border-b border-[var(--border)] px-5 py-4 text-[var(--fg-muted)]">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-[var(--surface-2)]">
              <td className="border-b border-[var(--border)] px-5 py-3.5">
                <Link href={`/panel/articulos/${r.id}`} className="lx-link font-medium">
                  {r.title}
                </Link>
              </td>
              <td className="border-b border-[var(--border)] px-5 py-3.5">
                <Badge
                  className={
                    r.status === "publicado"
                      ? "border-[var(--border-strong)] text-[var(--accent)]"
                      : ""
                  }
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                {r.status === "programado" && r.scheduledFor && (
                  <span className="ml-2 text-xs text-[var(--fg-muted)]">
                    {formatDate(r.scheduledFor)}
                  </span>
                )}
              </td>
              <td className="border-b border-[var(--border)] px-5 py-3.5">{r.author ?? "—"}</td>
              <td className="border-b border-[var(--border)] px-5 py-3.5 text-[var(--fg-muted)]">
                {formatDate(r.updatedAt)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-10 text-center text-[var(--fg-muted)]">
                Sin artículos. Crea el primero.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
