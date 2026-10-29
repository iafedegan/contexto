"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CarruselConfig } from "@/lib/carrusel";

// Una nota lista para pintar en el carrusel.
export type NotaCarrusel = { slug: string; href: string | null; /** Abrir en otra pestaña (diapositivas propias). */ externa?: boolean; /** La imagen es de cualquier sitio: sin optimizar. */ sinOptimizar?: boolean; title: string; excerpt: string; image: string | null; imageAlt: string; categoria: string | null; autor: string | null; fecha: string | null };

// Mueve el desplazamiento de un contenedor con una curva suave y la duración pedida (el `scroll-behavior` nativo no deja fijarla).
function animarScroll(el: HTMLElement, destino: number, ms: number, alTerminar: () => void) {
  const inicio = el.scrollLeft;
  const t0 = performance.now();
  el.style.scrollSnapType = "none";
  const paso = (t: number) => {
    const p = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - p, 3);
    el.scrollLeft = inicio + (destino - inicio) * e;
    if (p < 1) requestAnimationFrame(paso);
    else {
      el.style.scrollSnapType = "";
      alTerminar();
    }
  };
  requestAnimationFrame(paso);
}

/**
 * Carrusel de notas de la portada (todas las plantillas). Se ajusta con `CarruselConfig` desde /panel/portada: cuántas tarjetas se ven
 * a la vez en cada pantalla, estilo, paso automático, transición, flechas e indicadores. Respeta «reducir movimiento» del sistema.
 */
