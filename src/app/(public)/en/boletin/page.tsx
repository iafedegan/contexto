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
  title: "Free newsletter",
  description: "Subscribe for free to the newsletter: the most important cattle-sector news, straight to your inbox.",
};

const POINTS = [
  { icon: Newspaper, t: "The essentials, every edition", d: "A curated summary from the newsroom, no filler." },
  { icon: Mail, t: "At your pace", d: "It lands when we publish, without flooding your inbox." },
  { icon: ShieldCheck, t: "One-click unsubscribe", d: "Leave whenever you want from any newsletter email." },
];

/** English mirror of /boletin. Same form and backend, different copy. */
export default async function NewsletterPage() {
  const [site, identity, [{ n }]] = await Promise.all([
    getSiteTheme(),
    getSiteIdentity(),
    db
      .select({ n: sql<number>`count(*) filter (where confirmed and unsubscribed_at is null)::int` })
      .from(newsletterSubscribers),
  ]);

  return (
    <SiteShell theme={site.theme} style={site.style} locale="en" variant="institucional">
      <div className="mx-auto grid max-w-4xl gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="lx-kicker text-[var(--accent)]">Free newsletter</p>
          <h1 className="lx-display mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
            The most important cattle-sector news, straight to your inbox
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-[var(--fg-muted)]">
            Subscribe for free to the {identity.name} newsletter
            {n > 0 ? `. Today ${n.toLocaleString("en-US")} readers get it.` : "."}
          </p>
          <ul className="mt-8 flex flex-col gap-5">
            {POINTS.map(({ icon: Icon, t, d }) => (
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
        <NewsletterForm locale="en" />
      </div>
    </SiteShell>
  );
}
