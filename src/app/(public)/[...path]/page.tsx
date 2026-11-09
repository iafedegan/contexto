import type { Metadata } from "next";
import { resolverRutaAntigua } from "../_pages/ruta-antigua";
import { SiteShell } from "@/components/site-shell";
import { PaginaVista } from "@/components/pagina-vista";
import { getSiteTheme } from "@/lib/site-theme";
import { getPaginaPublicada, notasDeLaPagina } from "@/lib/paginas";
import { siteUrl } from "@/lib/utils";

/**
 * Catch-all de baja prioridad. Primero, las páginas armadas en el panel con el constructor (`/{slug}`); si no hay ninguna,
 * resuelve las redirecciones 301 uno-a-uno de la tabla `redirects` (las de taxonomía completa las hace el proxy, src/proxy.ts)
 * o responde 404. La lógica de las rutas antiguas está en `_pages/ruta-antigua.tsx`.
 *
 * NOTA: los artículos del archivo histórico viven en `articles` (con su dirección original en `legacy_path`) y se sirven en `[seccion]/[slug]`.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ path: string[] }> };

async function paginaDe(path: string[]) {
  return path.length === 1 && /^[a-z0-9-]{1,80}$/.test(path[0]) ? getPaginaPublicada(path[0]) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await paginaDe((await params).path);
  if (!p) return {};
  return { title: p.titulo, description: p.descripcion ?? undefined, alternates: { canonical: siteUrl(`/${p.slug}`) } };
}

export default async function CatchAll({ params }: Props) {
  const { path } = await params;
  const p = await paginaDe(path);
  if (!p) return resolverRutaAntigua(path);
  const [site, notas] = await Promise.all([getSiteTheme(), notasDeLaPagina(p.contenido)]);
  return (
    <SiteShell theme={site.theme} style={site.style} variant="institucional">
      <article className="flex flex-col gap-10">
        <header>
          <h1 className="lx-display text-4xl leading-tight tracking-tight md:text-5xl">{p.titulo}</h1>
          {p.descripcion && <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[var(--fg-muted)]">{p.descripcion}</p>}
        </header>
        <PaginaVista contenido={p.contenido} notas={notas} />
      </article>
    </SiteShell>
  );
}
