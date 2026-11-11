import Link from "next/link";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, users } from "@/db/schema";
import { requirePermiso } from "@/lib/auth";
import { Card } from "@/components/ui";
import { EntregaImagen } from "@/components/panel/entrega-imagen";
import { leerPedidos } from "@/lib/imagenes-pedidas";
import { pendientesPara } from "@/lib/imagenes-pedidas-reglas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud de imágenes" };

const cuando = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" }).format(new Date(iso));

const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Las imágenes de portada que le piden al diseñador: las pendientes con su formulario de entrega y las entregadas, con buscador y filtro por estado.
export default async function ImagenesPedidas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const yo = await requirePermiso("imagenes");
  const sp = await searchParams;
  const val = (k: string) => { const v = sp[k]; return ((Array.isArray(v) ? v[0] : v) ?? "").trim(); };
  const q = val("q").slice(0, 120);
  const estado = ["por-hacer", "entregadas"].includes(val("estado")) ? val("estado") : "todas";
  const filtrando = Boolean(q) || estado !== "todas";

  const todos = await leerPedidos();
  const pendientesTodas = pendientesPara(todos, yo.id, yo.role);
  const entregadasTodas = todos.filter((p) => p.estado === "entregada").sort((a, b) => (b.entregadaEn ?? "").localeCompare(a.entregadaEn ?? "")).slice(0, 300);
  const visibles = [...pendientesTodas, ...entregadasTodas];
  const [notas, personas] = visibles.length
    ? await Promise.all([
        db.select({ id: articles.id, titulo: articles.title, resumen: articles.excerpt }).from(articles).where(inArray(articles.id, [...new Set(visibles.map((p) => p.articleId))])),
        db.select({ id: users.id, nombre: users.name }).from(users).where(inArray(users.id, [...new Set(visibles.flatMap((p) => [p.porId, p.entregadaPorId ?? p.porId]))])),
      ])
    : [[], []];
  const titulo = new Map(notas.map((n) => [n.id, n.titulo]));
  const resumen = new Map(notas.map((n) => [n.id, n.resumen]));
  const nombre = new Map(personas.map((p) => [p.id, p.nombre]));

  // Busca por la nota, por quien pidió o entregó y por lo que se pidió.
  const coincide = (p: (typeof visibles)[number]) => {
    if (!q) return true;
    const t = norm(q);
    return [titulo.get(p.articleId), nombre.get(p.porId), nombre.get(p.entregadaPorId ?? ""), p.indicaciones].some((x) => x && norm(x).includes(t));
  };
  const pendientes = estado === "entregadas" ? [] : pendientesTodas.filter(coincide);
  const entregadasFiltradas = estado === "por-hacer" ? [] : entregadasTodas.filter(coincide);
  // Sin filtro se muestran las últimas 8; al buscar, todas las que coinciden (hasta 50).
  const entregadas = filtrando ? entregadasFiltradas.slice(0, 50) : entregadasFiltradas.slice(0, 8);
  // El diseñador no edita la nota de otra persona: la lee en su vista previa.
  const enlaceNota = (id: string) => (yo.role === "disenador" ? `/vista-previa/${id}` : `/panel/articulos/${id}?modo=manual`);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Diseño</p>
        <h1 className="lx-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Solicitud de imágenes</h1>
        <p className="mt-2 max-w-2xl text-[var(--fg-muted)]">
          Las imágenes de portada que los redactores y los editores te piden. Crea la imagen, súbela aquí y entrégala: queda puesta en la nota. Nada se publica solo.
        </p>
      </header>
      {/* Buscador: por nota, por quién la pidió o la entregó y por lo que se pidió; y por estado */}
      <form method="get" role="search" className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <span className="lx-kicker text-[var(--fg-muted)]">Buscar</span>
          <input name="q" defaultValue={q} placeholder="Nota, persona o lo que se pidió…" className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="lx-kicker text-[var(--fg-muted)]">Estado</span>
          <select name="estado" defaultValue={estado} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]">
            <option value="todas">Todas</option>
            <option value="por-hacer">Por hacer</option>
            <option value="entregadas">Entregadas</option>
          </select>
        </label>
        <button type="submit" className="lx-btn">Filtrar</button>
        {filtrando && <Link href="/panel/imagenes" className="lx-link pb-2 text-sm font-medium">Quitar filtros</Link>}
      </form>
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Por hacer <span className="text-sm font-normal text-[var(--fg-muted)]">({pendientes.length})</span></h2>
        {pendientes.length ? (
          <ul className="flex flex-col gap-3">
            {pendientes.map((p) => (
              <li key={p.articleId} className="rounded-[var(--radius)] border border-[var(--border)] p-3">
                <Link href={enlaceNota(p.articleId)} className="lx-link text-sm font-semibold">{titulo.get(p.articleId) ?? "Nota"}</Link>
                <p className="text-xs text-[var(--fg-muted)]">Pedida por {nombre.get(p.porId) ?? "—"} · {cuando(p.fecha)}</p>
                <p className="mt-2 whitespace-pre-line text-sm">{p.indicaciones}</p>
                <EntregaImagen articleId={p.articleId} tituloNota={titulo.get(p.articleId) ?? ""} resumen={resumen.get(p.articleId) ?? ""} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">{filtrando ? "Ninguna solicitud por hacer coincide con la búsqueda." : "No hay imágenes por hacer."}</p>
        )}
      </Card>
      {(entregadas.length > 0 || (filtrando && estado !== "por-hacer")) && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">{filtrando ? "Entregadas" : "Entregadas hace poco"} <span className="text-sm font-normal text-[var(--fg-muted)]">({entregadas.length})</span></h2>
          {entregadas.length === 0 && <p className="text-sm text-[var(--fg-muted)]">Ninguna imagen entregada coincide con la búsqueda.</p>}
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
