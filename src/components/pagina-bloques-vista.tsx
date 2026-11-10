/**
 * Cómo se ven los «bloques» de las páginas del constructor (carrusel, tarjetas, acordeón, cifras…). Cada columna de la página es un
 * contenedor (`@container`), así que los bloques se acomodan al ancho de SU columna y no al de la pantalla: tres tarjetas en una
 * columna angosta quedan una debajo de otra. Sin consultas a la base: lo usan la página pública y el lienzo del constructor.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight, Award, BookOpen, Beef, Calendar, ChartColumn, Check, Clock, CloudRain, Coins, Download, Droplets, FileDown, Globe, GraduationCap,
  Handshake, HeartPulse, Image as ImageIcon, Landmark, Leaf, Lightbulb, Mail, MapPin, MessageCircle, Mic, Milk, Mountain, Music, Newspaper, Phone,
  Plus, Scale, ShieldCheck, Sparkles, Sprout, Star, Stethoscope, Sun, Syringe, Target, Tractor, Trees, TrendingUp, Truck, Users, Video, Wheat, Zap,
} from "lucide-react";
import { FacebookIcon, InstagramIcon, LinkedinIcon, WhatsappIcon, XIcon, YoutubeIcon } from "@/components/social-icons";
import { NewsletterForm } from "@/components/newsletter-form";
import { Carrusel, Cifra, Comparacion, CuentaRegresiva, Galeria, Pestanas } from "@/components/pagina-interactivos";
import { celdasTabla, num, type ElementoBloque, type Valores } from "@/lib/paginas-bloques";
import { ImagenSitio } from "@/components/ui/imagen-sitio";

const ICONOS: Record<string, typeof Beef> = {
  Beef, Milk, Wheat, Tractor, Leaf, Sprout, Trees, Mountain, Droplets, Sun, CloudRain, Truck, ShieldCheck, HeartPulse, Stethoscope, Syringe,
  ChartColumn, TrendingUp, Coins, Landmark, Scale, Handshake, Users, GraduationCap, BookOpen, Newspaper, Mic, Video, Calendar, Clock, MapPin,
  Phone, Mail, Globe, Award, Star, Check, Lightbulb, Target, Zap, Sparkles, MessageCircle,
};

// Clases completas (Tailwind no ve clases armadas por partes). Las variantes `@md:`… miden la columna, no la pantalla.
const GRID: Record<string, string> = {
  "1": "grid grid-cols-1 gap-5",
  "2": "grid grid-cols-1 gap-5 @md:grid-cols-2",
  "3": "grid grid-cols-1 gap-5 @md:grid-cols-2 @3xl:grid-cols-3",
  "4": "grid grid-cols-1 gap-5 @sm:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4",
  "5": "grid grid-cols-2 gap-5 @xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5",
};
const GRID_PERSONAS: Record<string, string> = {
  "2": "grid grid-cols-2 gap-6",
  "3": "grid grid-cols-2 gap-6 @2xl:grid-cols-3",
  "4": "grid grid-cols-2 gap-6 @2xl:grid-cols-3 @4xl:grid-cols-4",
  "5": "grid grid-cols-2 gap-6 @2xl:grid-cols-3 @4xl:grid-cols-4 @5xl:grid-cols-5",
};
const GRID_PASOS: Record<number, string> = {
  1: "grid gap-6", 2: "grid gap-6 @2xl:grid-cols-2", 3: "grid gap-6 @2xl:grid-cols-3", 4: "grid gap-6 @2xl:grid-cols-2 @4xl:grid-cols-4",
};
const ALINEAR: Record<string, string> = { izquierda: "text-left", centro: "text-center", derecha: "text-right" };
const ALINEAR_FLEX: Record<string, string> = { izquierda: "justify-start", centro: "justify-center", derecha: "justify-end" };

/** Una imagen o, en el constructor y sin imagen, el recuadro que pide elegirla. */
function Foto({ url, alt = "", className = "", enEditor, aspecto }: { url: string; alt?: string; className?: string; enEditor?: boolean; aspecto?: string }) {
  if (url)
    return <ImagenSitio src={url} alt={alt} className={`object-cover ${className}`} style={aspecto ? { aspectRatio: aspecto } : undefined} />;
  if (!enEditor) return null;
  return (
    <div className={`grid place-items-center bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_10px,var(--bg)_10px,var(--bg)_20px)] text-[var(--fg-muted)] ${className}`} style={aspecto ? { aspectRatio: aspecto } : undefined}>
      <ImageIcon size={22} />
    </div>
  );
}

