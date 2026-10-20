import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { ToroAr } from "@/components/toro-ar";
import { getSiteTheme } from "@/lib/site-theme";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Toro en realidad aumentada",
  description: "Conoce a Toro, la mascota de CONtexto Ganadero, en 3D y en realidad aumentada desde tu celular.",
};

// Página de «Toro» en 3D y realidad aumentada.
export default async function ToroArPage() {
  const site = await getSiteTheme();
  return (
    <SiteShell theme={site.theme} style={site.style} locale={DEFAULT_LOCALE} variant="asistente">
      <header className="pt-10 text-center">
        <span className="lx-chip mx-auto border-[var(--border-strong)] text-[var(--accent)]">Realidad aumentada</span>
        <h1 className="lx-display mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Toro, en tu espacio</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[var(--fg-muted)]">
          Gira y acerca a Toro con el dedo. Desde tu <strong>celular</strong>, pulsa «Ver en mi espacio (AR)» y apunta la cámara a una mesa o al piso para ponerlo frente a ti.
        </p>
      </header>
      <div className="mx-auto mt-8 w-full max-w-2xl">
        <ToroAr />
      </div>
      <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-[var(--fg-muted)]">
        Funciona en Android (Chrome, con ARCore) y en iPhone (Safari). Si estás en un computador, abre esta misma página en tu celular.
      </p>
    </SiteShell>
  );
}
