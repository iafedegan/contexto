import Link from "next/link";
import { and, desc, eq, gte, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { destinatariosDe } from "@/lib/notas-asignadas";
import { leerPedidos } from "@/lib/imagenes-pedidas";
import { ETAPAS, etapaDeNota, type Etapa } from "@/lib/tablero-notas";
import { formatDate } from "@/lib/utils";

const DIAS_PUBLICADAS = 14;
const POR_COLUMNA = 40;

// El reloj se lee fuera del cuerpo del componente: es un componente de servidor y se evalúa en cada petición.
const haceDias = (dias: number) => new Date(Date.now() - dias * 86_400_000);

// Tablero por etapas: en qué punto está cada nota (con el redactor, esperando la imagen del diseñador, con el editor, programada, publicada).
export async function TableroArticulos({ alcance, visibles, esAdmin = false }: { alcance: SQL | undefined; visibles: SQL | undefined; esAdmin?: boolean }) {
  const desde = haceDias(DIAS_PUBLICADAS);
  const filtro = and(visibles, or(inArray(articles.status, ["borrador", "en_revision", "programado"]), and(eq(articles.status, "publicado"), gte(articles.publishedAt, desde))));
  const [notas, pedidos] = await Promise.all([
    db
      .select({ id: articles.id, titulo: articles.title, estado: articles.status, actualizada: articles.updatedAt, publicada: articles.publishedAt, programada: articles.scheduledFor, autor: authors.name, seccion: categories.name })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(filtro)
      .orderBy(desc(articles.updatedAt))
      .limit(400),
    leerPedidos(),
  ]);
  // Cuáles de estas notas puede abrir para editar; las demás se leen en la vista previa.
  const propias = esAdmin || !alcance || notas.length === 0
    ? null
    : new Set((await db.select({ id: articles.id }).from(articles).where(and(inArray(articles.id, notas.map((n) => n.id)), alcance))).map((r) => r.id));
  const enlaceNota = (id: string) => (esAdmin || (propias?.has(id) ?? false) ? `/panel/articulos/${id}?modo=manual` : `/vista-previa/${id}`);
  const para = await destinatariosDe(notas.filter((n) => n.estado === "borrador" || n.estado === "en_revision").map((n) => n.id));
  const pendientes = new Map(pedidos.filter((p) => p.estado === "pendiente").map((p) => [p.articleId, p]));

  const columnas = new Map<Etapa, typeof tarjetas>(ETAPAS.map((e) => [e.id, []]));
  const tarjetas = notas.map((n) => {
    const pedido = pendientes.get(n.id);
    const etapa = etapaDeNota({ estado: n.estado, imagenPendiente: !!pedido, paraEditor: para.has(n.id) });
    const fecha = etapa === "publicadas" ? n.publicada : etapa === "programadas" ? n.programada : n.actualizada;
    const nota = etapa === "disenador" ? pedido?.indicaciones : etapa === "editor" && para.get(n.id) ? `Para ${para.get(n.id)}` : undefined;
    return { ...n, etapa, fecha, nota };
  });
  for (const t of tarjetas) columnas.get(t.etapa)!.push(t);

  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-3">
      <div className="grid min-w-max grid-flow-col auto-cols-[17.5rem] gap-3 lg:min-w-0 lg:grid-flow-row lg:grid-cols-5 lg:auto-cols-auto">
        {ETAPAS.map((e) => {
          const lista = columnas.get(e.id)!;
          return (
            <section key={e.id} aria-label={e.titulo} className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)]/60 p-2.5">
              <header className="px-1">
                <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {e.titulo} <span className="rounded-full bg-[var(--surface)] px-2 text-xs font-medium text-[var(--fg-muted)]">{lista.length}</span>
                </h2>
                <p className="text-xs text-[var(--fg-muted)]">{e.ayuda}</p>
              </header>
              {lista.length === 0 ? (
                <p className="rounded-[var(--radius)] border border-dashed border-[var(--border)] p-3 text-center text-xs text-[var(--fg-muted)]">Nada por aquí.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lista.slice(0, POR_COLUMNA).map((t) => (
                    <li key={t.id}>
                      <Link href={enlaceNota(t.id)} className="block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-2.5 transition hover:border-[var(--accent)]">
                        <span className="line-clamp-3 text-sm font-semibold leading-snug">{t.titulo}</span>
                        {t.nota && <span className="mt-1 line-clamp-2 block text-xs">{t.nota}</span>}
                        <span className="mt-1.5 block text-xs text-[var(--fg-muted)]">
                          {[t.autor, t.seccion].filter(Boolean).join(" · ") || "Sin autor"}
                          {t.fecha ? ` · ${formatDate(t.fecha)}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {lista.length > POR_COLUMNA && <li className="px-1 text-xs text-[var(--fg-muted)]">y {lista.length - POR_COLUMNA} más (ábrelas desde la lista)</li>}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
