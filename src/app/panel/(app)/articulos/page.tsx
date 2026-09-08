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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Artículos</h1>
        <Link href="/panel/articulos/nuevo">
          <Button>Nuevo artículo</Button>
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--fg-muted)]">
          <tr className="border-b border-[var(--border)]">
            <th className="py-2">Título</th>
            <th className="py-2">Estado</th>
            <th className="py-2">Autor</th>
            <th className="py-2">Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border)]">
              <td className="py-2">
                <Link href={`/panel/articulos/${r.id}`} className="font-medium text-[var(--link)]">
                  {r.title}
                </Link>
              </td>
              <td className="py-2">
                <Badge>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                {r.status === "programado" && r.scheduledFor && (
                  <span className="ml-2 text-xs text-[var(--fg-muted)]">
                    {formatDate(r.scheduledFor)}
                  </span>
                )}
              </td>
              <td className="py-2">{r.author ?? "—"}</td>
              <td className="py-2 text-[var(--fg-muted)]">{formatDate(r.updatedAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-[var(--fg-muted)]">
                Sin artículos. Crea el primero.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
