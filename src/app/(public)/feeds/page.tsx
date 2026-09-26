import Link from "next/link";
import type { Metadata } from "next";
import { Rss } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { getTopLevelCategories } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

// Se genera en cada visita y nunca en el build: prerenderizar aquí consultaba
// Supabase desde el servidor de build y el despliegue caía por timeout.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suscríbete por RSS",
  description: "Recibe las noticias de CONtexto Ganadero en tu lector RSS: el feed general y uno por cada sección.",
  alternates: { canonical: siteUrl("/feeds"), types: { "application/rss+xml": siteUrl("/feed.xml") } },
};

/** Página de suscripción: qué es RSS, cómo usarlo y la dirección de cada feed. */
export default async function RssPage() {
  const [site, sections] = await Promise.all([getSiteTheme(), getTopLevelCategories().catch(() => [])]);
  const feeds = [
    { name: "Todas las noticias", url: siteUrl("/feed.xml") },
    ...sections.map((c) => ({ name: c.name, url: siteUrl(`/categoria/${c.slug}/feed.xml`) })),
  ];

  return (
    <SiteShell theme={site.theme} style={site.style} locale="es" variant="institucional">
      <nav className="lx-ui mb-8 flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--fg-muted)]">
        <Link href="/" className="lx-link">Inicio</Link>
        <span aria-hidden className="text-[var(--accent-2)]">/</span>
        <span className="text-[var(--accent)]">RSS</span>
      </nav>

      <h1 className="lx-display flex items-center gap-3 text-4xl leading-tight tracking-tight md:text-5xl">
        <Rss className="text-[var(--accent)]" size={36} /> Suscríbete por RSS
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--fg-muted)]">
        RSS te permite recibir cada nota nueva de CONtexto Ganadero en tu lector de noticias
        (Feedly, Inoreader, NetNewsWire, Outlook…) sin entrar a la web ni depender de redes
        sociales. Copia la dirección de la sección que te interese y pégala en tu lector.
      </p>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {feeds.map((f) => (
          <li key={f.url} className="lx-card flex flex-col gap-2 p-5">
            <span className="flex items-center gap-2 font-semibold">
              <Rss size={16} className="text-[var(--accent)]" /> {f.name}
            </span>
            <code className="lx-mono break-all text-xs text-[var(--fg-muted)]">{f.url}</code>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              <a href={f.url} className="lx-link">Abrir feed</a>
              <a
                href={`https://feedly.com/i/subscription/feed/${encodeURIComponent(f.url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="lx-link"
              >
                Añadir a Feedly ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
    </SiteShell>
  );
}
