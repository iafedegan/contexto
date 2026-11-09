/**
 * Cómo se ve una página del constructor: filas en una cuadrícula de 12 columnas (en el celular cada columna ocupa todo el ancho)
 * y sus elementos. La usan la página pública y el lienzo del constructor; sin consultas: las notas de una sección llegan ya leídas.
 */
import type { ReactNode } from "react";
import type { Alinear, ContenidoPagina, Elemento, Fila } from "@/lib/paginas-bloques";
import { videoIncrustado } from "@/lib/paginas-bloques";

export type NotaMini = { slug: string; href: string; title: string; excerpt: string | null; coverImageUrl: string | null };

const ALINEAR: Record<Alinear, string> = { izquierda: "text-left", centro: "text-center", derecha: "text-right" };
const ALINEAR_FLEX: Record<Alinear, string> = { izquierda: "justify-start", centro: "justify-center", derecha: "justify-end" };
// Clases completas (Tailwind no ve clases armadas por partes).
const SPAN: Record<number, string> = {
  1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4", 5: "md:col-span-5", 6: "md:col-span-6",
  7: "md:col-span-7", 8: "md:col-span-8", 9: "md:col-span-9", 10: "md:col-span-10", 11: "md:col-span-11", 12: "md:col-span-12",
};
const FONDO: Record<string, string> = { ninguno: "", suave: "rounded-2xl bg-[var(--surface-2)] p-6 sm:p-8", acento: "rounded-2xl bg-[var(--accent)] p-6 text-[var(--accent-fg)] sm:p-8 [--fg:var(--accent-fg)] [--fg-muted:var(--accent-fg)]" };

export function claseColumna(n: number): string {
  return `col-span-12 ${SPAN[n] ?? "md:col-span-12"}`;
}
export function claseFondo(f: Fila["fondo"]): string {
  return FONDO[f ?? "ninguno"] ?? "";
}

/** Un elemento tal como lo ve el lector. `notas` trae las de la sección pedida (solo para el elemento «notas»). */
export function ElementoVista({ e, notas, enEditor = false }: { e: Elemento; notas?: NotaMini[]; enEditor?: boolean }): ReactNode {
  switch (e.tipo) {
    case "titulo": {
      const cls = `lx-display tracking-tight ${e.nivel === 2 ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.6rem]"} ${ALINEAR[e.alinear ?? "izquierda"]}`;
      return e.nivel === 2 ? <h2 className={cls}>{e.texto}</h2> : <h3 className={cls}>{e.texto}</h3>;
    }
    case "parrafo":
      return <p className={`whitespace-pre-line text-[1.05rem] leading-relaxed ${ALINEAR[e.alinear ?? "izquierda"]}`}>{e.texto}</p>;
    case "lista":
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[1.05rem] leading-relaxed marker:text-[var(--accent)]">
          {e.items.filter(Boolean).map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "cita":
      return (
        <blockquote className="border-l-4 border-[var(--accent)] pl-5">
          <p className="lx-display text-xl italic leading-snug md:text-2xl">«{e.texto}»</p>
          {e.autor && <footer className="lx-ui mt-2 text-sm text-[var(--fg-muted)]">— {e.autor}</footer>}
        </blockquote>
      );
    case "aviso":
      return (
        <div role="note" className={`rounded-xl border px-5 py-4 text-[0.98rem] leading-relaxed ${e.tono === "alerta" ? "border-[#e5214f]/40 bg-[#e5214f]/10" : "border-[var(--accent)]/30 bg-[var(--accent)]/10"}`}>
          {e.texto}
        </div>
      );
    case "imagen":
      return e.url ? (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- imágenes de la biblioteca o externas, sin dominio fijo */}
          <img src={e.url} alt={e.alt} loading="lazy" className="w-full rounded-xl object-cover" />
          {e.pie && <figcaption className="lx-ui mt-2 text-sm text-[var(--fg-muted)]">{e.pie}</figcaption>}
        </figure>
      ) : enEditor ? (
        <div className="grid aspect-video place-items-center rounded-xl border-2 border-dashed border-[var(--border-strong)] text-sm text-[var(--fg-muted)]">Elija una imagen</div>
      ) : null;
    case "video": {
      const src = e.url ? videoIncrustado(e.url) : null;
      return src ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe src={src} title="Video" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" className={`size-full ${enEditor ? "pointer-events-none" : ""}`} />
        </div>
      ) : enEditor ? (
        <div className="grid aspect-video place-items-center rounded-xl border-2 border-dashed border-[var(--border-strong)] text-sm text-[var(--fg-muted)]">Pegue un enlace de YouTube o Vimeo</div>
      ) : null;
    }
    case "boton":
      return (
        <div className={`flex ${ALINEAR_FLEX[e.alinear ?? "izquierda"]}`}>
          <a
            href={e.url || "#"}
            onClick={enEditor ? (ev) => ev.preventDefault() : undefined}
            className={`lx-ui inline-flex items-center rounded-full px-6 py-3 text-sm font-bold transition ${e.estilo === "borde" ? "border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)]" : "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"}`}
          >
            {e.texto}
          </a>
        </div>
      );
    case "separador":
      return <hr className="lx-rule" />;
    case "espacio":
      return <div style={{ height: e.alto }} aria-hidden className={enEditor ? "rounded bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--border)_6px,var(--border)_7px)]" : ""} />;
    case "notas":
      if (!e.seccion) return enEditor ? <div className="rounded-xl border-2 border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--fg-muted)]">Elija de qué sección salen las notas</div> : null;
      if (!notas?.length) return enEditor ? <div className="rounded-xl border-2 border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--fg-muted)]">Aquí salen las {e.cantidad} notas más recientes de «{e.seccion}»</div> : null;
      return (
        <ul className="grid gap-5 sm:grid-cols-2">
          {notas.slice(0, e.cantidad).map((n) => (
            <li key={n.slug}>
              <a href={n.href} className="group flex gap-3">
                {n.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura
                  <img src={n.coverImageUrl} alt="" loading="lazy" className="aspect-[4/3] w-28 shrink-0 rounded-lg object-cover" />
                )}
                <span>
                  <span className="lx-display block text-lg leading-snug group-hover:text-[var(--accent)]">{n.title}</span>
                  {n.excerpt && <span className="mt-1 line-clamp-2 block text-sm text-[var(--fg-muted)]">{n.excerpt}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      );
  }
}

/** La página completa. */
export function PaginaVista({ contenido, notas }: { contenido: ContenidoPagina; notas: Record<string, NotaMini[]> }) {
  return (
    <div className="flex flex-col gap-10">
      {contenido.filas.map((f) => (
        <section key={f.id} className={`grid grid-cols-12 gap-6 md:gap-8 ${claseFondo(f.fondo)}`}>
          {f.columnas.map((n, i) => (
            <div key={i} className={`${claseColumna(n)} flex min-w-0 flex-col gap-5`}>
              {f.celdas[i]?.map((e) => (
                <ElementoVista key={e.id} e={e} notas={e.tipo === "notas" ? notas[e.seccion] : undefined} />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
