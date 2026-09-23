"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ArticleListItem } from "@/lib/content";
import { formatDate } from "@/lib/utils";
import { homeStyleImageScale, homeStyleTitleCss } from "@/lib/home-style";
import { CoverArt } from "@/components/cover-art";
import { DEFAULT_LOCALE, INTL_LOCALE, categoryLabel, localePath, type Locale } from "@/lib/i18n";

const AUTOPLAY_MS = 6000;

/**
 * Hero de "Revista": a sangre completa (rompe el ancho de `.shell` hasta el
 * borde del viewport), efecto Ken Burns (zoom lento continuo) en la foto
 * activa, y el titular vive en una banda sólida que se monta sobre el borde
 * inferior de la imagen — no texto-sobre-foto como Vanguardia.
 */
export function HeroCarousel({
  locale = DEFAULT_LOCALE,
  items,
  interactive = true,
}: {
  locale?: Locale;
  items: ArticleListItem[];
  /** false = dentro del editor de portada: mismo look, sin navegar ni autoplay. */
  interactive?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!interactive || count <= 1 || paused) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count, paused, interactive, index]);

  if (count === 0) return null;
  const go = (i: number) => setIndex(((i % count) + count) % count);
  const active = items[index];
  const Wrapper: React.ElementType = interactive ? Link : "div";

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Ruptura a sangre completa (ver `.lx-fullbleed`): la anula el contenedor
          `.lx-bleed-off` cuando la portada se pinta junto a la barra lateral. */}
      <div className="lx-fullbleed">
        <div
          // Alto en vh (con techo) en vez de aspect-ratio: con la cabecera
          // fija arriba, una imagen que ocupe casi toda la altura del
          // viewport empuja el titular fuera de la pantalla inicial. Así el
          // titular siempre asoma sin necesidad de hacer scroll.
          className="relative h-[34vh] min-h-[220px] overflow-hidden bg-black sm:h-[42vh] lg:h-[46vh] lg:max-h-[460px]"
          // "Tamaño de imagen" del panel: encoge la altura del hero (no su
          // ancho, que es a sangre por diseño) conservando la composición.
          style={
            homeStyleImageScale(active.homeStyle) === 100
              ? undefined
              : { height: `calc(46vh * ${homeStyleImageScale(active.homeStyle) / 100})` }
          }
          role="region"
          aria-roledescription="carrusel"
          aria-label="Notas destacadas"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") go(index - 1);
            if (e.key === "ArrowRight") go(index + 1);
          }}
        >
          <AnimatePresence mode="sync">
            <motion.div
              key={active.slug}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            >
              {!active.coverImageUrl && (
                <CoverArt
                  seed={active.slug}
                  label={active.categoryName ?? active.title}
                  className="absolute inset-0 text-[10rem]"
                />
              )}
              {active.coverImageUrl && (
                <motion.div
                  className="absolute inset-0"
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.1 }}
                  transition={{ duration: AUTOPLAY_MS / 1000 + 1, ease: "linear" }}
                >
                  <Image
                    src={active.coverImageUrl}
                    alt={active.coverImageAlt ?? active.title}
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="object-cover"
                  />
                </motion.div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/25" />
            </motion.div>
          </AnimatePresence>

          {active.categoryName && (
            <span className="absolute left-5 top-5 z-10 border border-[var(--brand)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand)] backdrop-blur-sm sm:left-9 sm:top-8">
              {categoryLabel(locale, active.categorySlug, active.categoryName ?? "")}
            </span>
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => go(index - 1)}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 p-2 text-white/70 transition hover:text-white sm:left-6"
              >
                <ChevronLeft size={28} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => go(index + 1)}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 p-2 text-white/70 transition hover:text-white sm:right-6"
              >
                <ChevronRight size={28} strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>

        {/* Banda de titular: sólida, montada sobre el borde inferior de la
            foto. El ancho vuelve a alinearse con `.shell` para que el texto
            siga siendo legible aunque la imagen sea a sangre completa. */}
        <div className="relative z-10 -mt-20 sm:-mt-28">
          <div className="shell">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-3xl bg-[var(--paper-2)] p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.4)] sm:p-8"
              >
                <Wrapper {...(interactive ? { href: localePath(locale, `/articulo/${active.slug}`) } : {})} className="group block">
                  {/* El estilo fijado en /panel/portada manda sobre el tamaño
                      base del hero (el titular más grande de la portada). */}
                  <h2
                    className="headline text-[1.4rem] leading-[1.08] group-hover:text-[var(--brand-ink)] sm:text-[2.3rem]"
                    style={homeStyleTitleCss(active.homeStyle, 37, 1.08)}
                  >
                    {active.title}
                  </h2>
                  {active.homeStyle?.size !== "sm" && (
                    <p className="mt-2 hidden max-w-xl font-[family-name:var(--font-serif)] text-[1rem] text-[var(--ink-soft)] sm:block">
                      {active.excerpt}
                    </p>
                  )}
                  <p className="meta mt-3">
                    {active.authorName ? `${active.authorName} · ` : ""}
                    {active.publishedAt ? formatDate(active.publishedAt, INTL_LOCALE[locale]) : ""}
                  </p>
                </Wrapper>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {count > 1 && (
          <div className="shell mt-4 flex gap-2">
            {items.map((a, i) => (
              <button
                key={a.slug}
                type="button"
                aria-label={`Ir a la nota ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className="relative h-[3px] flex-1 overflow-hidden bg-[var(--rule)]"
              >
                {i === index && (
                  <motion.span
                    key={`${active.slug}-progress`}
                    className="absolute inset-y-0 left-0 bg-[var(--brand)]"
                    initial={{ width: "0%" }}
                    animate={{ width: paused || !interactive ? "0%" : "100%" }}
                    transition={{ duration: AUTOPLAY_MS / 1000, ease: "linear" }}
                  />
                )}
                {i < index && <span className="absolute inset-0 bg-[var(--brand)]" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
