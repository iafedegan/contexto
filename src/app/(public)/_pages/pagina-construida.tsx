import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { PaginaVista } from "@/components/pagina-vista";
import { getSiteTheme } from "@/lib/site-theme";
import { getPaginaPublicada, notasDeLaPagina, type PaginaPublica } from "@/lib/paginas";
import { siteUrl } from "@/lib/utils";
import { SLUG_INICIO_SITIO } from "@/lib/paginas-bloques";

/**
 * Las páginas armadas en el panel con el constructor. Se sirven en `/{pagina}` (catch-all) o `/{seccion}/{pagina}` (la ruta de las
 * notas con su dirección original, que la busca cuando ninguna nota tiene esa dirección).
 */

/** La página publicada de una dirección (uno o dos tramos), o null. */
export async function paginaDeLaRuta(partes: string[]): Promise<PaginaPublica | null> {
  // La portada del inicio («inicio») solo se ve arriba de «/», no como página suelta.
  if (partes.length === 1 && partes[0] === SLUG_INICIO_SITIO) return null;
  if (partes.length < 1 || partes.length > 2 || !partes.every((t) => /^[a-z0-9-]{1,80}$/.test(t))) return null;
  return getPaginaPublicada(partes.join("/")).catch(() => null);
}

export function metadataDePagina(p: PaginaPublica): Metadata {
  return { title: p.titulo, description: p.descripcion ?? undefined, alternates: { canonical: siteUrl(`/${p.slug}`) } };
}

export async function PaginaConstruida({ p }: { p: PaginaPublica }) {
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
