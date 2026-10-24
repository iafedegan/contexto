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
import { SectionHeader } from "@/components/section/section-layout";
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
    <SiteShell theme={site.theme} style={site.style} locale={DEFAULT_LOCALE} variant="seccion">
      <SectionHeader
        theme={site.parts.body}
        kicker="Transmisión"
        title={titulo}
        description="Sigue la transmisión en directo de CONtexto Ganadero."
        breadcrumb={
          /* Miga solo para lectores de pantalla, como en las secciones. */
          <nav aria-label="breadcrumb" className="sr-only">
            <Link href="/">Inicio</Link> / En vivo
          </nav>
        }
        chips={
          <>
            <LiveBadge locale={DEFAULT_LOCALE} />
            <a
              href={`https://www.youtube.com/watch?v=${en.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="lx-chip inline-flex items-center gap-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <ExternalLink size={12} aria-hidden /> Ver en YouTube
            </a>
            <Link href="/" className="lx-chip hover:border-[var(--accent)] hover:text-[var(--accent)]">
              ← Portada
            </Link>
          </>
        }
      />

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
    </SiteShell>
  );
}
