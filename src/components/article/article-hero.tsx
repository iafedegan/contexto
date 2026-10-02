/**
 * Apertura de la nota con la estructura de CADA plantilla. Recibe las piezas
 * ya construidas (miga, título, entradilla, firma, acciones, portada) y las
 * compone a su manera: diario, revista a sangre, ficha técnica, bento u
 * obsidiana. El cuerpo, las etiquetas y los relacionados son comunes.
 */
type Parts = {
  theme: string;
  breadcrumb: React.ReactNode;
  live?: React.ReactNode;
  title: string;
  excerpt: string;
  byline: React.ReactNode;
  actions: React.ReactNode;
  cover: React.ReactNode;
  kicker?: string;
};

export function ArticleHero(p: Parts) {
  switch (p.theme) {
    case "clasico":
      // Diario: todo centrado entre filetes, titular grande con remate serif.
      return (
        <header className="text-center">
          <div className="flex justify-center">{p.breadcrumb}</div>
          {p.live && <div className="mt-4 flex justify-center">{p.live}</div>}
          <div className="mx-auto mt-6 max-w-5xl border-y-4 border-double border-[var(--fg)] py-8">
            {p.kicker && <p className="lx-kicker text-[var(--accent)]">{p.kicker}</p>}
            <h1 className="break-words lx-display mt-3 text-[2.2rem] font-black leading-[1.02] tracking-tight md:text-[4.2rem]">{p.title}</h1>
          </div>
          <p className="mx-auto mt-6 max-w-3xl font-serif text-xl italic leading-relaxed text-[var(--fg-muted)]">{p.excerpt}</p>
          <div className="mt-6 flex justify-center">{p.byline}</div>
          <div className="mt-6 flex justify-center">{p.actions}</div>
          <div className="mt-10 border-t border-[var(--border)] pt-6">{p.cover}</div>
        </header>
      );
    case "revista":
      // Revista: la foto manda. Portada a sangre con el titular encima. Foto,
      // degradado y texto comparten UNA celda de cuadrícula: la caja mide lo
      // que mida lo mayor de los dos. Con un lienzo 21:9 fijo y el titular
      // anclado abajo, un titular de 4 líneas en un teléfono se salía por
      // arriba (recortado por el overflow y pisando la miga).
      return (
        <header>
          {p.breadcrumb}
          <div className="mt-6 grid overflow-hidden rounded-[var(--radius-lg)] bg-[#0b0d10] [&>*]:col-start-1 [&>*]:row-start-1">
            <div className="[&_figure]:!mt-0 [&_figure]:h-full [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:aspect-[4/3] sm:[&_figure]:aspect-[16/9] md:[&_figure]:aspect-[21/9]">{p.cover}</div>
            <div aria-hidden className="bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <div className="relative self-end p-5 text-white sm:p-8 md:p-12">
              {p.live}
              {p.kicker && <p className="lx-kicker text-[#e8cf9a]">{p.kicker}</p>}
              <h1 className="break-words lx-display mt-3 max-w-5xl text-[2rem] font-light italic leading-[1.02] sm:text-[2.6rem] md:text-[3.4rem] lg:text-[4.4rem]">{p.title}</h1>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[2fr_1fr]">
            <p className="text-2xl leading-relaxed text-[var(--fg-muted)]">{p.excerpt}</p>
            <div className="flex flex-col gap-5 border-l border-[var(--border-strong)] pl-6">
              {p.byline}
              {p.actions}
            </div>
          </div>
        </header>
      );
    case "compacto":
      // Compacto: ficha técnica. Titular a la izquierda, datos en columna.
      return (
        <header>
          {p.breadcrumb}
          <div className="mt-4 grid grid-cols-1 gap-6 border-b-2 border-[var(--fg)] pb-6 lg:grid-cols-[1fr_20rem]">
            <div>
              {p.live}
              {p.kicker && (
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">{p.kicker}</p>
              )}
              <h1 className="break-words mt-2 text-[2rem] font-extrabold leading-[1.08] tracking-tight md:text-[3rem]">{p.title}</h1>
              <p className="mt-4 text-lg leading-relaxed text-[var(--fg-muted)]">{p.excerpt}</p>
            </div>
            <aside className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm">
              {p.byline}
              {p.actions}
            </aside>
          </div>
          <div className="mt-6">{p.cover}</div>
        </header>
      );
    case "vanguardia":
      // Vanguardia: tarjeta redondeada con orbes y titular en degradado.
      return (
        <header>
          <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--bg-2)] p-6 md:p-12">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-96 rounded-full bg-[var(--accent-2)] opacity-25 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-28 left-10 size-80 rounded-full bg-[var(--accent)] opacity-20 blur-3xl" />
            <div className="relative grid grid-cols-1 items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
              <div>
                {p.breadcrumb}
                {p.live && <div className="mt-4">{p.live}</div>}
                <h1 className="break-words mt-6 bg-gradient-to-r from-[var(--fg)] via-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-[2.2rem] font-black leading-[1.02] tracking-tight text-transparent md:text-[3.8rem]">
                  {p.title}
                </h1>
                <p className="mt-5 text-lg text-[var(--fg-muted)]">{p.excerpt}</p>
                <div className="mt-6">{p.byline}</div>
                <div className="mt-6">{p.actions}</div>
              </div>
              <div className="[&_figure]:!mt-0 [&_figure]:rounded-[1.5rem]">{p.cover}</div>
            </div>
          </div>
        </header>
      );
    default:
      // Esmeralda: apertura clásica sobre obsidiana, filete dorado.
      return (
        <header>
          {p.breadcrumb}
          {p.live && <div className="mt-6">{p.live}</div>}
          <h1 className="break-words lx-display mt-6 text-[2rem] font-semibold leading-[1.06] tracking-tight sm:text-[2.4rem] md:text-[3.4rem]">
            {p.title}
          </h1>
          <p className="mt-5 text-xl leading-relaxed text-[var(--fg-muted)] md:text-[1.35rem]">{p.excerpt}</p>
          <hr className="lx-rule my-8" />
          {p.byline}
          <div className="mt-8">{p.actions}</div>
          {p.cover}
        </header>
      );
  }
}

/** Cuerpo de la nota: misma anchura, tipografía propia de cada plantilla. */
export const ARTICLE_BODY_CLASS: Record<string, string> = {
  // Diario: dos columnas de texto en escritorio, como en papel.
  clasico: "prose prose-drop mt-12 !max-w-none font-serif lg:columns-2 lg:gap-12 [&>*]:break-inside-avoid-column",
  revista: "prose prose-drop mt-12 !max-w-none text-[1.2rem] leading-[1.85]",
  compacto: "prose mt-8 !max-w-none text-[1.02rem]",
  vanguardia: "prose mt-12 !max-w-none",
};
