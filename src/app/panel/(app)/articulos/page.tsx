import { ensureUserAuthors } from "@/lib/user-authors";
import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, articleViewsDaily, authors, categories } from "@/db/schema";
import { Badge, Button } from "@/components/ui";
import { auth, requirePermiso } from "@/lib/auth";
import { DeleteArticleButton } from "@/components/panel/delete-article-button";
import { MarcasNota } from "@/components/panel/marcas-nota";
import { ArticleFilters } from "@/components/panel/article-filters";
import { SparklineZoom } from "@/components/panel/sparkline-zoom";
import { dailySeries, hasDailyViews, pctChange, siteWeekTotals, TODAY_CO } from "@/lib/article-stats";
import { formatDate } from "@/lib/utils";
import { nfCO as nf } from "@/lib/format";
import { ESTADO_LABEL as STATUS_LABEL } from "@/lib/estados";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";

// Estado editorial de una nota.
type Status = (typeof articles.status.enumValues)[number];

// Criterios de orden del listado.
const SORTS = [
  { value: "actualizado", label: "Última edición" },
  { value: "publicado", label: "Fecha de publicación" },
  { value: "lecturas", label: "Más leídos (total)" },
  { value: "semana", label: "Más leídos (7 días)" },
  { value: "titulo", label: "Título (A-Z)" },
];

// Días que abarca la minigráfica de lecturas de cada fila.
const SPARK_DAYS = 14;

