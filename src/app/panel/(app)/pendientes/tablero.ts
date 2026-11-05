import "server-only";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, authors, categories } from "@/db/schema";
import { misPendientes } from "./consultas";
import { misAsignaciones } from "@/app/panel/(app)/asignaciones/consultas";

/**
 * Tablero de «Mis pendientes»: tres columnas con lo que le toca a la persona.
 *  - Pendiente: piezas del grupo de redacción por redactar (o que fallaron) y notas que le enviaron y aún no ha abierto.
 *  - Editando: piezas en redacción o revisión, notas enviadas que ya abrió, y sus propios borradores y notas en revisión.
 *  - Publicado: lo suyo o lo que le enviaron que salió (o quedó programado) en los últimos 30 días.
 */
export type Columna = "pendiente" | "editando" | "publicado";
export type Tarjeta = {
  clave: string;
  columna: Columna;
  /** De dónde viene: pieza del grupo de redacción, nota que le enviaron o nota propia. */
  origen: "pieza" | "enviada" | "propia";
  titulo: string;
  /** Etiqueta corta del estado («Por redactar», «Para revisar», «Publicada»…). */
  estado: string;
  /** Línea de contexto: sección y plan, o quién la envió. */
  detalle: string;
  mensaje?: string;
  /** Fecha que importa en esa columna (cuándo sale, cuándo se envió, cuándo se publicó). */
  fecha: Date | null;
  fechaTexto: string;
  href: string;
  alerta?: boolean;
};

const DIAS_PUBLICADO = 30;

const ESTADO_PIEZA: Record<string, string> = { planificada: "Por redactar", redactando: "Redactando", revision: "Para revisar", fallida: "Falló" };
const ESTADO_NOTA: Record<string, string> = { borrador: "Borrador", en_revision: "En revisión", programado: "Programada", publicado: "Publicada" };

export async function tableroDe(userId: string): Promise<Tarjeta[]> {
  const desde = new Date(Date.now() - DIAS_PUBLICADO * 86_400_000);
  const [piezas, { paraMi }, misFichas] = await Promise.all([
    misPendientes(userId),
    misAsignaciones(userId),
    db.select({ id: authors.id }).from(authors).where(eq(authors.userId, userId)),
  ]);
  const autorIds = misFichas.map((a) => a.id);
  const enviadas = new Map(paraMi.map((f) => [f.articleId, f]));
  const conPieza = new Set(piezas.map((p) => p.articleId).filter(Boolean) as string[]);

  // Notas propias (las creó o las firma) y las enviadas: las abiertas recientes y las publicadas en el periodo.
  const mias = or(eq(articles.createdBy, userId), ...(autorIds.length ? [inArray(articles.authorId, autorIds)] : []), ...(enviadas.size ? [inArray(articles.id, [...enviadas.keys()])] : []));
  const notas = await db
    .select({ id: articles.id, titulo: articles.title, estado: articles.status, seccion: categories.name, actualizada: articles.updatedAt, publicada: articles.publishedAt, programada: articles.scheduledFor })
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .where(
      and(
        mias,
        or(
          inArray(articles.status, ["borrador", "en_revision"]),
          and(inArray(articles.status, ["publicado", "programado"]), or(gte(articles.publishedAt, desde), gte(articles.scheduledFor, desde), sql`${articles.status} = 'programado'`)),
        ),
      ),
    )
    .orderBy(desc(articles.updatedAt))
    .limit(150);

  const tarjetas: Tarjeta[] = [];

  // Piezas del grupo de redacción que siguen abiertas.
  for (const p of piezas) {
    const editando = p.estado === "redactando" || p.estado === "revision";
    tarjetas.push({
      clave: `pieza-${p.id}`,
      columna: editando ? "editando" : "pendiente",
      origen: "pieza",
      titulo: p.tema || "Sin tema",
      estado: ESTADO_PIEZA[p.estado] ?? p.estado,
      detalle: [p.seccion, p.plan].filter(Boolean).join(" · "),
      fecha: p.publicaEn,
      fechaTexto: "Sale",
      href: p.articleId ? `/panel/articulos/${p.articleId}?modo=ia&paso=vista` : `/panel/articulos/nuevo?modo=ia&pieza=${p.id}`,
      alerta: p.estado === "fallida",
      ...(p.estado === "fallida" && p.error ? { mensaje: p.error } : {}),
    });
  }

  for (const n of notas) {
    if (conPieza.has(n.id) && (n.estado === "borrador" || n.estado === "en_revision")) continue; // ya está como pieza
    const env = enviadas.get(n.id);
    const publicada = n.estado === "publicado" || n.estado === "programado";
    let columna: Columna = publicada ? "publicado" : "editando";
    if (!publicada && env && !env.abiertaAt) columna = "pendiente";
    tarjetas.push({
      clave: `nota-${n.id}`,
      columna,
      origen: env ? "enviada" : "propia",
      titulo: n.titulo,
      estado: ESTADO_NOTA[n.estado] ?? n.estado,
      detalle: env ? `De ${env.por}${n.seccion ? ` · ${n.seccion}` : ""}` : n.seccion ?? "Sin sección",
      ...(env?.mensaje && !publicada ? { mensaje: env.mensaje } : {}),
      fecha: publicada ? (n.estado === "programado" ? n.programada : n.publicada) : env && columna === "pendiente" ? new Date(env.fecha) : n.actualizada,
      fechaTexto: publicada ? (n.estado === "programado" ? "Sale" : "Publicada") : env && columna === "pendiente" ? "Te la enviaron" : "Última edición",
      href: `/panel/articulos/${n.id}?modo=manual&paso=vista`,
    });
  }
  return tarjetas;
}
