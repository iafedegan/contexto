"use client";

/**
 * Las piezas de las páginas del constructor que necesitan el navegador: carrusel, pestañas, cifras que cuentan, cuenta regresiva,
 * comparación antes/después y galería con visor. Las usa `pagina-bloques-vista` tanto en el sitio como en el lienzo del constructor.
 */
import { Children, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** Carrusel con desplazamiento nativo (se arrastra con el dedo), flechas, puntos y paso automático que se detiene al pasar el ratón. */
export function Carrusel({ children, porVista = 1, auto = false, segundos = 6, puntos = true, etiqueta = "Carrusel" }: {
  children: ReactNode; porVista?: 1 | 2 | 3 | 4; auto?: boolean; segundos?: number; puntos?: boolean; etiqueta?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const slides = Children.toArray(children);
  const [actual, setActual] = useState(0);
  const [pausa, setPausa] = useState(false);

  const ir = useCallback((i: number) => {
    const el = ref.current;
    if (!el) return;
    const hijos = el.children;
    const n = hijos.length;
    if (!n) return;
    const j = ((i % n) + n) % n;
    el.scrollTo({ left: (hijos[j] as HTMLElement).offsetLeft - el.offsetLeft, behavior: "smooth" });
  }, []);

  // El punto activo sigue al desplazamiento (también cuando se arrastra con el dedo).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = () => {
      const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth || el.clientWidth;
      setActual(Math.round(el.scrollLeft / Math.max(1, w)));
    };
    el.addEventListener("scroll", f, { passive: true });
    return () => el.removeEventListener("scroll", f);
  }, []);

  useEffect(() => {
    if (!auto || pausa || slides.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const alFinal = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (alFinal) el.scrollTo({ left: 0, behavior: "smooth" });
      else ir(actual + 1);
    }, Math.max(2, segundos) * 1000);
    return () => window.clearInterval(t);
  }, [auto, pausa, segundos, actual, ir, slides.length]);

  const ancho = { 1: "basis-full", 2: "basis-full @md:basis-[calc((100%-1rem)/2)]", 3: "basis-full @md:basis-[calc((100%-1rem)/2)] @3xl:basis-[calc((100%-2rem)/3)]", 4: "basis-[85%] @md:basis-[calc((100%-1rem)/2)] @3xl:basis-[calc((100%-3rem)/4)]" }[porVista];
  const paginas = porVista === 1 ? slides.length : Math.max(1, slides.length - porVista + 1);
  return (
    <div className="@container relative" role="region" aria-roledescription="carrusel" aria-label={etiqueta} onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      <div ref={ref} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((s, i) => (
          <div key={i} className={`min-w-0 shrink-0 snap-start ${ancho}`} aria-roledescription="diapositiva" aria-label={`${i + 1} de ${slides.length}`}>
            {s}
          </div>
        ))}
      </div>
      {slides.length > porVista && (
        <>
          <button type="button" onClick={() => ir(actual - 1)} aria-label="Anterior" className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={() => ir(actual + 1)} aria-label="Siguiente" className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70">
            <ChevronRight size={20} />
          </button>
          {puntos && (
            <div className="mt-3 flex justify-center gap-1.5">
              {Array.from({ length: paginas }, (_, i) => (
                <button key={i} type="button" onClick={() => ir(i)} aria-label={`Ir a ${i + 1}`} aria-current={i === actual} className={`h-2 rounded-full transition-all ${i === actual ? "w-6 bg-[var(--accent)]" : "w-2 bg-[var(--border-strong)]"}`} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Pestañas accesibles (flechas del teclado para cambiar). */
export function Pestanas({ titulos, children, estilo = "subrayado" }: { titulos: string[]; children: ReactNode; estilo?: string }) {
  const [i, setI] = useState(0);
  const paneles = Children.toArray(children);
  const base = useId();
  return (
    <div>
      <div role="tablist" className={`flex flex-wrap gap-1 ${estilo === "botones" ? "" : "border-b border-[var(--border)]"}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setI((x) => (x + 1) % titulos.length);
          if (e.key === "ArrowLeft") setI((x) => (x - 1 + titulos.length) % titulos.length);
        }}
      >
        {titulos.map((t, k) => (
          <button key={k} type="button" role="tab" id={`${base}-t${k}`} aria-controls={`${base}-p${k}`} aria-selected={k === i} tabIndex={k === i ? 0 : -1} onClick={() => setI(k)}
            className={estilo === "botones"
              ? `lx-ui rounded-full px-4 py-2 text-sm font-semibold transition ${k === i ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--surface-2)] hover:bg-[var(--border)]"}`
              : `lx-ui -mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${k === i ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
          >
            {t || `Pestaña ${k + 1}`}
          </button>
        ))}
      </div>
      {paneles.map((p, k) => (
        <div key={k} role="tabpanel" id={`${base}-p${k}`} aria-labelledby={`${base}-t${k}`} hidden={k !== i} className="pt-5">
          {p}
        </div>
      ))}
    </div>
  );
}

/** Un número que cuenta desde cero cuando aparece en pantalla (respeta «reducir movimiento»). */
export function Cifra({ valor, animar }: { valor: string; animar: boolean }) {
  // Se separan los dígitos del formato (puntos de miles, coma decimal) para contar solo la parte numérica.
  const m = valor.match(/^([^0-9]*)([0-9][0-9.,]*)(.*)$/);
  const destino = m ? Number(m[2].replace(/\./g, "").replace(",", ".")) : NaN;
  const decimales = m && m[2].includes(",") ? (m[2].split(",")[1]?.length ?? 0) : 0;
  const [n, setN] = useState<number | null>(animar && Number.isFinite(destino) ? 0 : null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (n === null || !ref.current) return;
    let raf = 0;
    const obs = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      obs.disconnect();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(null);
      const t0 = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        const suave = 1 - Math.pow(1 - k, 3);
        setN(destino * suave);
        if (k < 1) raf = requestAnimationFrame(paso);
        else setN(null);
      };
      raf = requestAnimationFrame(paso);
    });
    obs.observe(ref.current);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
    // Solo al montar: después el número ya quedó en su valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const texto = n === null || !m ? valor : `${m[1]}${n.toLocaleString("es-CO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}${m[3]}`;
  return <span ref={ref} className="tabular-nums">{texto}</span>;
}

/** Cuenta regresiva hasta una fecha (hora de Colombia si la fecha no la trae). */
export function CuentaRegresiva({ fecha, fin }: { fecha: string; fin: string }) {
  const objetivo = fecha ? new Date(fecha.length === 10 ? `${fecha}T00:00:00-05:00` : `${fecha}:00-05:00`).getTime() : NaN;
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la hora solo se lee en el navegador (evita desfase al hidratar)
    setAhora(Date.now());
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!Number.isFinite(objetivo)) return <p className="text-sm text-[var(--fg-muted)]">Elija la fecha en las propiedades.</p>;
  const resta = Math.max(0, objetivo - (ahora ?? objetivo));
  if (ahora !== null && resta === 0) return <p className="lx-display text-3xl">{fin}</p>;
  const partes: [number, string][] = [
    [Math.floor(resta / 86400000), "días"],
    [Math.floor(resta / 3600000) % 24, "horas"],
    [Math.floor(resta / 60000) % 60, "minutos"],
    [Math.floor(resta / 1000) % 60, "segundos"],
  ];
  return (
    <div className="flex flex-wrap gap-3" aria-live="off">
      {partes.map(([v, l]) => (
        <div key={l} className="flex min-w-[4.5rem] flex-col items-center rounded-xl bg-[var(--surface-2)] px-3 py-3">
          <span className="lx-display text-4xl tabular-nums leading-none">{ahora === null ? "–" : String(v).padStart(2, "0")}</span>
          <span className="lx-ui mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">{l}</span>
        </div>
      ))}
    </div>
  );
}

/** Dos imágenes superpuestas con un control para deslizar entre «antes» y «después». */
export function Comparacion({ antes, despues, etiqueta1, etiqueta2, proporcion }: { antes: string; despues: string; etiqueta1: string; etiqueta2: string; proporcion: string }) {
  const [x, setX] = useState(50);
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-[var(--surface-2)]" style={{ aspectRatio: proporcion }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imágenes de la biblioteca */}
      <img src={despues} alt={etiqueta2} className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- imágenes de la biblioteca */}
        <img src={antes} alt={etiqueta1} className="absolute inset-0 size-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.2)]" style={{ left: `${x}%` }}>
        <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-lg">
          <ChevronLeft size={14} className="-mr-1" /><ChevronRight size={14} className="-ml-1" />
        </span>
      </div>
      {etiqueta1 && <span className="lx-ui absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">{etiqueta1}</span>}
      {etiqueta2 && <span className="lx-ui absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">{etiqueta2}</span>}
      <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label="Deslizar para comparar" className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
    </div>
  );
}

/** Galería: cuadrícula de fotos que se abren en grande, con flechas y teclado. */
const GAL_GRID: Record<number, string> = {
  2: "grid grid-cols-2 gap-3",
  3: "grid grid-cols-2 gap-3 @xl:grid-cols-3",
  4: "grid grid-cols-2 gap-3 @xl:grid-cols-3 @3xl:grid-cols-4",
  5: "grid grid-cols-2 gap-3 @xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5",
};
const GAL_COLS: Record<number, string> = {
  2: "columns-2 gap-3",
  3: "columns-2 gap-3 @xl:columns-3",
  4: "columns-2 gap-3 @xl:columns-3 @3xl:columns-4",
  5: "columns-2 gap-3 @xl:columns-3 @3xl:columns-4 @5xl:columns-5",
};

export function Galeria({ fotos, columnas, forma }: { fotos: { url: string; alt: string; pie: string }[]; columnas: number; forma: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  useEffect(() => {
    if (abierta === null) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(null);
      if (e.key === "ArrowRight") setAbierta((i) => (i === null ? i : (i + 1) % fotos.length));
      if (e.key === "ArrowLeft") setAbierta((i) => (i === null ? i : (i - 1 + fotos.length) % fotos.length));
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [abierta, fotos.length]);
  const aspecto = forma === "panoramica" ? "aspect-video" : forma === "libre" ? "" : "aspect-square";
  return (
    <>
      <div className={`${forma === "libre" ? `${GAL_COLS[columnas] ?? GAL_COLS[3]} [&>*]:mb-3` : GAL_GRID[columnas] ?? GAL_GRID[3]}`}>
        {fotos.map((f, i) => (
          <button key={i} type="button" onClick={() => setAbierta(i)} className="group block w-full overflow-hidden rounded-lg break-inside-avoid">
            {/* eslint-disable-next-line @next/next/no-img-element -- imágenes de la biblioteca */}
            <img src={f.url} alt={f.alt} loading="lazy" className={`w-full object-cover transition duration-500 group-hover:scale-105 ${aspecto}`} />
          </button>
        ))}
      </div>
      {abierta !== null && fotos[abierta] && (
        <div role="dialog" aria-modal aria-label="Foto" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setAbierta(null)}>
          <button type="button" aria-label="Cerrar" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-white/15 text-white"><X size={20} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element -- imágenes de la biblioteca */}
          <img src={fotos[abierta].url} alt={fotos[abierta].alt} className="max-h-[80vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          {fotos[abierta].pie && <p className="lx-ui mt-3 max-w-2xl text-center text-sm text-white/85">{fotos[abierta].pie}</p>}
          {fotos.length > 1 && (
            <>
              <button type="button" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setAbierta((abierta - 1 + fotos.length) % fotos.length); }} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white"><ChevronLeft size={22} /></button>
              <button type="button" aria-label="Siguiente" onClick={(e) => { e.stopPropagation(); setAbierta((abierta + 1) % fotos.length); }} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white"><ChevronRight size={22} /></button>
            </>
          )}
        </div>
      )}
    </>
  );
}
