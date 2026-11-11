import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, users } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { ESTADO_NOTA, SolicitudesImagenes, type FilaSolicitud } from "@/components/panel/solicitudes-imagenes";
import { leerPedidos } from "@/lib/imagenes-pedidas";
import { pendientesPara } from "@/lib/imagenes-pedidas-reglas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud de imágenes" };


// Las imágenes de portada que le piden al diseñador: las pendientes con su formulario de entrega y las entregadas, con filtros avanzados que responden al instante.
export default async function ImagenesPedidas() {
  const yo = await requirePermiso("imagenes");
  const todos = await leerPedidos();
  const pendientes = pendientesPara(todos, yo.id, yo.role);
  const entregadas = todos.filter((p) => p.estado === "entregada").sort((a, b) => (b.entregadaEn ?? "").localeCompare(a.entregadaEn ?? "")).slice(0, 300);
  const visibles = [...pendientes, ...entregadas];
  const [notas, personas] = visibles.length
    ? await Promise.all([
        db
          .select({ id: articles.id, titulo: articles.title, resumen: articles.excerpt, estado: articles.status, seccion: categories.name })
          .from(articles)
          .leftJoin(categories, eq(articles.categoryId, categories.id))
          .where(inArray(articles.id, [...new Set(visibles.map((p) => p.articleId))])),
        db.select({ id: users.id, nombre: users.name }).from(users).where(inArray(users.id, [...new Set(visibles.flatMap((p) => [p.porId, p.entregadaPorId ?? p.porId, ...(p.disenadorId ? [p.disenadorId] : [])]))])),
      ])
    : [[], []];
  const nota = new Map(notas.map((n) => [n.id, n]));
  const nombre = new Map(personas.map((p) => [p.id, p.nombre]));
  // El diseñador no edita la nota de otra persona: la lee en su vista previa.
  const enlaceNota = (id: string) => (yo.role === "disenador" ? `/vista-previa/${id}` : `/panel/articulos/${id}?modo=manual`);

  const filas: FilaSolicitud[] = visibles.flatMap((p) => {
    const n = nota.get(p.articleId);
    if (!n) return [];
    return [{
      articleId: p.articleId,
      titulo: n.titulo,
      resumen: n.resumen,
      href: enlaceNota(p.articleId),
      estadoPedido: p.estado === "entregada" ? ("entregada" as const) : ("pendiente" as const),
      estadoNota: ESTADO_NOTA[n.estado] ?? n.estado,
      seccion: n.seccion ?? "",
      porId: p.porId,
      por: nombre.get(p.porId) ?? "",
      paraId: p.disenadorId,
      para: p.disenadorId ? (nombre.get(p.disenadorId) ?? null) : null,
      entregadaPorId: p.entregadaPorId ?? null,
      entregadaPor: p.entregadaPorId ? (nombre.get(p.entregadaPorId) ?? null) : null,
      fecha: p.fecha,
      entregadaEn: p.entregadaEn ?? null,
      indicaciones: p.indicaciones,
      url: p.url ?? null,
    }];
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Diseño</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Solicitud de imágenes</h1>
        <p className="mt-2 max-w-2xl text-[var(--fg-muted)]">
          Las imágenes de portada que los redactores y los editores te piden. Crea la imagen, súbela aquí y entrégala: queda puesta en la nota. Nada se publica solo.
        </p>
      </header>
      <SolicitudesImagenes filas={filas} miId={yo.id} esDisenador={yo.role === "disenador"} />
    </div>
  );
}
