/**
 * Cómo se ve una página del constructor: filas en una cuadrícula de 12 columnas (en el celular cada columna ocupa todo el ancho)
 * y sus elementos. La usan la página pública y el lienzo del constructor; sin consultas: las notas de una sección llegan ya leídas.
 * Los «bloques» (carrusel, tarjetas…) se dibujan en `pagina-bloques-vista`.
 */
import type { CSSProperties, ReactNode } from "react";
import type { Alinear, ContenidoPagina, Elemento, Fila } from "@/lib/paginas-bloques";
import { esBloque, videoIncrustado } from "@/lib/paginas-bloques";
import { BloqueVista } from "@/components/pagina-bloques-vista";
import { Carrusel } from "@/components/pagina-interactivos";

export type NotaMini = { slug: string; href: string; title: string; excerpt: string | null; coverImageUrl: string | null };

const ALINEAR: Record<Alinear, string> = { izquierda: "text-left", centro: "text-center", derecha: "text-right" };
const ALINEAR_FLEX: Record<Alinear, string> = { izquierda: "justify-start", centro: "justify-center", derecha: "justify-end" };
// Clases completas (Tailwind no ve clases armadas por partes).
const SPAN: Record<number, string> = {
  1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4", 5: "md:col-span-5", 6: "md:col-span-6",
  7: "md:col-span-7", 8: "md:col-span-8", 9: "md:col-span-9", 10: "md:col-span-10", 11: "md:col-span-11", 12: "md:col-span-12",
};
const OSCURO = "text-[#f3efe4] [--fg:#f3efe4] [--fg-muted:#cfd8cf] [--border:rgba(255,255,255,.18)] [--surface:rgba(255,255,255,.06)] [--surface-2:rgba(255,255,255,.1)]";
const FONDO: Record<string, string> = {
  ninguno: "",
  suave: "rounded-2xl bg-[var(--surface-2)]",
  acento: "rounded-2xl bg-[var(--accent)] text-[var(--accent-fg)] [--fg:var(--accent-fg)] [--fg-muted:var(--accent-fg)]",
  oscuro: `rounded-2xl bg-[#0b2a1c] ${OSCURO}`,
  degradado: `rounded-2xl bg-gradient-to-br from-[#0b2a1c] via-[#14432c] to-[#3b5d1f] ${OSCURO}`,
  imagen: `relative isolate overflow-hidden rounded-2xl bg-[#0b2a1c] bg-cover bg-center ${OSCURO}`,
};
const RELLENO: Record<string, string> = { compacto: "p-4 sm:p-5", normal: "p-6 sm:p-8", amplio: "p-8 sm:p-14" };
const HUECO: Record<string, string> = { compacto: "gap-4 md:gap-5", normal: "gap-6 md:gap-8", amplio: "gap-8 md:gap-12" };

export function claseColumna(n: number): string {
  return `col-span-12 ${SPAN[n] ?? "md:col-span-12"}`;
}
/** Clases de la fila: fondo, relleno (solo si tiene fondo), separación y alineación vertical. */
export function claseFila(f: Fila): string {
  const fondo = f.fondo ?? "ninguno";
  const esp = f.espaciado ?? "normal";
  return `grid grid-cols-12 ${HUECO[esp]} ${FONDO[fondo] ?? ""} ${fondo !== "ninguno" ? RELLENO[esp] : ""} ${f.vertical === "centro" ? "items-center" : ""}`;
}
/** Estilo en línea de la fila (la imagen de fondo con su velo). */
export function estiloFila(f: Fila): CSSProperties | undefined {
  if (f.fondo !== "imagen" || !f.fondoImagen) return undefined;
  return { backgroundImage: `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url(${JSON.stringify(f.fondoImagen)})` };
}
/** @deprecated se mantiene por compatibilidad: use `claseFila`. */
export function claseFondo(f: Fila["fondo"]): string {
  return FONDO[f ?? "ninguno"] ?? "";
}

const GRID_NOTAS: Record<number, string> = {
  1: "grid gap-5",
  2: "grid gap-5 @xl:grid-cols-2",
  3: "grid gap-5 @xl:grid-cols-2 @3xl:grid-cols-3",
  4: "grid gap-5 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4",
};

