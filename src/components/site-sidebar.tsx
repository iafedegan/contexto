import Link from "next/link";
import { FacebookIcon, InstagramIcon, LinkedinIcon, YoutubeIcon } from "@/components/social-icons";
import { AdsBanner } from "@/components/ads-banner";
import { NewsletterForm } from "@/components/newsletter-form";
import { PushToggle } from "@/components/push-toggle";
import { getMostReadArticles } from "@/lib/content";
import { localePath, t, type Locale } from "@/lib/i18n";

/**
 * Barra lateral del §8: más leídas, publicidad, boletín y redes.
 *
 * El orden no es casual: primero lo editorial, después lo comercial y al final
 * la relación con la audiencia. La zona de 300 × 600 va `sticky` como pide el
 * §9.1, y la de 300 × 250 queda arriba, above the fold.
 */
/** Clave pública VAPID: es pública por definición, va al cliente sin problema. */
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// Barra lateral: notas más leídas, anuncios, boletín, avisos y redes sociales.
export async function SiteSidebar({ locale }: { locale: Locale }) {
  const masLeidas = await getMostReadArticles(5).catch(() => []);

  return (
    <aside className="flex flex-col gap-8" aria-label={t(locale, "sidebar.mostRead")}>
      {masLeidas.length > 0 && (
        <section>
          <h2 className="lx-kicker border-b border-[var(--border)] pb-2 text-[var(--accent)]">
            {t(locale, "sidebar.mostRead")}
          </h2>
          <ol className="mt-4 flex flex-col">
            {masLeidas.map((a, i) => (
              <li key={a.slug} className="border-b border-[var(--border)] last:border-0">
                <Link
                  href={localePath(locale, `/articulo/${a.slug}`)}
                  className="group flex items-baseline gap-3 py-3"
                >
                  <span className="lx-display w-7 shrink-0 text-lg leading-none text-[var(--accent-2)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="lx-display flex-1 text-[0.95rem] leading-snug transition-colors group-hover:text-[var(--accent)]">
                    {a.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 300 × 250, above the fold. */}
      <AdsBanner zone="sidebar_top" />

      <div className="flex flex-col gap-3">
        <NewsletterForm locale={locale} />
        {/* Avisos de última hora (FM-01). El permiso se pide al pulsar, nunca
            al cargar la página. */}
        <PushToggle locale={locale} publicKey={VAPID_PUBLIC} />
      </div>

      <section>
        <h2 className="lx-kicker border-b border-[var(--border)] pb-2 text-[var(--accent)]">
          {t(locale, "sidebar.follow")}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {REDES.map((r) => (
            <li key={r.nombre}>
              <a
                href={r.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={r.nombre}
                title={r.nombre}
                // 44 × 44 px: área táctil mínima del D-09.
                className="grid size-11 place-items-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <r.Icono size={17} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <AdsBanner zone="sidebar_bottom" />

      {/* 300 × 600 fija durante el scroll (§9.1). */}
      <AdsBanner zone="sidebar_sticky" className="sticky top-24" />
    </aside>
  );
}

// Redes sociales del medio.
const REDES = [
  { nombre: "Facebook", href: "https://www.facebook.com/contextoganadero", Icono: FacebookIcon },
  { nombre: "Instagram", href: "https://www.instagram.com/contextoganadero", Icono: InstagramIcon },
  { nombre: "YouTube", href: "https://www.youtube.com/@contextoganadero", Icono: YoutubeIcon },
  { nombre: "LinkedIn", href: "https://www.linkedin.com/company/fedegan", Icono: LinkedinIcon },
];
