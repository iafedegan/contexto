/** Página de la transmisión en vivo (se enciende en /panel/en-vivo); con la transmisión apagada vuelve a la portada. */
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { LiveBadge } from "@/components/live-badge";
import { getSiteTheme } from "@/lib/site-theme";
import { getEnVivo } from "@/lib/en-vivo";
import { getRecentArticles } from "@/lib/content";
import { rutaDeNota } from "@/lib/ruta-nota";
import { EnVivoPlayer } from "@/components/en-vivo-player";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { siteUrl } from "@/lib/utils";

// Se genera en cada visita: depende de si hay transmisión encendida en ese momento.
export const dynamic = "force-dynamic";

// Título y datos para buscadores; no se indexa cuando no hay transmisión.
export async function generateMetadata(): Promise<Metadata> {
  const en = await getEnVivo();
  return {
    title: en.activo ? `En vivo: ${en.titulo || "transmisión"}` : "En vivo",
    alternates: { canonical: siteUrl("/en-vivo") },
    robots: en.activo ? undefined : { index: false, follow: true },
  };
}

// Reproductor grande de YouTube con el título, y enlaces para verlo en YouTube o volver a la portada.
export default async function EnVivoPage() {
  const [en, site, recientes] = await Promise.all([getEnVivo(), getSiteTheme(), getRecentArticles(5).catch(() => [])]);
  if (!en.activo) redirect("/");
  const titulo = en.titulo || "Transmisión en vivo";

  return (
    <SiteShell theme={site.theme} style={site.style} locale={DEFAULT_LOCALE} variant="institucional">
      <article className="mx-auto max-w-6xl">
        <nav className="lx-ui mb-6 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--fg-muted)]">
          <Link href="/" className="lx-link">
            Inicio
          </Link>
          <span aria-hidden className="text-[var(--accent-2)]">
            /
          </span>
          <span className="text-[var(--accent)]">En vivo</span>
        </nav>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <LiveBadge locale={DEFAULT_LOCALE} />
          <h1 className="lx-display min-w-0 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{titulo}</h1>
        </div>

        <EnVivoPlayer videoId={en.videoId} titulo={titulo} url={siteUrl("/en-vivo")}>
          {recientes.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="lx-kicker text-[var(--accent)]">Mientras tanto, lee</h2>
              <ul className="flex flex-col divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {recientes.map((n) => (
                  <li key={n.slug}>
                    <Link href={rutaDeNota(n)} className="lx-display block py-2.5 text-[0.95rem] leading-snug hover:text-[var(--accent)]">
                      {n.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </EnVivoPlayer>

        <div className="lx-ui mt-5 flex flex-wrap items-center gap-4 text-sm">
          <a
            href={`https://www.youtube.com/watch?v=${en.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 py-2 font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-2)]"
          >
            <ExternalLink size={15} aria-hidden /> Ver en YouTube
          </a>
          <Link href="/" className="lx-link text-[var(--fg-muted)]">
            ← Volver a la portada
          </Link>
        </div>
      </article>
    </SiteShell>
  );
}