function TarjetaNota({ n }: { n: NotaMini }) {
  return (
    <a href={n.href} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      {n.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- portada de la nota
        <img src={n.coverImageUrl} alt="" loading="lazy" className="aspect-video w-full object-cover transition duration-500 group-hover:scale-105" />
      )}
      <span className="flex flex-col gap-1.5 p-4">
        <span className="lx-display text-lg leading-snug group-hover:text-[var(--accent)]">{n.title}</span>
        {n.excerpt && <span className="line-clamp-2 text-sm text-[var(--fg-muted)]">{n.excerpt}</span>}
      </span>
    </a>
  );
}

function NotaFila({ n }: { n: NotaMini }) {
  return (
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
  );
}

/** Un elemento tal como lo ve el lector. `notas` trae las de la sección pedida (solo para el elemento «notas»). */
export function ElementoVista({ e, notas, enEditor = false }: { e: Elemento; notas?: NotaMini[]; enEditor?: boolean }): ReactNode {
  if (esBloque(e)) return <BloqueVista e={e} enEditor={enEditor} />;
  switch (e.tipo) {
    case "titulo": {
      const cls = `lx-display tracking-tight text-balance ${e.nivel === 2 ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.6rem]"} ${ALINEAR[e.alinear ?? "izquierda"]}`;
      return (
        <div className={`flex flex-col gap-2 ${ALINEAR[e.alinear ?? "izquierda"]}`}>
          {e.antetitulo && <span className="lx-kicker text-[var(--accent)]">{e.antetitulo}</span>}
          {e.nivel === 2 ? <h2 className={cls}>{e.texto}</h2> : <h3 className={cls}>{e.texto}</h3>}
        </div>
      );
    }
    case "parrafo":
      return <p className={`whitespace-pre-line text-[1.05rem] leading-relaxed ${ALINEAR[e.alinear ?? "izquierda"]}`}>{e.texto}</p>;
    case "lista": {
      const items = e.items.filter(Boolean).map((it, i) => <li key={i}>{it}</li>);
      const cls = "flex flex-col gap-1.5 pl-5 text-[1.05rem] leading-relaxed marker:text-[var(--accent)]";
      return e.numerada ? <ol className={`list-decimal ${cls} marker:font-bold`}>{items}</ol> : <ul className={`list-disc ${cls}`}>{items}</ul>;
    }
    case "cita":
      return (
        <blockquote className="border-l-4 border-[var(--accent)] pl-5">
          <p className="lx-display text-xl italic leading-snug md:text-2xl">«{e.texto}»</p>
          {e.autor && <footer className="lx-ui mt-2 text-sm text-[var(--fg-muted)]">— {e.autor}</footer>}
        </blockquote>
      );
    case "aviso": {
      const tono = e.tono === "alerta" ? "border-[#e5214f]/40 bg-[#e5214f]/10" : e.tono === "exito" ? "border-[#16a34a]/40 bg-[#16a34a]/10" : "border-[var(--accent)]/30 bg-[var(--accent)]/10";
      return (
        <div role="note" className={`whitespace-pre-line rounded-xl border px-5 py-4 text-[0.98rem] leading-relaxed ${tono}`}>
          {e.texto}
        </div>
      );
    }
    case "imagen": {
      if (!e.url)
        return enEditor ? <div className="grid aspect-video place-items-center rounded-xl border-2 border-dashed border-[var(--border-strong)] text-sm text-[var(--fg-muted)]">Elija una imagen</div> : null;
      const forma = e.redondeo === "circulo" ? "aspect-square rounded-full" : e.redondeo === "no" ? "" : "rounded-xl";
      // eslint-disable-next-line @next/next/no-img-element -- imágenes de la biblioteca o externas, sin dominio fijo
      const img = <img src={e.url} alt={e.alt} loading="lazy" className={`w-full object-cover ${forma}`} />;
      return (
        <figure>
          {e.url_enlace ? <a href={e.url_enlace} onClick={enEditor ? (ev) => ev.preventDefault() : undefined}>{img}</a> : img}
          {e.pie && <figcaption className="lx-ui mt-2 text-sm text-[var(--fg-muted)]">{e.pie}</figcaption>}
        </figure>
      );
    }
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
    case "boton": {
      const tam = e.tamano === "grande" ? "px-8 py-4 text-base" : "px-6 py-3 text-sm";
      const est =
        e.estilo === "borde" ? `rounded-full border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] ${tam}`
        : e.estilo === "texto" ? "text-[var(--accent)] underline-offset-4 hover:underline"
        : `rounded-full bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 ${tam}`;
      return (
        <div className={`flex ${ALINEAR_FLEX[e.alinear ?? "izquierda"]}`}>
          <a href={e.url || "#"} onClick={enEditor ? (ev) => ev.preventDefault() : undefined} className={`lx-ui inline-flex items-center font-bold transition ${est}`}>
            {e.texto}
            {e.estilo === "texto" && " →"}
          </a>
        </div>
      );
    }
    case "separador":
      if (e.estilo === "puntos") return <div aria-hidden className="text-center text-2xl tracking-[1em] text-[var(--fg-muted)]">···</div>;
      if (e.estilo === "ornamento")
        return (
          <div aria-hidden className="flex items-center gap-4 text-[var(--accent)]">
            <span className="h-px flex-1 bg-[var(--border-strong)]" />◆<span className="h-px flex-1 bg-[var(--border-strong)]" />
          </div>
        );
      return <hr className="lx-rule" />;
    case "espacio":
      return <div style={{ height: e.alto }} aria-hidden className={enEditor ? "rounded bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--border)_6px,var(--border)_7px)]" : ""} />;
    case "notas": {
      if (!e.seccion) return enEditor ? <div className="rounded-xl border-2 border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--fg-muted)]">Elija de qué sección salen las notas</div> : null;
      if (!notas?.length) return enEditor ? <div className="rounded-xl border-2 border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--fg-muted)]">Aquí salen las {e.cantidad} notas más recientes de «{e.seccion}» ({e.estilo ?? "lista"})</div> : null;
      const lista = notas.slice(0, e.cantidad);
      const cols = Math.min(4, Math.max(1, e.columnas ?? 2));
      if (e.estilo === "tarjetas") return <div className={GRID_NOTAS[cols]}>{lista.map((n) => <TarjetaNota key={n.slug} n={n} />)}</div>;
      if (e.estilo === "carrusel") return <Carrusel porVista={cols as 1 | 2 | 3 | 4} etiqueta="Notas">{lista.map((n) => <TarjetaNota key={n.slug} n={n} />)}</Carrusel>;
      if (e.estilo === "portada") {
        const [a, ...resto] = lista;
        return (
          <div className="grid gap-6 @3xl:grid-cols-[3fr_2fr]">
            <a href={a.href} className="group flex flex-col gap-3">
              {a.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- portada de la nota
                <img src={a.coverImageUrl} alt="" className="aspect-video w-full rounded-2xl object-cover" />
              )}
              <span className="lx-display text-3xl leading-tight group-hover:text-[var(--accent)]">{a.title}</span>
              {a.excerpt && <span className="text-[var(--fg-muted)]">{a.excerpt}</span>}
            </a>
            <ul className="flex flex-col gap-5">{resto.map((n) => <li key={n.slug}><NotaFila n={n} /></li>)}</ul>
          </div>
        );
      }
      return <ul className={GRID_NOTAS[cols]}>{lista.map((n) => <li key={n.slug}><NotaFila n={n} /></li>)}</ul>;
    }
  }
}

/** La página completa. */
export function PaginaVista({ contenido, notas }: { contenido: ContenidoPagina; notas: Record<string, NotaMini[]> }) {
  return (
    <div className="flex flex-col gap-10">
      {contenido.filas.map((f) => (
        <section key={f.id} className={claseFila(f)} style={estiloFila(f)}>
          {f.columnas.map((n, i) => (
            <div key={i} className={`${claseColumna(n)} @container flex min-w-0 flex-col gap-5`}>
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
