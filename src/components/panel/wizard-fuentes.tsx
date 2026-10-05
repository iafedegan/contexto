"use client";

import { ArrowRight, Check, Link2, Lightbulb, Loader2, Mic, Search, Sparkles, TrendingUp } from "lucide-react";
import type { NewsItem, TopicIdea } from "@/app/panel/(app)/articulos/ai-actions";
import { Carrusel } from "@/components/panel/carrusel";
import { ParticipantesForm, participantesListos } from "@/components/panel/entrevista-editor";
import type { Participante } from "@/lib/material-types";

/**
 * Pantallas del primer paso del asistente: de dónde partir (ideas de la IA, noticias, una grabación o enlaces).
 * Cada fuente tiene su propia pantalla y las listas largas van en carrusel: nada obliga a desplazarse.
 */

/** Campo de texto y botón que comparten las pantallas de búsqueda. */
const CAMPO = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 !py-2 text-sm outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-muted)]/50";

// Nombre de cada fuente que el editor puede elegir para empezar.
export type Fuente = "ideas" | "noticias" | "entrevista" | "enlaces";

/** Las cuatro fuentes con su ícono, nombre y una línea que explica qué hace. */
const FUENTES = [
  { id: "ideas", Icono: Lightbulb, titulo: "Ideas de la IA", ayuda: "Temas en tendencia del sector, con sus fuentes." },
  { id: "noticias", Icono: Search, titulo: "Buscar noticias", ayuda: "Investiga una persona o tema en medios, YouTube y fuentes oficiales." },
  { id: "entrevista", Icono: Mic, titulo: "Voz o video", ayuda: "Sube una grabación: la IA la transcribe por intervenciones." },
  { id: "enlaces", Icono: Link2, titulo: "Enlaces", ayuda: "Pega hasta 5 páginas y redacta con palabras propias." },
] as const;