/** Enlace que en el constructor no navega. */
function Enlace({ url, enEditor, className, children, ariaLabel }: { url: string; enEditor?: boolean; className?: string; children: ReactNode; ariaLabel?: string }) {
  if (!url) return <div className={className}>{children}</div>;
  const externo = /^https?:/.test(url);
  return (
    <a href={url} aria-label={ariaLabel} onClick={enEditor ? (e) => e.preventDefault() : undefined} className={className} {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

function Boton({ texto, url, enEditor, variante = "lleno", claro = false }: { texto: string; url: string; enEditor?: boolean; variante?: "lleno" | "borde"; claro?: boolean }) {
  if (!texto) return null;
  const cls =
    variante === "borde"
      ? claro ? "border-2 border-white/80 text-white hover:bg-white hover:text-black" : "border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)]"
      : claro ? "bg-white text-[#0b2a1c] hover:bg-white/90" : "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90";
  return (
    <Enlace url={url || "#"} enEditor={enEditor} className={`lx-ui inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition ${cls}`}>
      {texto}
    </Enlace>
  );
}

const Vacio = ({ texto }: { texto: string }) => (
  <div className="rounded-xl border-2 border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--fg-muted)]">{texto}</div>
);

function Red({ red, size = 18 }: { red: string; size?: number }) {
  switch (red) {
    case "facebook": return <FacebookIcon size={size} />;
    case "instagram": return <InstagramIcon size={size} />;
    case "x": return <XIcon size={size} />;
    case "youtube": return <YoutubeIcon size={size} />;
    case "linkedin": return <LinkedinIcon size={size} />;
    case "whatsapp": return <WhatsappIcon size={size} />;
    case "tiktok": return <Music size={size} />;
    case "correo": return <Mail size={size} />;
    default: return <Globe size={size} />;
  }
}
const NOMBRE_RED: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", x: "X", youtube: "YouTube", linkedin: "LinkedIn", whatsapp: "WhatsApp", tiktok: "TikTok", correo: "Correo", web: "Sitio web" };

/** Una tarjeta del bloque «Tarjetas». */
function Tarjeta({ it, estilo, proporcion, enEditor }: { it: Valores; estilo: string; proporcion: string; enEditor?: boolean }) {
  if (estilo === "superpuesta")
    return (
      <Enlace url={it.url} enEditor={enEditor} className="group relative isolate flex h-full min-h-64 flex-col justify-end overflow-hidden rounded-2xl bg-[#0b2a1c] p-5 text-white">
        <Foto url={it.imagen} enEditor={enEditor} className="absolute inset-0 -z-10 size-full transition duration-500 group-hover:scale-105" />
        <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <span className="flex flex-col gap-1.5">
          {it.etiqueta && <span className="lx-kicker text-[#e9c46a]">{it.etiqueta}</span>}
          <span className="lx-display text-xl leading-snug">{it.titulo}</span>
          {it.texto && <span className="line-clamp-3 text-sm text-white/80">{it.texto}</span>}
        </span>
      </Enlace>
    );
  const caja =
    estilo === "sombra" ? "bg-[var(--surface)] shadow-[0_10px_30px_-14px_rgba(0,0,0,.35)]"
    : estilo === "borde" ? "border border-[var(--border)] bg-[var(--surface)]"
    : "";
  const horizontal = estilo === "horizontal";
  return (
    <Enlace url={it.url} enEditor={enEditor} className={`group flex h-full overflow-hidden rounded-2xl ${horizontal ? "flex-row gap-4 border border-[var(--border)] bg-[var(--surface)]" : `flex-col ${caja}`}`}>
      {(it.imagen || enEditor) && (
        <span className={`block overflow-hidden ${horizontal ? "w-2/5 shrink-0" : ""} ${estilo === "plana" ? "rounded-2xl" : ""}`}>
          <Foto url={it.imagen} enEditor={enEditor} aspecto={horizontal ? undefined : proporcion} className={`w-full transition duration-500 group-hover:scale-105 ${horizontal ? "h-full" : ""}`} />
        </span>
      )}
      <span className={`flex flex-1 flex-col gap-2 ${estilo === "plana" ? "pt-4" : "p-5"}`}>
        {it.etiqueta && <span className="lx-kicker text-[var(--accent)]">{it.etiqueta}</span>}
        <span className="lx-display text-xl leading-snug group-hover:text-[var(--accent)]">{it.titulo}</span>
        {it.texto && <span className="whitespace-pre-line text-[0.95rem] leading-relaxed text-[var(--fg-muted)]">{it.texto}</span>}
        {it.boton && it.url && (
          <span className="lx-ui mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-bold text-[var(--accent)]">
            {it.boton} <ArrowRight size={15} className="transition group-hover:translate-x-1" />
          </span>
        )}
      </span>
    </Enlace>
  );
}

function Testimonio({ it, enEditor, grande = false }: { it: Valores; enEditor?: boolean; grande?: boolean }) {
  return (
    <figure className={`flex h-full flex-col gap-4 rounded-2xl ${grande ? "items-center text-center" : "border border-[var(--border)] bg-[var(--surface)] p-6"}`}>
      <span aria-hidden className="lx-display text-5xl leading-none text-[var(--accent)]">“</span>
      <blockquote className={`lx-display flex-1 leading-snug ${grande ? "max-w-3xl text-2xl @2xl:text-3xl" : "text-lg"}`}>{it.texto}</blockquote>
      <figcaption className="flex items-center gap-3">
        <Foto url={it.foto} enEditor={enEditor} className="size-11 shrink-0 rounded-full" />
        <span className={grande ? "text-left" : ""}>
          <span className="lx-ui block text-sm font-bold">{it.nombre}</span>
          {it.cargo && <span className="lx-ui block text-xs text-[var(--fg-muted)]">{it.cargo}</span>}
        </span>
      </figcaption>
    </figure>
  );
}

/** Un bloque tal como lo ve el lector. */
export function BloqueVista({ e, enEditor = false }: { e: ElementoBloque; enEditor?: boolean }): ReactNode {
  const p = e.p;
  const items = e.items;
  switch (e.tipo) {
    case "heroe": {
      const alto = { medio: "min-h-[22rem]", alto: "min-h-[32rem]", pantalla: "min-h-[calc(100svh-9rem)]" }[p.alto] ?? "min-h-[32rem]";
      const o = num(p.oscurecer, 0, 90, 45) / 100;
      const centro = p.alinear === "centro";
      return (
        <div className={`relative isolate flex overflow-hidden rounded-2xl bg-[#0b2a1c] text-white ${alto} ${centro ? "items-center justify-center text-center" : "items-end"}`}>
          {p.imagen && (
            <ImagenSitio src={p.imagen} alt="" sizes="100vw" ancho={1920} alto={1080} className="absolute inset-0 -z-10 size-full object-cover" />
          )}
          <span className="absolute inset-0 -z-10" style={{ background: `linear-gradient(to top, rgba(0,0,0,${o + 0.1}), rgba(0,0,0,${o * 0.35}))` }} />
          <div className={`flex max-w-3xl flex-col gap-4 p-6 @2xl:p-12 ${centro ? "items-center" : ""}`}>
            {p.antetitulo && <span className="lx-kicker text-[#e9c46a]">{p.antetitulo}</span>}
            {p.titulo && <h2 className="lx-display text-4xl leading-[1.05] tracking-tight text-balance @3xl:text-6xl">{p.titulo}</h2>}
            {p.texto && <p className="whitespace-pre-line text-lg leading-relaxed text-white/85">{p.texto}</p>}
            {(p.boton || p.boton2) && (
              <div className="mt-2 flex flex-wrap gap-3">
                <Boton texto={p.boton} url={p.url} enEditor={enEditor} claro />
                <Boton texto={p.boton2} url={p.url2} enEditor={enEditor} variante="borde" claro />
              </div>
            )}
            {enEditor && !p.imagen && <span className="text-xs text-white/60">Elija la imagen de fondo en las propiedades.</span>}
          </div>
        </div>
      );
    }
    case "carrusel": {
      // Una diapositiva sin foto pero con título también se muestra (sobre el degradado de la marca): si no, el carrusel desaparecía entero.
      const vis = items.filter((it) => it.imagen || it.titulo || it.texto || enEditor);
      if (!vis.length) return enEditor ? <Vacio texto="Agregue diapositivas" /> : null;
      return (
        <Carrusel auto={p.auto === "si" && !enEditor} segundos={num(p.segundos, 2, 20, 6)} etiqueta="Carrusel de imágenes">
          {vis.map((it) => (
            <Enlace key={it._id} url={it.url} enEditor={enEditor} className="relative block overflow-hidden rounded-2xl bg-[#0b2a1c] text-white">
              {it.imagen || enEditor ? (
                <Foto url={it.imagen} enEditor={enEditor} aspecto={p.proporcion} className="w-full" />
              ) : (
                <span aria-hidden className="block w-full bg-gradient-to-br from-[#0b2a1c] via-[#14432c] to-[#3b5d1f]" style={{ aspectRatio: p.proporcion }} />
              )}
              {p.texto !== "no" && (it.titulo || it.texto) && (
                <span className={`absolute inset-0 flex flex-col gap-1 p-6 @2xl:p-10 ${p.texto === "centro" ? "items-center justify-center bg-black/40 text-center" : "justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent"}`}>
                  {it.titulo && <span className="lx-display text-2xl leading-tight @2xl:text-4xl">{it.titulo}</span>}
                  {it.texto && <span className="max-w-2xl text-sm text-white/85 @2xl:text-base">{it.texto}</span>}
                </span>
              )}
            </Enlace>
          ))}
        </Carrusel>
      );
    }
    case "tarjetas": {
      if (!items.length) return enEditor ? <Vacio texto="Agregue tarjetas" /> : null;
      const tarjetas = items.map((it) => <Tarjeta key={it._id} it={it} estilo={p.estilo} proporcion={p.proporcion} enEditor={enEditor} />);
      if (p.carrusel === "si")
        return <Carrusel porVista={Math.min(4, Math.max(1, Number(p.columnas) || 3)) as 1 | 2 | 3 | 4} etiqueta="Tarjetas">{tarjetas}</Carrusel>;
      return <div className={GRID[p.columnas] ?? GRID["3"]}>{tarjetas}</div>;
    }
    case "galeria": {
      const fotos = items.filter((it) => it.imagen).map((it) => ({ url: it.imagen, alt: it.alt, pie: it.pie }));
      if (!fotos.length)
        return enEditor ? (
          <div className={GRID_PERSONAS[p.columnas] ?? GRID_PERSONAS["3"]}>
            {items.map((it) => <Foto key={it._id} url="" enEditor aspecto="1/1" className="w-full rounded-lg" />)}
          </div>
        ) : null;
      return <Galeria fotos={fotos} columnas={num(p.columnas, 2, 5, 3)} forma={p.forma} />;
    }
    case "acordeon":
      return (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {items.map((it, i) => (
            <details key={it._id} open={p.primera === "si" && i === 0} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-left [&::-webkit-details-marker]:hidden">
                <span className="lx-display text-lg leading-snug">{it.titulo}</span>
                <Plus size={20} className="shrink-0 text-[var(--accent)] transition group-open:rotate-45" />
              </summary>
              <p className="whitespace-pre-line pb-4 text-[1.02rem] leading-relaxed text-[var(--fg-muted)]">{it.texto}</p>
            </details>
          ))}
        </div>
      );
    case "pestanas":
      if (!items.length) return enEditor ? <Vacio texto="Agregue pestañas" /> : null;
      return (
        <Pestanas titulos={items.map((it) => it.titulo)} estilo={p.estilo}>
          {items.map((it) => (
            <div key={it._id} className="grid gap-5 @2xl:grid-cols-[1fr_auto]">
              <p className="whitespace-pre-line text-[1.05rem] leading-relaxed">{it.texto}</p>
              {it.imagen && <Foto url={it.imagen} className="w-full rounded-xl @2xl:w-72" />}
            </div>
          ))}
        </Pestanas>
      );
    case "cifras": {
      const caja = p.estilo === "tarjeta" ? "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" : p.estilo === "acento" ? "rounded-2xl bg-[var(--accent)] p-6 text-[var(--accent-fg)]" : "";
      const grid = { "2": "grid gap-6 @md:grid-cols-2", "3": "grid gap-6 @md:grid-cols-3", "4": "grid gap-6 grid-cols-2 @3xl:grid-cols-4" }[p.columnas] ?? "grid gap-6 @md:grid-cols-3";
      return (
        <div className={grid}>
          {items.map((it) => (
            <div key={it._id} className={`flex flex-col gap-1 ${caja}`}>
              <span className="lx-display text-4xl leading-none tracking-tight @xs:text-5xl">
                {it.prefijo}
                <Cifra valor={it.valor} animar={p.animar === "si" && !enEditor} />
                {it.sufijo && <span className="ml-1 text-[0.55em]">{it.sufijo}</span>}
              </span>
              <span className={`lx-ui text-sm font-semibold ${p.estilo === "acento" ? "opacity-85" : "text-[var(--fg-muted)]"}`}>{it.etiqueta}</span>
            </div>
          ))}
        </div>
      );
    }
    case "caracteristicas":
      return (
        <div className={GRID[p.columnas] ?? GRID["3"]}>
          {items.map((it) => {
            const Icono = ICONOS[it.icono] ?? Star;
            const lado = p.estilo === "lado";
            return (
              <Enlace key={it._id} url={it.url} enEditor={enEditor} className={`group flex gap-4 ${lado ? "flex-row" : "flex-col"} ${p.estilo === "tarjeta" ? "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" : ""}`}>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]"><Icono size={24} /></span>
                <span className="flex flex-col gap-1.5">
                  <span className="lx-display text-xl leading-snug group-hover:text-[var(--accent)]">{it.titulo}</span>
                  {it.texto && <span className="whitespace-pre-line text-[0.97rem] leading-relaxed text-[var(--fg-muted)]">{it.texto}</span>}
                </span>
              </Enlace>
            );
          })}
        </div>
      );
    case "testimonios":
      if (!items.length) return enEditor ? <Vacio texto="Agregue testimonios" /> : null;
      if (p.estilo === "grande") return <Testimonio it={items[0]} enEditor={enEditor} grande />;
      if (p.estilo === "carrusel") return <Carrusel porVista={2} etiqueta="Testimonios">{items.map((it) => <Testimonio key={it._id} it={it} enEditor={enEditor} />)}</Carrusel>;
      return <div className={GRID["2"]}>{items.map((it) => <Testimonio key={it._id} it={it} enEditor={enEditor} />)}</div>;
    case "linea": {
      const alterna = p.estilo === "alterna";
      return (
        <ol className={`relative flex flex-col gap-8 ${alterna ? "before:absolute before:inset-y-0 before:left-[0.45rem] before:w-0.5 before:bg-[var(--border)] @3xl:before:left-1/2" : "border-l-2 border-[var(--border)] pl-7"}`}>
          {items.map((it, i) => (
            <li key={it._id} className={`relative ${alterna ? `pl-8 @3xl:w-1/2 ${i % 2 ? "@3xl:ml-auto @3xl:pl-10" : "@3xl:pl-0 @3xl:pr-10 @3xl:text-right"}` : ""}`}>
              <span
                aria-hidden
                className={`absolute top-1.5 size-4 rounded-full border-[3px] border-[var(--bg)] bg-[var(--accent)] ring-2 ring-[var(--accent)] ${alterna ? `left-0 ${i % 2 ? "@3xl:-left-2" : "@3xl:left-auto @3xl:-right-2"}` : "-left-[2.3rem]"}`}
              />
              <span className="lx-kicker text-[var(--accent)]">{it.fecha}</span>
              <h3 className="lx-display mt-1 text-xl leading-snug">{it.titulo}</h3>
              {it.texto && <p className="mt-1.5 whitespace-pre-line leading-relaxed text-[var(--fg-muted)]">{it.texto}</p>}
              {it.imagen && <Foto url={it.imagen} className={`mt-3 w-full max-w-md rounded-xl ${alterna && !(i % 2) ? "@3xl:ml-auto" : ""}`} />}
            </li>
          ))}
        </ol>
      );
    }
    case "pasos": {
      const horizontal = p.direccion === "horizontal";
      return (
        <ol className={horizontal ? GRID_PASOS[Math.min(4, items.length || 1)] : "flex flex-col gap-5"}>
          {items.map((it, i) => (
            <li key={it._id} className={`flex gap-4 ${horizontal ? "flex-col" : "flex-row"}`}>
              <span className="lx-display grid size-12 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xl text-[var(--accent-fg)]">{i + 1}</span>
              <span className="flex flex-col gap-1">
                <span className="lx-display text-xl leading-snug">{it.titulo}</span>
                {it.texto && <span className="whitespace-pre-line leading-relaxed text-[var(--fg-muted)]">{it.texto}</span>}
              </span>
            </li>
          ))}
        </ol>
      );
    }
    case "equipo":
      return (
        <div className={GRID_PERSONAS[p.columnas] ?? GRID_PERSONAS["4"]}>
          {items.map((it) => (
            <Enlace key={it._id} url={it.url} enEditor={enEditor} className="group flex flex-col items-center gap-2 text-center">
              <Foto url={it.foto} enEditor={enEditor} aspecto="1/1" className={`w-full max-w-44 ${p.forma === "circulo" ? "rounded-full" : "rounded-2xl"}`} />
              <span className="lx-display mt-1 text-lg leading-snug group-hover:text-[var(--accent)]">{it.nombre}</span>
              {it.cargo && <span className="lx-ui -mt-1 text-sm font-semibold text-[var(--accent)]">{it.cargo}</span>}
              {it.texto && <span className="text-sm leading-relaxed text-[var(--fg-muted)]">{it.texto}</span>}
            </Enlace>
          ))}
        </div>
      );
    case "logos": {
      const logo = (it: Valores, k: string) => (
        <Enlace key={k} url={it.url} enEditor={enEditor} ariaLabel={it.nombre} className={`grid h-20 w-36 shrink-0 place-items-center ${p.gris === "si" ? "opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" : ""}`}>
          {it.imagen ? (
            <ImagenSitio src={it.imagen} alt={it.nombre} sizes="200px" ancho={320} alto={128} className="h-auto max-h-16 w-auto max-w-full object-contain" />
          ) : (
            <span className="lx-ui rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--fg-muted)]">{it.nombre || "Logo"}</span>
          )}
        </Enlace>
      );
      return (
        <div className="flex flex-col gap-4">
          {p.titulo && <p className="lx-kicker text-center text-[var(--fg-muted)]">{p.titulo}</p>}
          {p.movimiento === "si" && !enEditor ? (
            <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
              <div className="lx-marquee !gap-0" style={{ "--lx-marquee-s": `${Math.max(16, items.length * 5)}s` } as CSSProperties}>
                {[0, 1].map((k) => (
                  <div key={k} aria-hidden={k === 1} className="flex shrink-0 items-center gap-10 pr-10">
                    {items.map((it) => logo(it, `${k}-${it._id}`))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">{items.map((it) => logo(it, it._id))}</div>
          )}
        </div>
      );
    }
    case "tabla": {
      const filas = celdasTabla(p.datos);
      if (!filas.length) return enEditor ? <Vacio texto="Escriba los datos de la tabla" /> : null;
      const [cab, ...cuerpo] = p.encabezado === "si" ? filas : [null, ...filas];
      return (
        <figure className="flex flex-col gap-2">
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full border-collapse text-left text-[0.95rem]">
              {cab && (
                <thead className="bg-[var(--surface-2)]">
                  <tr>{cab.map((c, i) => <th key={i} scope="col" className="lx-ui whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-[0.08em]">{c}</th>)}</tr>
                </thead>
              )}
              <tbody>
                {cuerpo.map((f, i) => (
                  <tr key={i} className={`border-t border-[var(--border)] ${p.rayada === "si" && i % 2 ? "bg-[var(--surface-2)]/50" : ""}`}>
                    {(f ?? []).map((c, j) => <td key={j} className="px-4 py-3 tabular-nums">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.pie && <figcaption className="lx-ui text-xs text-[var(--fg-muted)]">{p.pie}</figcaption>}
        </figure>
      );
    }
    case "llamado": {
      const fondo =
        p.estilo === "oscuro" ? "bg-[#0b2a1c] text-white"
        : p.estilo === "suave" ? "bg-[var(--surface-2)]"
        : p.estilo === "imagen" ? "bg-[#0b2a1c] text-white"
        : "bg-[var(--accent)] text-[var(--accent-fg)]";
      const claro = p.estilo === "oscuro" || p.estilo === "imagen" || p.estilo === "acento" || !p.estilo;
      const centro = p.alinear === "centro";
      return (
        <div className={`relative isolate overflow-hidden rounded-2xl p-7 @2xl:p-10 ${fondo}`}>
          {p.estilo === "imagen" && p.imagen && (
            <>
              <ImagenSitio src={p.imagen} alt="" sizes="100vw" ancho={1920} alto={1080} className="absolute inset-0 -z-10 size-full object-cover" />
              <span className="absolute inset-0 -z-10 bg-black/55" />
            </>
          )}
          <div className={`flex flex-col gap-5 ${centro ? "items-center text-center" : "@2xl:flex-row @2xl:items-center @2xl:justify-between"}`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="lx-display text-3xl leading-tight tracking-tight text-balance">{p.titulo}</h2>
              {p.texto && <p className="whitespace-pre-line text-lg leading-relaxed opacity-85">{p.texto}</p>}
            </div>
            <div className="shrink-0">
              <Boton texto={p.boton} url={p.url} enEditor={enEditor} claro={claro} />
            </div>
          </div>
        </div>
      );
    }
    case "destacado": {
      const t = p.tamano === "enorme" ? "text-4xl @2xl:text-6xl" : "text-2xl @2xl:text-4xl";
      const c = p.color === "acento" ? "text-[var(--accent)]" : p.color === "oro" ? "lx-foil" : "";
      return <p className={`lx-display whitespace-pre-line leading-[1.12] tracking-tight text-balance ${t} ${c} ${ALINEAR[p.alinear] ?? ""}`}>{p.texto}</p>;
    }
    case "audio": {
      let sc = false;
      try {
        sc = /(^|\.)soundcloud\.com$/.test(new URL(p.url).hostname);
      } catch {}
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          {p.titulo && <p className="lx-display flex items-center gap-2 text-xl"><Mic size={20} className="text-[var(--accent)]" /> {p.titulo}</p>}
          {p.texto && <p className="whitespace-pre-line text-[0.97rem] text-[var(--fg-muted)]">{p.texto}</p>}
          {!p.url ? (
            enEditor && <p className="text-sm text-[var(--fg-muted)]">Pegue el enlace del audio en las propiedades.</p>
          ) : sc ? (
            <iframe title={p.titulo || "Audio"} loading="lazy" className={`h-[166px] w-full rounded-lg ${enEditor ? "pointer-events-none" : ""}`} src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(p.url)}&color=%230b2a1c`} />
          ) : (
            <audio controls preload="none" src={p.url} className="w-full" />
          )}
        </div>
      );
    }
    case "mapa":
      if (!p.lugar) return enEditor ? <Vacio texto="Escriba el lugar del mapa" /> : null;
      return (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)]" style={{ height: num(p.alto, 200, 700, 380) }}>
          <iframe
            title={`Mapa: ${p.lugar}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className={`size-full ${enEditor ? "pointer-events-none" : ""}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(p.lugar)}&z=${num(p.zoom, 3, 19, 15)}&output=embed`}
          />
        </div>
      );
    case "contacto": {
      const tel = p.telefono.replace(/[^\d+]/g, "");
      const wa = p.whatsapp.replace(/\D/g, "");
      const correo = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(p.correo.trim()) ? p.correo.trim() : "";
      const filas: [ReactNode, string, string, string][] = [
        [<Phone key="t" size={18} />, "Teléfono", p.telefono, tel ? `tel:${tel}` : ""],
        [<WhatsappIcon key="w" size={18} />, "WhatsApp", wa ? `+${wa}` : "", wa ? `https://wa.me/${wa}` : ""],
        [<Mail key="m" size={18} />, "Correo", correo, correo ? `mailto:${correo}` : ""],
        [<MapPin key="d" size={18} />, "Dirección", p.direccion, ""],
        [<Clock key="h" size={18} />, "Horario", p.horario, ""],
      ];
      const tarjetas = p.estilo === "tarjetas";
      return (
        <div className="flex flex-col gap-4">
          {p.titulo && <h2 className="lx-display text-3xl tracking-tight">{p.titulo}</h2>}
          <ul className={tarjetas ? GRID["2"] : "flex flex-col gap-3"}>
            {filas.filter(([, , v]) => v).map(([icono, rotulo, valor, href]) => (
              <li key={rotulo} className={tarjetas ? "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" : ""}>
                <Enlace url={href} enEditor={enEditor} className="group flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">{icono}</span>
                  <span>
                    <span className="lx-ui block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fg-muted)]">{rotulo}</span>
                    <span className={`block text-[1.02rem] ${href ? "font-semibold group-hover:text-[var(--accent)]" : ""}`}>{valor}</span>
                  </span>
                </Enlace>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "cuenta":
      return (
        <div className="flex flex-col items-start gap-4">
          {p.titulo && <p className="lx-kicker text-[var(--accent)]">{p.titulo}</p>}
          <CuentaRegresiva fecha={p.fecha} fin={p.fin} />
          <Boton texto={p.boton} url={p.url} enEditor={enEditor} />
        </div>
      );
    case "redes":
      return (
        <div className={`flex flex-col gap-3 ${ALINEAR[p.alinear] ?? ""}`}>
          {p.titulo && <p className="lx-kicker text-[var(--fg-muted)]">{p.titulo}</p>}
          <ul className={`flex flex-wrap gap-2 ${ALINEAR_FLEX[p.alinear] ?? ""}`}>
            {items.filter((it) => it.url || enEditor).map((it) => (
              <li key={it._id}>
                <Enlace
                  url={it.url}
                  enEditor={enEditor}
                  ariaLabel={NOMBRE_RED[it.red] ?? "Red social"}
                  className={p.estilo === "botones"
                    ? "lx-ui inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    : "grid size-11 place-items-center rounded-full bg-[var(--surface-2)] transition hover:bg-[var(--accent)] hover:text-[var(--accent-fg)]"}
                >
                  <Red red={it.red} />
                  {p.estilo === "botones" && (NOMBRE_RED[it.red] ?? "Enlace")}
                </Enlace>
              </li>
            ))}
          </ul>
        </div>
      );
    case "descarga":
      return (
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 @xl:flex-row @xl:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]"><FileDown size={26} /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="lx-display text-xl leading-snug">{p.titulo}</span>
            {p.texto && <span className="whitespace-pre-line text-[0.95rem] text-[var(--fg-muted)]">{p.texto}</span>}
            {p.detalle && <span className="lx-ui text-xs font-semibold uppercase tracking-[0.1em] text-[var(--fg-muted)]">{p.detalle}</span>}
          </span>
          {p.url ? (
            <Enlace url={p.url} enEditor={enEditor} className="lx-ui inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-fg)] @xl:self-auto">
              <Download size={16} /> {p.boton || "Descargar"}
            </Enlace>
          ) : (
            enEditor && <span className="text-xs text-[var(--fg-muted)]">Falta el enlace del archivo</span>
          )}
        </div>
      );
    case "boletin":
      return (
        <div className="flex flex-col gap-3 rounded-2xl bg-[var(--surface-2)] p-6">
          {p.titulo && <h2 className="lx-display text-2xl leading-tight">{p.titulo}</h2>}
          {p.texto && <p className="text-[0.97rem] text-[var(--fg-muted)]">{p.texto}</p>}
          {enEditor ? (
            <div className="flex gap-2">
              <span className="flex-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--fg-muted)]">correo@ejemplo.com</span>
              <span className="lx-ui rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-fg)]">Suscribirme</span>
            </div>
          ) : (
            <NewsletterForm locale="es" compacto />
          )}
        </div>
      );
    case "comparacion":
      if (!p.antes || !p.despues)
        return enEditor ? <Foto url="" enEditor aspecto={p.proporcion} className="w-full rounded-xl" /> : null;
      return <Comparacion antes={p.antes} despues={p.despues} etiqueta1={p.etiqueta1} etiqueta2={p.etiqueta2} proporcion={p.proporcion} />;
    case "precios":
      return (
        <div className={`${GRID[p.columnas] ?? GRID["3"]} items-stretch`}>
          {items.map((it) => {
            const dest = it.destacado === "si";
            return (
              <div key={it._id} className={`relative flex flex-col gap-4 rounded-2xl p-6 ${dest ? "border-2 border-[var(--accent)] bg-[var(--surface)] shadow-[0_14px_40px_-18px_rgba(0,0,0,.4)]" : "border border-[var(--border)] bg-[var(--surface)]"}`}>
                {dest && <span className="lx-ui absolute -top-3 left-6 rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-bold text-[var(--accent-fg)]">Recomendado</span>}
                <span className="lx-ui text-sm font-bold uppercase tracking-[0.1em] text-[var(--fg-muted)]">{it.nombre}</span>
                <span className="lx-display text-4xl leading-none tracking-tight">
                  {it.precio} {it.periodo && <span className="lx-ui text-sm font-semibold text-[var(--fg-muted)]">{it.periodo}</span>}
                </span>
                <ul className="flex flex-1 flex-col gap-2">
                  {it.incluye.split("\n").filter(Boolean).map((l, i) => (
                    <li key={i} className="flex gap-2 text-[0.95rem]"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" /> {l}</li>
                  ))}
                </ul>
                <Boton texto={it.boton} url={it.url} enEditor={enEditor} variante={dest ? "lleno" : "borde"} />
              </div>
            );
          })}
        </div>
      );
  }
}
