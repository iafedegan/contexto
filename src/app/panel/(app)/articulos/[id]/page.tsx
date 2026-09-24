import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { auth, canPublish } from "@/lib/auth";
import Link from "next/link";
import { PenLine, Sparkles } from "lucide-react";
import { ArticleEditor } from "@/components/article-editor";
import { ArticleWizard } from "@/components/panel/article-wizard";
import { ViewsBarChart } from "@/components/panel/views-chart";
import { articleSeries, bestDay, nf, pctChange } from "@/lib/article-stats";
import { formatDate } from "@/lib/utils";
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
  isBreaking: boolean;
  isLive: boolean;
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
  isBreaking: false,
  isLive: false,
};

export default async function ArticleEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { id } = await params;
  const { modo } = await searchParams;
  const session = await auth();
  const isNew = id === "nuevo";

  const [cats, auths] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
  ]);

  // Artículo nuevo: primero se elige cómo crearlo.
  if (isNew && modo !== "ia") {
    if (modo === "manual") {
      return (
        <div className="flex flex-col gap-6">
          <h1 className="text-xl font-bold">Nuevo artículo · paso a paso</h1>
          <ArticleWizard categories={cats} authors={auths} />
        </div>
      );
    }
    return <ModeChooser />;
  }

  let initial: Initial = EMPTY;
  let status = "nuevo";
  let stats: {
    views: number;
    publishedAt: Date | null;
    series: Awaited<ReturnType<typeof articleSeries>>;
    best: Awaited<ReturnType<typeof bestDay>>;
  } | null = null;

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
      isBreaking: row.isBreaking,
      isLive: row.isLive,
    };
    status = row.status;
    if (row.status === "publicado" || row.views > 0) {
      const [series, best] = await Promise.all([articleSeries(row.id, 30), bestDay(row.id)]);
      stats = { views: row.views, publishedAt: row.publishedAt, series, best };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">{isNew ? "Nuevo artículo" : initial.title}</h1>
      {stats && <ArticleStats {...stats} />}
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

function ArticleStats({
  views,
  publishedAt,
  series,
  best,
}: {
  views: number;
  publishedAt: Date | null;
  series: Awaited<ReturnType<typeof articleSeries>>;
  best: Awaited<ReturnType<typeof bestDay>>;
}) {
  const v = series.views;
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const today = v[v.length - 1] ?? 0;
  const last7 = sum(v.slice(-7));
  const prev7 = sum(v.slice(-14, -7));
  const last30 = sum(v);
  const trend = pctChange(last7, prev7);
  const daysLive = publishedAt
    ? Math.max(
        1,
        Math.ceil((new Date(`${series.days[series.days.length - 1]}T23:59:59-05:00`).getTime() - publishedAt.getTime()) / 86_400_000),
      )
    : null;

  const items: { label: string; value: string; note?: React.ReactNode }[] = [
    {
      label: "Lecturas totales",
      value: nf.format(views),
      note: daysLive ? `${nf.format(Math.round(views / daysLive))} de media al día` : undefined,
    },
    { label: "Hoy", value: nf.format(today) },
    {
      label: "Últimos 7 días",
      value: nf.format(last7),
      note:
        trend === null ? undefined : (
          <span className={trend >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} % vs. 7 días previos
          </span>
        ),
    },
    { label: "Últimos 30 días", value: nf.format(last30) },
    {
      label: "Mejor día",
      value: best ? nf.format(best.views) : "—",
      note: best ? formatDate(`${best.day}T12:00:00Z`) : undefined,
    },
  ];

  return (
    <section className="lx-card flex flex-col gap-5 p-5" aria-label="Estadísticas de lectura">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="lx-kicker text-[var(--accent)]">Audiencia</p>
        {publishedAt && (
          <span className="text-xs text-[var(--fg-muted)]">
            Publicado el {formatDate(publishedAt)} · {nf.format(daysLive ?? 0)} días en línea
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((i) => (
          <div key={i.label} className="flex flex-col gap-0.5">
            <span className="lx-kicker text-[var(--fg-muted)]">{i.label}</span>
            <span className="lx-display text-2xl font-semibold tabular-nums">{i.value}</span>
            {i.note && <span className="text-xs text-[var(--fg-muted)]">{i.note}</span>}
          </div>
        ))}
      </div>
      <ViewsBarChart days={series.days} values={v} />
      <p className="text-xs text-[var(--fg-muted)]">
        Una lectura cuenta cuando alguien permanece al menos 5 segundos en la nota (una vez por sesión).
      </p>
    </section>
  );
}

function ModeChooser() {
  const options = [
    {
      href: "/panel/articulos/nuevo?modo=manual",
      icon: <PenLine size={22} />,
      title: "Escribirlo yo",
      text: "Un paso a paso guiado: título, resumen, palabras clave, sección, cuerpo, portada y buscadores. Al final ves la vista previa antes de guardar.",
      cta: "Empezar paso a paso",
    },
    {
      href: "/panel/articulos/nuevo?modo=ia",
      icon: <Sparkles size={22} />,
      title: "Con asistente de IA",
      text: "Pega tus notas, cifras y fuentes; la IA prepara un borrador que tú revisas y editas. Nada se publica sin tu aprobación.",
      cta: "Usar el asistente",
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="lx-kicker text-[var(--accent)]">Nuevo artículo</p>
        <h1 className="lx-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          ¿Cómo quieres crearlo?
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="lx-card group flex flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
          >
            <span className="grid size-11 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]">
              {o.icon}
            </span>
            <h2 className="lx-display text-xl font-semibold">{o.title}</h2>
            <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{o.text}</p>
            <span className="mt-auto pt-2 text-sm font-semibold text-[var(--accent)] group-hover:underline">
              {o.cta} →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
