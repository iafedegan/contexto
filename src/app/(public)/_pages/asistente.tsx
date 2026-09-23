import { t, type Locale } from "@/lib/i18n";
import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant-chat";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";

/** Asistente — plantilla «Obsidiana & Aurora». */
export const metadata: Metadata = {
  title: "Asistente",
  description:
    "Asistente conversacional de CONtexto Ganadero: responde con base en el archivo completo del medio y cita cada fuente.",
};

async function AssistantPage({ locale }: { locale: Locale }) {
  const site = await getSiteTheme();
  return (
    <SiteShell theme={site.theme} style={site.style} locale={locale} variant="asistente">
      <header className="pt-10 text-center">
        <span className="lx-chip mx-auto border-[var(--border-strong)] text-[var(--accent)]">
          {t(locale, "assistant.badge")}
        </span>
        <h1 className="lx-display mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {t(locale, "assistant.title")}{" "}
          <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">
            CONtexto Ganadero
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[var(--fg-muted)]">
          {t(locale, "assistant.blurb")}
        </p>
      </header>

      <div className="mt-12">
        <AssistantChat />
      </div>
    </SiteShell>
  );
}


/** Fábrica: la misma página en cualquier idioma de interfaz. */
export function makePage(locale: Locale) {
  return function Page(props: Parameters<typeof AssistantPage>[0]) {
    return AssistantPage({ ...props, locale } as never);
  };
}
