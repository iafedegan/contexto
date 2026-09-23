import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { auth, canPublish } from "@/lib/auth";
import { ArticleEditor } from "@/components/article-editor";
import {
  publishArticle,
  scheduleArticle,
  submitForReview,
} from "@/app/panel/(app)/articulos/actions";

export const dynamic = "force-dynamic";

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
  coverImageUrl: string | null;
  coverImageAlt: string | null;
};

const EMPTY: Initial = {
  id: "",
  title: "",
  excerpt: "",
  body: "",
  categoryId: null,
  authorId: null,
  metaTitle: null,
  metaDescription: null,
  tags: [],
  slug: null,
  coverImageUrl: null,
  coverImageAlt: null,
};

export default async function ArticleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isNew = id === "nuevo";

  const [cats, auths] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
  ]);

  let initial: Initial = EMPTY;
  let status = "nuevo";

  if (!isNew) {
    const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (!row) notFound();
    initial = {
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      categoryId: row.categoryId,
      authorId: row.authorId,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      tags: row.tags,
      slug: row.slug,
      coverImageUrl: row.coverImageUrl,
      coverImageAlt: row.coverImageAlt,
    };
    status = row.status;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">{isNew ? "Nuevo artículo" : initial.title}</h1>
      <ArticleEditor
        initial={initial}
        categories={cats}
        authors={auths}
        status={status}
        canPublish={canPublish(session!.user.role)}
        publishAction={async () => {
          "use server";
          await publishArticle(id);
        }}
        scheduleAction={async (iso: string) => {
          "use server";
          await scheduleArticle(id, iso);
        }}
        submitForReviewAction={async () => {
          "use server";
          await submitForReview(id);
        }}
      />
    </div>
  );
}