/** Las cuatro fuentes como tarjetas; al pulsar una se abre su pantalla. `notas` muestra lo ya cargado de cada una. */
export function FuenteCards({ onElegir, notas }: { onElegir: (f: Fuente) => void; notas: Partial<Record<Fuente, string>> }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="lx-kicker text-[var(--fg-muted)]">¿Prefieres partir de otra cosa?</p>
      <ul className="grid gap-2 @lg:grid-cols-2 @2xl:grid-cols-1">
        {FUENTES.map(({ id, Icono, titulo, ayuda }) => (
          <li key={id} className="flex">
            <button
              type="button"
              onClick={() => onElegir(id)}
              className="group flex w-full items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 text-left transition hover:-translate-y-px hover:border-[var(--accent)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
                <Icono size={17} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {titulo}
                  {notas[id] && <span className="rounded-full bg-[#16a34a]/12 px-2 py-0.5 text-[0.65rem] font-semibold text-[#15803d]">{notas[id]}</span>}
                </span>
                <span className="line-clamp-1 block text-xs text-[var(--fg-muted)]">{ayuda}</span>
              </span>
              <ArrowRight size={15} aria-hidden className="shrink-0 text-[var(--fg-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Una idea de la IA: etiqueta de ámbito, titular, enfoque (3 líneas) y por qué es tendencia (2). */
function IdeaCard({ i, elegido, onPick }: { i: TopicIdea; elegido: boolean; onPick: (i: TopicIdea) => void }) {
  const local = i.scope === "local";
  return (
    <button
      type="button"
      onClick={() => onPick(i)}
      aria-pressed={elegido}
      className={`group flex w-full flex-1 flex-col gap-1.5 rounded-[var(--radius)] border p-3.5 text-left transition hover:-translate-y-px hover:border-[var(--accent)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${
        elegido ? "border-[var(--accent)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--bg-2)]"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${local ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "bg-[var(--accent-2)]/15 text-[var(--accent-2)]"}`}>
          {local ? "Colombia" : "Internacional"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          {elegido ? <><Check size={12} /> Elegido</> : <>Usar este tema <ArrowRight size={12} /></>}
        </span>
      </span>
      <span className="line-clamp-3 text-[0.95rem] font-semibold leading-snug">{i.title}</span>
      <span className="line-clamp-3 text-sm leading-snug text-[var(--fg-muted)]">{i.angle}</span>
      <span className="mt-auto flex items-start gap-1.5 border-t border-[var(--border)] pt-2 text-xs text-[var(--fg-muted)]" title={i.why}>
        <TrendingUp size={12} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
        <span className="line-clamp-2">{i.why}</span>
      </span>
    </button>
  );
}

/**
 * Pantalla «Ideas de la IA»: enfoque opcional, botón para pedirlas y, si ya hay, las ideas en un carrusel
 * (hasta 3 columnas y `filas` filas por página) con las fuentes consultadas en un globo.
 */
export function PantallaIdeas({
  foco, onFoco, onBuscar, buscando, ocupado, error, ideas, picked, onPick, filas,
}: {
  foco: string;
  onFoco: (v: string) => void;
  onBuscar: () => void;
  buscando: boolean;
  /** Otra tarea de la IA en curso (p. ej. redactar): se bloquea el botón. */
  ocupado: boolean;
  error: string;
  ideas: { ideas: TopicIdea[]; sources: { title: string; url: string }[] } | null;
  picked?: string | null;
  onPick: (i: TopicIdea) => void;
  filas: number;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={foco}
          onChange={(e) => onFoco(e.target.value)}
          placeholder="Opcional: enfoque (p. ej. leche, exportaciones, sanidad)"
          aria-label="Enfoque de las ideas"
          className={`${CAMPO} min-w-0 flex-1`}
        />
        <button type="button" onClick={onBuscar} disabled={buscando || ocupado} className="lx-btn">
          {buscando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {ideas ? "Buscar otros temas" : "Aconséjame temas"}
        </button>
      </div>
      {buscando && <p role="status" className="text-xs text-[var(--fg-muted)]">Buscando tendencias en internet… puede tardar hasta un minuto.</p>}
      {error && <p role="alert" className="text-sm text-[var(--danger,#b4442e)]">{error}</p>}
      {!ideas && !buscando && !error && (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong,var(--border))] px-4 py-6 text-center text-sm text-[var(--fg-muted)]">
          La IA busca en internet qué es tendencia en el sector, en Colombia y en el mundo, y te propone temas con sus fuentes.
        </p>
      )}
      {ideas && (
        <>
          <p className="text-xs text-[var(--fg-muted)]">
            <strong className="text-[var(--fg)]">{ideas.ideas.length} temas</strong> · pulsa uno para usarlo y luego «Proponer títulos y contextos».
          </p>
          <Carrusel
            etiqueta="Temas sugeridos"
            items={ideas.ideas}
            filas={filas}
            anchoMinimo={250}
            maxColumnas={3}
            render={(i) => <IdeaCard i={i} elegido={picked === i.title} onPick={onPick} />}
          />
          {ideas.sources.length > 0 && (
            // Las fuentes salen en un globo sobre el botón: abrirlas no mueve nada de la pantalla.
            <details className="relative text-xs">
              <summary className="cursor-pointer font-medium text-[var(--accent)]">Fuentes consultadas ({ideas.sources.length})</summary>
              <ul className="absolute bottom-full left-0 z-20 mb-2 flex w-[min(34rem,100%)] flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
                {ideas.sources.map((x) => (
                  <li key={x.url} className="truncate"><a href={x.url} target="_blank" rel="noopener noreferrer" className="lx-link">{x.title}</a></li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

// Filtro de resultados: todo o un tipo de noticia.
type Filtro = "todo" | NewsItem["type"];

/** Una noticia encontrada: medio, titular, resumen y las acciones «Escribir sobre esto», «Referenciar» y abrir la fuente. */
function NewsCard({ n, ref_, onTema, onRef }: { n: NewsItem; ref_: boolean; onTema: (n: NewsItem) => void; onRef: (n: NewsItem) => void }) {
  return (
    <div className={`flex w-full flex-1 gap-3 rounded-[var(--radius)] border bg-[var(--bg-2)] p-3 transition ${ref_ ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
      {n.videoId && (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
        <img src={`https://img.youtube.com/vi/${n.videoId}/mqdefault.jpg`} alt="" loading="lazy" className="hidden h-[3.75rem] w-[6.5rem] shrink-0 rounded-md object-cover sm:block" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex flex-wrap items-center gap-1.5 text-[0.7rem] text-[var(--fg-muted)]">
          {n.type === "video" && <span className="rounded-full bg-[#dc2626]/12 px-2 py-0.5 font-semibold text-[#b91c1c]">▶ Video</span>}
          {n.type === "oficial" && <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 font-semibold text-[var(--accent)]">Oficial</span>}
          <span className="font-medium text-[var(--fg)]">{n.outlet}</span>
          {n.date && <span>· {n.date}</span>}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[0.95rem] font-semibold leading-snug">{n.title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-[var(--fg-muted)]">{n.summary}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <button type="button" onClick={() => onTema(n)} className="lx-btn !px-3 !py-1.5 text-xs">Escribir sobre esto</button>
          <button
            type="button"
            onClick={() => onRef(n)}
            aria-pressed={ref_}
            title={n.type === "video" ? "Enlaza el video al final de la nota y lo incrusta" : "Enlaza esta fuente al final de la nota"}
            className="lx-btn lx-btn-ghost !px-3 !py-1.5 text-xs"
          >
            {ref_ ? <><Check size={12} /> Referenciada</> : "Referenciar"}
          </button>
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="lx-link ml-auto text-xs">{n.type === "video" ? "YouTube ↗" : "Fuente ↗"}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * Pantalla «Buscar noticias»: la consulta, las referencias ya elegidas, el filtro por tipo y los resultados en un
 * carrusel de hasta 2 columnas y `filas` filas por página.
 */
export function PantallaNoticias({
  consulta, onConsulta, onBuscar, buscando, ocupado, error, news, filtro, onFiltro, refs, isRef, onTema, onRef, filas,
}: {
  consulta: string;
  onConsulta: (v: string) => void;
  onBuscar: () => void;
  buscando: boolean;
  ocupado: boolean;
  error: string;
  news: NewsItem[] | null;
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
  refs: NewsItem[];
  isRef: (n: NewsItem) => boolean;
  onTema: (n: NewsItem) => void;
  onRef: (n: NewsItem) => void;
  filas: number;
}) {
  const etiquetas: Record<Filtro, string> = { todo: "Todo", noticia: "Noticias", video: "Videos", oficial: "Oficiales y redes" };
  const lista = (news ?? []).filter((n) => filtro === "todo" || n.type === filtro);
  const listo = consulta.trim().length >= 3;
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={consulta}
          onChange={(e) => onConsulta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (!buscando && listo) onBuscar();
          }}
          placeholder="Persona, empresa o tema a investigar (p. ej. «Joaquín Manjarrés»)"
          aria-label="Qué investigar"
          className={`${CAMPO} min-w-0 flex-1`}
        />
        <button type="button" onClick={onBuscar} disabled={buscando || ocupado || !listo} className="lx-btn">
          {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {news ? "Buscar de nuevo" : "Buscar noticias"}
        </button>
      </div>
      {buscando && <p role="status" className="text-xs text-[var(--fg-muted)]">Investigando en la web… puede tardar hasta un minuto.</p>}
      {error && <p role="alert" className="text-sm text-[var(--danger,#b4442e)]">{error}</p>}
      {!news && !buscando && !error && (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong,var(--border))] px-4 py-6 text-center text-sm text-[var(--fg-muted)]">
          Investiga en medios, YouTube y fuentes oficiales. Eliges cuáles <strong>referenciar</strong> (irán enlazadas al final de la nota; los videos, incrustados) o usar <strong>como tema</strong>.
        </p>
      )}
      {news && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-2)] p-1" role="group" aria-label="Filtrar resultados">
              {(["todo", "noticia", "video", "oficial"] as const).map((f) => {
                const cuantos = f === "todo" ? news.length : news.filter((n) => n.type === f).length;
                if (f !== "todo" && cuantos === 0) return null;
                return (
                  <button key={f} type="button" onClick={() => onFiltro(f)} aria-pressed={filtro === f}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${filtro === f ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                    {etiquetas[f]} <span className="opacity-70">{cuantos}</span>
                  </button>
                );
              })}
            </div>
            {refs.length > 0 && (
              <p className="min-w-0 flex-1 truncate text-xs text-[var(--fg-muted)]" title={refs.map((r) => r.outlet || r.title).join(" · ")}>
                <strong className="text-[var(--fg)]">Referencias elegidas ({refs.length}):</strong> {refs.map((r) => r.outlet || r.title).join(" · ")}
              </p>
            )}
          </div>
          <Carrusel
            // Al cambiar el filtro la lista es otra: se vuelve a la primera página.
            key={filtro}
            etiqueta="Noticias encontradas"
            items={lista}
            filas={filas}
            anchoMinimo={340}
            maxColumnas={2}
            render={(n) => <NewsCard n={n} ref_={isRef(n)} onTema={onTema} onRef={onRef} />}
          />
        </>
      )}
    </div>
  );
}

/** Pantalla «Enlaces»: las direcciones (una por línea) y el botón que las lee. */
export function PantallaEnlaces({
  texto, onTexto, onCargar, cargando, error,
}: {
  texto: string;
  onTexto: (v: string) => void;
  onCargar: () => void;
  cargando: boolean;
  error: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--fg-muted)]">Pega hasta 5 enlaces (uno por línea): la IA lee cada página y redacta con palabras propias, atribuyendo.</p>
      <textarea
        value={texto}
        onChange={(e) => onTexto(e.target.value)}
        rows={5}
        autoFocus
        aria-label="Enlaces a leer"
        placeholder={"https://…\nhttps://…"}
        className={`${CAMPO} resize-none !py-3`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onCargar} disabled={cargando || texto.trim().length < 8} className="lx-btn">
          {cargando ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
          {cargando ? "Leyendo…" : "Leer enlaces"}
        </button>
        {error && <p role="alert" className="min-w-0 flex-1 text-sm text-[var(--danger,#b4442e)]">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Pantalla «Voz o video»: a la izquierda quiénes intervienen (se pregunta ANTES de transcribir) y a la derecha la
 * subida del archivo, que se activa cuando hay al menos un nombre.
 */
export function PantallaEntrevista({
  personas, onPersonas, esEntrevista, onEsEntrevista, despues, onDespues, ocupado, fase, error, onArchivo, filasPersonas,
}: {
  personas: Participante[];
  onPersonas: (p: Participante[]) => void;
  esEntrevista: boolean;
  onEsEntrevista: (v: boolean) => void;
  despues: boolean;
  onDespues: (v: boolean) => void;
  ocupado: boolean;
  fase: string;
  error: string;
  onArchivo: (f: File) => void;
  filasPersonas: number;
}) {
  const listo = participantesListos(personas, despues);
  return (
    <div className="grid min-h-0 gap-4 @2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @2xl:items-start">
      <ParticipantesForm
        personas={personas}
        onPersonas={onPersonas}
        esEntrevista={esEntrevista}
        onEsEntrevista={onEsEntrevista}
        despues={despues}
        onDespues={onDespues}
        disabled={ocupado}
        filas={filasPersonas}
      />
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-dashed border-[var(--border-strong,var(--border))] p-4">
        <p className="text-sm text-[var(--fg-muted)]">
          Sube una nota de voz, un audio o un <strong>video</strong> y la IA transcribe lo que se oye. En un video, el navegador saca solo el audio: el video no se sube. Podrás corregir el texto antes de redactar.
        </p>
        <label className={`lx-btn w-fit cursor-pointer ${ocupado || !listo ? "pointer-events-none opacity-60" : ""}`}>
          {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
          {ocupado ? fase || "Procesando…" : "Subir audio o video"}
          <input
            type="file"
            accept="audio/*,video/*,.mp3,.m4a,.wav,.ogg,.opus,.webm,.aac,.flac,.mp4,.m4v,.mov,.mpeg,.mpg,.avi,.wmv,.3gp"
            disabled={ocupado || !listo}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onArchivo(f);
            }}
          />
        </label>
        {!listo && <p className="text-xs text-[var(--fg-muted)]">Escribe al menos un nombre para activar la subida.</p>}
        <p className="text-xs text-[var(--fg-muted)]">Audio (MP3, M4A, WAV, OGG…) hasta 20 MB · video (MP4, MOV, WEBM…) de hasta unos 800 MB y 20 min de grabación. Puede tardar un par de minutos.</p>
        {error && <p role="alert" className="text-sm text-[var(--danger,#b4442e)]">{error}</p>}
      </div>
    </div>
  );
}
