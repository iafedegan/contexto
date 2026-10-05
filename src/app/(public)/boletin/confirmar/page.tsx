import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { SiteShell } from "@/components/site-shell";
import { RefineLocation } from "@/components/refine-location";
import { getSiteTheme } from "@/lib/site-theme";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";
// Título de la página; no se indexa en buscadores.
export const metadata: Metadata = { title: "Confirmar suscripción", robots: { index: false, follow: false } };

/** Enlace del correo de confirmación (doble opt-in): al abrirlo, la suscripción queda activa. */
export default async function ConfirmarPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const site = await getSiteTheme();

  let estado: "ok" | "invalido" = "invalido";
  let ubicada = false;
  if (t && t.length >= 16 && t.length <= 80) {
    const [row] = await db.select({ id: newsletterSubscribers.id, source: newsletterSubscribers.signupGeoSource }).from(newsletterSubscribers).where(eq(newsletterSubscribers.confirmToken, t)).limit(1);
    if (row) {
      await db.update(newsletterSubscribers).set({ confirmed: true, unsubscribedAt: null }).where(eq(newsletterSubscribers.id, row.id));
      estado = "ok";
      ubicada = row.source === "gps" || row.source === "red";
    }
  }

  return (
    <SiteShell theme={site.theme} style={site.style} locale="es" variant="institucional">
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="lx-kicker text-[var(--accent)]">Boletín</p>
        <h1 className="lx-display mt-3 text-4xl font-semibold">{estado === "ok" ? "¡Suscripción confirmada!" : "Este enlace no es válido"}</h1>
        <p className="mt-4 text-[var(--fg-muted)]">
          {estado === "ok"
            ? "Desde ahora recibirás el boletín en tu correo. Puedes darte de baja cuando quieras desde cualquiera de sus mensajes."
            : "Puede que el enlace esté incompleto o que la suscripción ya no exista. Vuelve a suscribirte desde el sitio para recibir uno nuevo."}
        </p>
        {estado === "ok" && !ubicada && t && <RefineLocation token={t} />}
        <Link href="/" className="lx-btn mt-8 inline-flex">Ir a la portada</Link>
      </div>
    </SiteShell>
  );
}