export function CarruselPortada({ config: c, notas }: { config: Required<CarruselConfig>; notas: NotaCarrusel[] }) {
  const pista = useRef<HTMLUListElement>(null);
  const animando = useRef(false);
  const [idx, setIdx] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [oculta, setOculta] = useState(false);
  const [ancho, setAncho] = useState<"escritorio" | "tableta" | "celular">("escritorio");
  const fundido = c.transicion === "fundido";

  // Cuántas se ven a la vez según el ancho de la pantalla (el fundido siempre muestra una).
  useEffect(() => {
    const ajustar = () => setAncho(window.innerWidth >= 1024 ? "escritorio" : window.innerWidth >= 640 ? "tableta" : "celular");
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);
  const visibles = fundido ? 1 : Math.min(notas.length, ancho === "escritorio" ? c.visiblesEscritorio : ancho === "tableta" ? c.visiblesTableta : c.visiblesCelular);
  const maxIdx = Math.max(0, notas.length - visibles);
  const salto = c.avance === "pagina" ? Math.max(1, visibles) : 1;
  // Posiciones a las que se puede ir (una por indicador).
  const posiciones = useMemo(() => {
    const out: number[] = [];
    for (let p = 0; p < maxIdx; p += salto) out.push(p);
    out.push(maxIdx);
    return out;
  }, [maxIdx, salto]);
  const reducido = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Va a una posición: desliza el carril o cambia la tarjeta activa.
  const ir = useCallback(
    (pos: number) => {
      const p = Math.min(maxIdx, Math.max(0, pos));
      setIdx(p);
      const el = pista.current;
      if (fundido || !el) return;
      const primera = el.children[0] as HTMLElement | undefined;
      if (!primera) return;
      const paso = primera.offsetWidth + c.separacion;
      animando.current = true;
      if (reducido) {
        el.scrollLeft = p * paso;
        animando.current = false;
      } else animarScroll(el, p * paso, c.duracion, () => (animando.current = false));
    },
    [maxIdx, fundido, c.separacion, c.duracion, reducido],
  );
  const siguiente = useCallback(() => ir(idx + salto > maxIdx ? (c.bucle && idx >= maxIdx ? 0 : maxIdx) : idx + salto), [ir, idx, salto, maxIdx, c.bucle]);
  const anterior = useCallback(() => ir(idx - salto < 0 ? (c.bucle && idx <= 0 ? maxIdx : 0) : idx - salto), [ir, idx, salto, maxIdx, c.bucle]);

  // El usuario desliza con el dedo o la rueda: se sigue la posición real.
  const alDesplazar = () => {
    const el = pista.current;
    if (!el || animando.current || fundido) return;
    const primera = el.children[0] as HTMLElement | undefined;
    if (primera) setIdx(Math.min(maxIdx, Math.round(el.scrollLeft / (primera.offsetWidth + c.separacion))));
  };

  // Paso automático.
  useEffect(() => {
    if (!c.autoplay || reducido || notas.length <= visibles) return;
    if ((c.pausarAlPasar && pausa) || oculta) return;
    if (!c.bucle && idx >= maxIdx) return;
    const t = setTimeout(siguiente, c.intervalo * 1000);
    return () => clearTimeout(t);
  }, [c.autoplay, c.intervalo, c.pausarAlPasar, c.bucle, pausa, oculta, idx, maxIdx, notas.length, visibles, siguiente, reducido]);
  // Se detiene cuando la pestaña no se ve.
  useEffect(() => {
    const f = () => setOculta(document.hidden);
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  // Al cambiar el ancho o la configuración, vuelve a una posición válida.
  useEffect(() => {
    if (idx > maxIdx) ir(maxIdx);
  }, [idx, maxIdx, ir]);

  if (notas.length === 0) return null;
  const hayVarias = notas.length > visibles;
  const pagina = Math.max(0, posiciones.findIndex((p) => p >= idx));
  const vars = {
    "--car-gap": `${c.separacion}px`,
    "--car-ancho": `${c.ancho}px`,
    "--car-blur": `${c.desenfoqueBordes}px`,
    "--car-v": visibles,
    "--car-rad": `${c.redondeo}px`,
    "--car-ratio": c.aspecto.replace(":", " / "),
    "--car-dur": `${c.duracion}ms`,
    "--car-tit": `${c.tamanoTitular}px`,
    ...(c.colorFondo ? { "--car-bg": c.colorFondo } : {}),
    ...(c.colorTexto ? { "--car-fg": c.colorTexto } : {}),
    ...(c.colorAcento ? { "--car-ac": c.colorAcento } : {}),
  } as React.CSSProperties;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={c.titulo || "Notas destacadas"}
      className="cg-car"
      data-estilo={c.estilo}
      data-flechas={c.flechas}
      data-fondo={c.colorFondo ? "propio" : undefined}
      data-bordes={c.desenfoqueBordes > 0 ? "" : undefined}
      style={vars}
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onFocusCapture={() => setPausa(true)}
      onBlurCapture={() => setPausa(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") siguiente();
        else if (e.key === "ArrowLeft") anterior();
      }}
    >
      {c.titulo && <h2 className="cg-car-titulo lx-kicker">{c.titulo}</h2>}
      <div className="cg-car-marco">
        <ul ref={pista} className={fundido ? "cg-car-pista cg-car-fundido" : "cg-car-pista"} onScroll={alDesplazar}>
          {notas.map((n, i) => (
            <li key={n.slug} className="cg-car-item" data-activa={fundido ? (i === idx ? "" : undefined) : undefined} aria-hidden={fundido && i !== idx ? true : undefined}>
              <Tarjeta n={n} oculta={fundido && i !== idx} etiqueta={c.estilo === "solo-imagen" ? n.title : undefined}>
                <span className="cg-car-img">
                  {n.image ? (
                    <Image src={n.image} alt={n.imageAlt} fill unoptimized={n.sinOptimizar} sizes={`(min-width:1024px) ${Math.round(1200 / Math.max(1, c.visiblesEscritorio))}px, 100vw`} className="object-cover" />
                  ) : (
                    <span className="cg-car-sinfoto" aria-hidden />
                  )}
                </span>
                <span className="cg-car-texto">
                  {c.mostrarCategoria && n.categoria && <span className="cg-car-cat">{n.categoria}</span>}
                  <span className="cg-car-tit lx-display">{n.title}</span>
                  {c.mostrarResumen && n.excerpt && <span className="cg-car-res">{n.excerpt}</span>}
                  {(c.mostrarAutor && n.autor) || (c.mostrarFecha && n.fecha) ? (
                    <span className="cg-car-meta">{[c.mostrarAutor ? n.autor : null, c.mostrarFecha ? n.fecha : null].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </span>
              </Tarjeta>
            </li>
          ))}
        </ul>
        {hayVarias && c.flechas !== "nunca" && (
          <>
            <button type="button" className="cg-car-flecha cg-car-prev" onClick={anterior} aria-label="Anterior" disabled={!c.bucle && idx <= 0}>
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button type="button" className="cg-car-flecha cg-car-next" onClick={siguiente} aria-label="Siguiente" disabled={!c.bucle && idx >= maxIdx}>
              <ChevronRight size={20} aria-hidden />
            </button>
          </>
        )}
      </div>
      {hayVarias && c.indicador !== "ninguno" && (
        <div className="cg-car-ind" data-tipo={c.indicador}>
          {c.indicador === "numero" ? (
            <span className="tabular-nums">
              {pagina + 1} / {posiciones.length}
            </span>
          ) : (
            posiciones.map((p, i) => (
              <button key={p} type="button" aria-label={`Ir a la ${i + 1}`} aria-current={i === pagina ? "true" : undefined} onClick={() => ir(p)} />
            ))
          )}
        </div>
      )}
      {hayVarias && c.autoplay && c.barraProgreso && (
        <div className="cg-car-prog" aria-hidden>
          <span key={`${idx}-${pausa}`} style={{ animationDuration: `${c.intervalo}s`, animationPlayState: pausa && c.pausarAlPasar ? "paused" : "running" }} />
        </div>
      )}
    </section>
  );
}

// Envoltorio de una tarjeta: enlace (interno o externo) o, si la diapositiva no lleva enlace, un bloque sin más.
function Tarjeta({ n, oculta, etiqueta, children }: { n: NotaCarrusel; oculta: boolean; etiqueta?: string; children: React.ReactNode }) {
  if (!n.href) return <div className="cg-car-tarjeta">{children}</div>;
  if (n.externa) {
    return (
      <a href={n.href} target="_blank" rel="noopener noreferrer" className="cg-car-tarjeta" tabIndex={oculta ? -1 : undefined} aria-label={etiqueta}>
        {children}
      </a>
    );
  }
  return (
    <Link href={n.href} className="cg-car-tarjeta" tabIndex={oculta ? -1 : undefined} aria-label={etiqueta}>
      {children}
    </Link>
  );
}
