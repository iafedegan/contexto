/**
 * Una sola plantilla para las nueve páginas del menú secundario (§2.2).
 * El contenido viene de `src/content/institucional.ts`; aquí solo se decide
 * cómo se ve, y se inserta el formulario cuando el documento lo pide.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { ContactForm } from "@/components/contact-form";
import { breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { siteUrl } from "@/lib/utils";
import { documento, type Bloque } from "@/content/institucional";
import { localePath, type Locale } from "@/lib/i18n";
import Link from "next/link";

// Crea la función de metadatos de una página institucional según su documento e idioma.
export function makeMetadata(slug: string, locale: Locale) {
  return function generateMetadata(): Metadata {
    const doc = documento(slug);
    if (!doc) return { title: "No encontrado", robots: { index: false } };
    return {
      title: doc.titulo[locale],
      description: doc.descripcion[locale],
      alternates: { canonical: siteUrl(`/${slug}`) },
      ...(locale === "en" ? { robots: { index: false, follow: true } } : {}),
    };
  };
}

// Crea la página de un documento institucional (política, términos, quiénes somos…).
export function makePage(slug: string, locale: Locale) {
  return async function Page() {
    const doc = documento(slug);
    if (!doc) notFound();

    const site = await getSiteTheme();
    const secciones = doc.secciones[locale];

    return (
      <SiteShell theme={site.theme} style={site.style} locale={locale} variant="institucional">
        <JsonLd
          data={breadcrumbJsonLd([
            { name: locale === "es" ? "Inicio" : "Home", path: "/" },
            { name: doc.titulo[locale], path: `/${slug}` },
          ])}
        />

        <article>
          <nav className="lx-ui mb-8 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--fg-muted)]">
            <Link href={localePath(locale, "/")} className="lx-link">
              {locale === "es" ? "Inicio" : "Home"}
            </Link>
            <span aria-hidden className="text-[var(--accent-2)]">
              /
            </span>
            <span className="text-[var(--accent)]">{doc.titulo[locale]}</span>
          </nav>

          <header>
            <h1 className="lx-display text-4xl leading-tight tracking-tight md:text-5xl">
              {doc.titulo[locale]}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-[var(--fg-muted)]">{doc.bajada[locale]}</p>
            <hr className="lx-rule my-10" />
          </header>

          {/* Índice: en documentos legales largos ahorra scroll y da contexto. */}
          {secciones.length > 2 && (
            <nav aria-label={locale === "es" ? "Contenido" : "Contents"} className="lx-card mb-12 p-6">
              <ol className="lx-ui flex flex-col gap-2 text-sm">
                {secciones.map((s, i) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="text-[var(--accent-2)]">{String(i + 1).padStart(2, "0")}</span>
                    <a href={`#${s.id}`} className="lx-link">
                      {s.titulo}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="flex flex-col gap-12">
            {secciones.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="lx-display text-2xl leading-snug">{s.titulo}</h2>
                <div className="mt-4 flex flex-col gap-4">
                  {s.bloques.map((b, i) => (
                    <BloqueVista key={i} bloque={b} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {doc.formulario && (
            <section className="mt-16">
              <ContactForm kind={doc.formulario === "comercial" ? "comercial" : "contacto"} locale={locale} />
            </section>
          )}
        </article>
      </SiteShell>
    );
  };
}

// Pinta un bloque de un documento institucional (párrafo, lista, título…).
function BloqueVista({ bloque }: { bloque: Bloque }) {
  if (bloque.tipo === "parrafo") {
    return <p className="text-[1.02rem] leading-relaxed">{bloque.texto}</p>;
  }
  if (bloque.tipo === "lista") {
    return (
      <ul className="flex flex-col gap-2.5">
        {bloque.items.map((it, i) => (
          <li key={i} className="flex gap-3 leading-relaxed">
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rotate-45 bg-[var(--accent)]" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="lx-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
      {bloque.items.map((d) => (
        <div key={d.etiqueta}>
          <dt className="lx-kicker text-[var(--fg-muted)]">{d.etiqueta}</dt>
          <dd className="mt-1 text-[0.98rem]">
            {d.href ? (
              <a href={d.href} className="lx-link">
                {d.valor}
              </a>
            ) : (
              d.valor
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
