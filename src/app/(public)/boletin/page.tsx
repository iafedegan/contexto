import type { Metadata } from "next";
import { Mail, Newspaper, ShieldCheck } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { SiteShell } from "@/components/site-shell";
import { NewsletterForm } from "@/components/newsletter-form";
import { getSiteTheme } from "@/lib/site-theme";
import { getSiteIdentity } from "@/lib/site-identity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Boletín gratuito",
  description: "Suscríbete gratis al boletín: lo más importante del sector ganadero, directo a tu correo.",
};

const PUNTOS = [
  { icon: Newspaper, t: "Lo esencial de cada edición", d: "Un resumen curado por la redacción, sin relleno ni ruido." },
  { icon: Mail, t: "A tu ritmo", d: "Llega a tu correo cuando publicamos, sin saturar tu bandeja." },
  { icon: ShieldCheck, t: "Baja en un clic", d: "Puedes darte de baja cuando quieras desde cualquier boletín." },
];

/** Página propia de alta al boletín (además de la barra lateral y el pie de portada). */
export default async function BoletinPage() {
  const [site, identity, [{ n }]] = await Promise.all([
    getSiteTheme(),
    getSiteIdentity(),
    db
      .select({ n: sql<number>`count(*) filter (where confirmed and unsubscribed_at is null)::int` })
      .from(newsletterSubscribers),
  ]);

  return (
    <SiteShell theme={site.theme} style={site.style} locale="es" variant="institucional">
      <div className="mx-auto grid grid-cols-1 max-w-4xl gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Boletín gratuito</p>
          <h1 className="lx-display mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
            Lo más importante del sector ganadero, directo a tu correo
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[var(--fg-muted)]">
            Suscríbete gratis al boletín de {identity.name}
            {n > 0 ? `. Hoy nos leen ${n.toLocaleString("es-CO")} suscriptores.` : "."}
          </p>
          <ul className="mt-8 flex flex-col gap-5">
            {PUNTOS.map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
                  <Icon size={16} />
                </span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-sm text-[var(--fg-muted)]">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <NewsletterForm locale="es" />
      </div>
    </SiteShell>
  );
}
