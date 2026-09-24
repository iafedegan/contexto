import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, articleViewsDaily, authors, categories } from "@/db/schema";
import { Badge, Button } from "@/components/ui";
import { ArticleFilters } from "@/components/panel/article-filters";
import { ViewsSparkline } from "@/components/panel/views-chart";
import { dailySeries, hasDailyViews, nf, pctChange, siteWeekTotals, TODAY_CO } from "@/lib/article-stats";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  programado: "Programado",
  publicado: "Publicado",
  archivado: "Archivado",
};

type Status = (typeof articles.status.enumValues)[number];

const SORTS = [
  { value: "actualizado", label: "Última edición" },
  { value: "publicado", label: "Fecha de publicación" },
  { value: "lecturas", label: "Más leídos (total)" },
  { value: "semana", label: "Más leídos (7 días)" },
  { value: "titulo", label: "Título (A-Z)" },
];

const SPARK_DAYS = 14;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function ArticlesList({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 120);
  const estado = articles.status.enumValues.includes(param(sp, "estado") as Status)
    ? (param(sp, "estado") as Status)
    : "";
  const categoria = param(sp, "categoria");
  const autor = param(sp, "autor");
  const orden = SORTS.some((s) => s.value === param(sp, "orden")) ? param(sp, "orden") : "actualizado";

  const [cats, auths, daily] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
    hasDailyViews(),
  ]);

  // --- Filtros ---
  const where: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    where.push(or(ilike(articles.title, like), ilike(articles.excerpt, like), ilike(articles.slug, like))!);
  }
  if (estado) where.push(eq(articles.status, estado));
  if (categoria) {
    // Una sección incluye también sus subcategorías.
    const ids = [categoria, ...cats.filter((c) => c.parentId === categoria).map((c) => c.id)];
    where.push(inArray(articles.categoryId, ids));
  }
  if (autor === "sin-autor") where.push(sql`${articles.authorId} is null`);
  else if (autor) where.push(eq(articles.authorId, autor));

  // Lecturas de los últimos 7 días por artículo (solo si la tabla diaria existe).
  const week = daily
    ? db
        .select({
          articleId: articleViewsDaily.articleId,
          views: sql<number>`sum(${articleViewsDaily.views})::int`.as("week_views"),
        })
        .from(articleViewsDaily)
        .where(sql`${articleViewsDaily.day} > ${TODAY_CO} - 7`)
        .groupBy(articleViewsDaily.articleId)
        .as("week")
    : null;

  const weekViews = week ? sql<number>`coalesce(${week.views}, 0)` : sql<number>`0`;

  const order = {
    actualizado: [desc(articles.updatedAt)],
    publicado: [sql`${articles.publishedAt} desc nulls last`, desc(articles.updatedAt)],
    lecturas: [desc(articles.views), desc(articles.publishedAt)],
    semana: [desc(weekViews), desc(articles.views)],
    titulo: [asc(articles.title)],
  }[orden]!;

  const base = db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      status: articles.status,
      updatedAt: articles.updatedAt,
      publishedAt: articles.publishedAt,
      scheduledFor: articles.scheduledFor,
      views: articles.views,
      weekViews,
      author: authors.name,
      category: categories.name,
    })
    .from(articles)
    .leftJoin(authors, eq(articles.authorId, authors.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .$dynamic();
  if (week) base.leftJoin(week, eq(week.articleId, articles.id));

  const [rows, summary, weekTotals] = await Promise.all([
    base
      .where(where.length ? and(...where) : undefined)
      .orderBy(...order)
      .limit(200),
    db
      .select({
        total: sql<number>`count(*)::int`,
        publicados: sql<number>`count(*) filter (where ${articles.status} = 'publicado')::int`,
        pendientes: sql<number>`count(*) filter (where ${articles.status} in ('borrador', 'en_revision'))::int`,
        programados: sql<number>`count(*) filter (where ${articles.status} = 'programado')::int`,
        lecturas: sql<number>`coalesce(sum(${articles.views}), 0)::int`,
      })
      .from(articles)
      .then((r) => r[0]),
    siteWeekTotals(),
  ]);

  const { byArticle } = await dailySeries(
    rows.map((r) => r.id),
    SPARK_DAYS,
  );

  const filteredViews = rows.reduce((s, r) => s + Number(r.views), 0);
  const trend = weekTotals ? pctChange(weekTotals.last7, weekTotals.prev7) : null;
  const top = [...rows].sort((a, b) => Number(b.weekViews) - Number(a.weekViews))[0];

  const parentName = new Map(cats.map((c) => [c.id, c.name]));
  const categoryOptions = cats
    .filter((c) => !c.parentId)
    .flatMap((p) => [
      { value: p.id, label: p.name },
      ...cats
        .filter((c) => c.parentId === p.id)
        .map((c) => ({ value: c.id, label: `  — ${c.name}` })),
    ]);
  // Subcategorías cuyo padre no existe (datos antiguos) no deben desaparecer del filtro.
  for (const c of cats) {
    if (c.parentId && !parentName.has(c.parentId)) categoryOptions.push({ value: c.id, label: c.name });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- Título, resumen y filtros: fijos bajo la cabecera del panel --- */}
      <div className="sticky top-[var(--panel-header-h,61px)] z-30 -mx-2 flex flex-col gap-2 bg-[var(--bg)] px-2 pb-2 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Contenido</p>
          <h1 className="lx-display text-2xl font-semibold tracking-tight">Artículos</h1>
        </div>
        <Link href="/panel/articulos/nuevo">
          <Button>Nuevo artículo</Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Artículos" value={nf.format(summary.total)}>
          {nf.format(summary.publicados)} publicados · {nf.format(summary.pendientes)} en preparación
          {summary.programados > 0 && ` · ${nf.format(summary.programados)} programados`}
        </Stat>
        <Stat label="Lecturas totales" value={nf.format(summary.lecturas)}>
          {summary.publicados > 0
            ? `${nf.format(Math.round(summary.lecturas / summary.publicados))} de media por publicado`
            : "Sin publicaciones aún"}
        </Stat>
        <Stat label="Últimos 7 días" value={weekTotals ? nf.format(weekTotals.last7) : "—"}>
          {weekTotals ? (
            trend === null ? (
              "Sin semana previa para comparar"
            ) : (
              <span className={trend >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}>
                {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} % vs. semana anterior
              </span>
            )
          ) : (
            "Falta aplicar la migración de lecturas diarias"
          )}
        </Stat>
        <Stat label="Más leído esta semana" value={top && Number(top.weekViews) > 0 ? nf.format(Number(top.weekViews)) : "—"}>
          {top && Number(top.weekViews) > 0 ? (
            <Link href={`/panel/articulos/${top.id}`} className="lx-link line-clamp-2">
              {top.title}
            </Link>
          ) : (
            "Sin lecturas en los últimos 7 días"
          )}
        </Stat>
      </div>

      <ArticleFilters
        values={{ q, estado, categoria, autor, orden }}
        statuses={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
        categories={categoryOptions}
        authors={[...auths.map((a) => ({ value: a.id, label: a.name })), { value: "sin-autor", label: "Sin autor" }]}
        sorts={SORTS}
      />
      </div>

      <p className="text-sm text-[var(--fg-muted)]">
        {nf.format(rows.length)} {rows.length === 1 ? "artículo" : "artículos"}
        {rows.length === 200 && " (se muestran los 200 primeros)"} · {nf.format(filteredViews)} lecturas
      </p>

      {/* --- Tabla --- */}
      <div className="lx-card overflow-x-auto p-0">
        <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
          <thead className="text-left">
            <tr>
              <Th>Título</Th>
              <Th>Estado</Th>
              <Th>Autor</Th>
              <Th className="text-right">Lecturas</Th>
              <Th>Últimos {SPARK_DAYS} días</Th>
              <Th>Actualizado</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const serie = byArticle.get(r.id) ?? new Array(SPARK_DAYS).fill(0);
              const last7 = serie.slice(-7).reduce((s, v) => s + v, 0);
              const prev7 = serie.slice(0, 7).reduce((s, v) => s + v, 0);
              const t = pctChange(last7, prev7);
              return (
                <tr key={r.id} className="transition-colors hover:bg-[var(--surface-2)]">
                  <Td>
                    <Link href={`/panel/articulos/${r.id}`} className="lx-link font-medium">
                      {r.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--fg-muted)]">
                      {r.category && <span>{r.category}</span>}
                      {r.publishedAt && r.status === "publicado" && (
                        <>
                          {r.category && <span aria-hidden>·</span>}
                          <span>Publicado el {formatDate(r.publishedAt)}</span>
                          <span aria-hidden>·</span>
                          <a
                            href={`/articulo/${r.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="lx-link"
                          >
                            Ver en el sitio ↗
                          </a>
                        </>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge
                      className={
                        r.status === "publicado" ? "border-[var(--border-strong)] text-[var(--accent)]" : ""
                      }
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    {r.status === "programado" && r.scheduledFor && (
                      <span className="ml-2 text-xs text-[var(--fg-muted)]">{formatDate(r.scheduledFor)}</span>
                    )}
                  </Td>
                  <Td>{r.author ?? "—"}</Td>
                  <Td className="text-right">
                    <span className="text-base font-semibold tabular-nums">{nf.format(Number(r.views))}</span>
                  </Td>
                  <Td>
                    {r.status === "publicado" || Number(r.views) > 0 ? (
                      <div className="flex items-center gap-3">
                        <ViewsSparkline values={serie} />
                        <div className="text-xs leading-tight">
                          <div className="font-semibold tabular-nums">{nf.format(last7)}</div>
                          <div className="text-[var(--fg-muted)]">
                            7 días
                            {t !== null && (
                              <span className={t >= 0 ? " text-[var(--accent)]" : " text-[var(--danger)]"}>
                                {" "}
                                {t >= 0 ? "▲" : "▼"}
                                {Math.abs(t)} %
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--fg-muted)]">Sin publicar</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-[var(--fg-muted)]">{formatDate(r.updatedAt)}</Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[var(--fg-muted)]">
                  {where.length ? "Ningún artículo coincide con los filtros." : "Sin artículos. Crea el primero."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="lx-card flex min-w-0 flex-col gap-0.5 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="lx-kicker truncate text-[0.65rem] text-[var(--fg-muted)]">{label}</span>
        <span className="lx-display text-lg font-semibold leading-none tabular-nums">{value}</span>
      </div>
      <span className="hidden truncate text-[0.7rem] text-[var(--fg-muted)] sm:block [&_a]:line-clamp-none">{children}</span>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`lx-kicker border-b border-[var(--border)] px-5 py-4 text-[var(--fg-muted)] ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-[var(--border)] px-5 py-3.5 ${className ?? ""}`}>{children}</td>;
}