// Parámetros de búsqueda de la dirección.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Primer valor de un parámetro de la dirección, sin espacios.
function param(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

// Listado de notas con filtros, orden, estadísticas y acciones (exige el permiso «articulos»).
export default async function ArticlesList({ searchParams }: { searchParams: SearchParams }) {
  await requirePermiso("articulos");
  const session = await auth();
  const canDelete = session?.user?.role === "editor" || session?.user?.role === "administrador";
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 120);
  const estado = articles.status.enumValues.includes(param(sp, "estado") as Status)
    ? (param(sp, "estado") as Status)
    : "";
  const categoria = param(sp, "categoria");
  const autor = param(sp, "autor");
  const orden = SORTS.some((s) => s.value === param(sp, "orden")) ? param(sp, "orden") : "actualizado";

  await ensureUserAuthors().catch(() => {});
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
      isBreaking: articles.isBreaking,
      isLive: articles.isLive,
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
      <div className="z-30 -mx-2 flex flex-col gap-2 rounded-b-[var(--radius)] bg-white px-2 pb-2 pt-3 lg:sticky lg:top-[var(--panel-header-h,61px)]">
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
            <Link href={`/panel/articulos/${top.id}?modo=manual`} className="lx-link line-clamp-2">
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

      {/* --- Teléfono: una tarjeta por artículo (la tabla de 960 px obligaba a deslizar en horizontal) --- */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => {
          const serie = byArticle.get(r.id) ?? new Array(SPARK_DAYS).fill(0);
          const last7 = serie.slice(-7).reduce((s, v) => s + v, 0);
          const prev7 = serie.slice(0, 7).reduce((s, v) => s + v, 0);
          const t = pctChange(last7, prev7);
          return (
            <li key={r.id} className="lx-card p-4">
              <Link href={`/panel/articulos/${r.id}?modo=manual`} className="lx-link block text-base font-semibold leading-snug">
                {r.title}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--fg-muted)]">
                {r.category && <span>{r.category}</span>}
                {r.publishedAt && r.status === "publicado" && (
                  <>
                    {r.category && <span aria-hidden>·</span>}
                    <span>Publicado el {formatDate(r.publishedAt)}</span>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className={r.status === "publicado" ? "border-[var(--border-strong)] text-[var(--accent)]" : ""}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                {r.status === "programado" && r.scheduledFor && (
                  <span className="text-xs text-[var(--fg-muted)]">{formatDate(r.scheduledFor)}</span>
                )}
                <span className="text-xs text-[var(--fg-muted)]">{r.author ?? "Sin autor"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                {r.status === "publicado" || Number(r.views) > 0 ? (
                  <div className="flex items-center gap-3">
                    <SparklineZoom values={serie} title={r.title} articleId={r.id} />
                    <div className="text-xs leading-tight">
                      <div className="text-base font-semibold tabular-nums">{nf.format(Number(r.views))}</div>
                      <div className="text-[var(--fg-muted)]">
                        {nf.format(last7)} en 7 días
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
                <div className="flex shrink-0 items-center gap-2">
                  {r.publishedAt && r.status === "publicado" && (
                    <a href={`/articulo/${r.slug}`} target="_blank" rel="noreferrer" className="lx-link text-xs">
                      Ver en el sitio ↗
                    </a>
                  )}
                  {canDelete && <MarcasNota id={r.id} breaking={r.isBreaking} live={r.isLive} />}
                  {canDelete && <DeleteArticleButton id={r.id} title={r.title} published={r.status === "publicado"} />}
                </div>
              </div>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-2 py-10 text-center text-[var(--fg-muted)]">
            {where.length ? "Ningún artículo coincide con los filtros." : "Sin artículos. Crea el primero."}
          </li>
        )}
      </ul>

      {/* --- Tabla (tableta y escritorio): las columnas secundarias aparecen según el ancho, para que «Eliminar»
           nunca quede fuera de vista (con un mínimo fijo de 960 px había que deslizar en horizontal para llegar a él) --- */}
      <div className="lx-card hidden overflow-x-auto p-0 md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="text-left">
            <tr>
              <Th>Título</Th>
              <Th>Estado</Th>
              <Th className="hidden 2xl:table-cell">Autor</Th>
              <Th className="text-right">Lecturas</Th>
              <Th className="hidden xl:table-cell">Últimos {SPARK_DAYS} días</Th>
              <Th className="hidden 2xl:table-cell">Actualizado</Th>
              {canDelete && <Th className="text-right">Eliminar</Th>}
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
                    <Link href={`/panel/articulos/${r.id}?modo=manual`} className="lx-link font-medium">
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
                    {/* Con la columna «Autor» oculta (pantallas medianas), la firma va en su propia línea. */}
                    <div className="mt-0.5 text-xs text-[var(--fg-muted)] 2xl:hidden">Por {r.author ?? "autor sin asignar"}</div>
                  </Td>
                  <Td className="min-w-[15rem]">
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
                    {canDelete && (
                      <div className="mt-2"><MarcasNota id={r.id} breaking={r.isBreaking} live={r.isLive} /></div>
                    )}
                  </Td>
                  <Td className="hidden 2xl:table-cell">{r.author ?? "—"}</Td>
                  <Td className="text-right">
                    <span className="text-base font-semibold tabular-nums">{nf.format(Number(r.views))}</span>
                  </Td>
                  <Td className="hidden xl:table-cell">
                    {r.status === "publicado" || Number(r.views) > 0 ? (
                      <div className="flex min-w-[9.5rem] items-center gap-3">
                        <SparklineZoom values={serie} title={r.title} articleId={r.id} />
                        <div className="whitespace-nowrap text-xs leading-tight">
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
                  <Td className="hidden whitespace-nowrap text-[var(--fg-muted)] 2xl:table-cell">{formatDate(r.updatedAt)}</Td>
                  {canDelete && (
                    <Td className="text-right">
                      <DeleteArticleButton id={r.id} title={r.title} published={r.status === "publicado"} />
                    </Td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 7 : 6} className="px-5 py-10 text-center text-[var(--fg-muted)]">
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

// Tarjeta con una cifra y su leyenda.
function Stat({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="lx-card flex min-w-0 flex-col gap-0.5 px-3 py-2">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <span className="lx-kicker text-[0.72rem] text-[var(--fg-muted)] sm:truncate">{label}</span>
        <span className="lx-display text-lg font-semibold leading-none tabular-nums">{value}</span>
      </div>
      <span className="hidden truncate text-xs text-[var(--fg-muted)] sm:block [&_a]:line-clamp-none">{children}</span>
    </div>
  );
}

// Celda de encabezado de la tabla.
function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`lx-kicker border-b border-[var(--border)] px-5 py-4 text-[var(--fg-muted)] ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

// Celda de la tabla.
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-[var(--border)] px-5 py-3.5 ${className ?? ""}`}>{children}</td>;
}
