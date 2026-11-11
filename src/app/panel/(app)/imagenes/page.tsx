import Link from "next/link";
import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, users } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { Card } from "@/components/ui";
import { EntregaImagen } from "@/components/panel/entrega-imagen";
import { leerPedidos } from "@/lib/imagenes-pedidas";
import { pendientesPara, puedeEntregarImagen } from "@/lib/imagenes-pedidas-reglas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud de imágenes" };

const cuando = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(new Date(iso));

// Las imágenes de portada que le piden al diseñador: las pendientes con su formulario de entrega y las últimas entregadas.
export default async function ImagenesPedidas() {
  const yo = await requirePermiso("articulos");
  if (!puedeEntregarImagen(yo.role)) redirect("/panel");
  const todos = await leerPedidos();
  const pendientes = pendientesPara(todos, yo.id, yo.role);
  const entregadas = todos.filter((p) => p.estado === "entregada").sort((a, b) => (b.entregadaEn ?? "").localeCompare(a.entregadaEn ?? "")).slice(0, 8);
  const visibles = [...pendientes, ...entregadas];
  const [notas, personas] = visibles.length
    ? await Promise.all([
        db.select({ id: articles.id, titulo: articles.title, resumen: articles.excerpt }).from(articles).where(inArray(articles.id, visibles.map((p) => p.articleId))),
        db.select({ id: users.id, nombre: users.name }).from(users).where(inArray(users.id, [...new Set(visibles.flatMap((p) => [p.porId, p.entregadaPorId ?? p.porId]))])),
      ])
    : [[], []];
  const titulo = new Map(notas.map((n) => [n.id, n.titulo]));
  const resumen = new Map(notas.map((n) => [n.id, n.resumen]));
  const nombre = new Map(personas.map((p) => [p.id, p.nombre]));

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Diseño</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Solicitud de imágenes</h1>
        <p className="mt-2 max-w-2xl text-[var(--fg-muted)]">
          Las imágenes de portada que los redactores y los editores te piden. Crea la imagen, súbela aquí y entrégala: queda puesta en la nota. Nada se publica solo.
        </p>
      </header>
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Por hacer <span className="text-sm font-normal text-[var(--fg-muted)]">({pendientes.length})</span></h2>
        {pendientes.length ? (
          <ul className="flex flex-col gap-3">
            {pendientes.map((p) => (
              <li key={p.articleId} className="rounded-[var(--radius)] border border-[var(--border)] p-3">
                <Link href={`/panel/articulos/${p.articleId}?modo=manual`} className="lx-link text-sm font-semibold">{titulo.get(p.articleId) ?? "Nota"}</Link>
                <p className="text-xs text-[var(--fg-muted)]">Pedida por {nombre.get(p.porId) ?? "—"} · {cuando(p.fecha)}</p>
                <p className="mt-2 whitespace-pre-line text-sm">{p.indicaciones}</p>
                <EntregaImagen articleId={p.articleId} tituloNota={titulo.get(p.articleId) ?? ""} resumen={resumen.get(p.articleId) ?? ""} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No hay imágenes por hacer.</p>
        )}
      </Card>
      {entregadas.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Entregadas hace poco</h2>
          <ul className="flex flex-col gap-2">
            {entregadas.map((p) => (
              <li key={p.articleId} className="flex items-center gap-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.url && <img src={p.url} alt="" className="aspect-[16/9] w-20 rounded object-cover" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{titulo.get(p.articleId) ?? "Nota"}</span>
                  <span className="block text-xs text-[var(--fg-muted)]">{nombre.get(p.entregadaPorId ?? "") ?? "—"} · {p.entregadaEn ? cuando(p.entregadaEn) : ""}</span>
                </span>
                <a href={`/vista-previa/${p.articleId}`} target="_blank" rel="noopener noreferrer" className="lx-link shrink-0 text-xs font-semibold">Ver cómo quedó en la nota →</a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
