import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { SiteShell } from "@/components/site-shell";
import { getSiteTheme } from "@/lib/site-theme";
import { verifyUnsubscribeToken } from "@/lib/newsletter/token";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Darme de baja del boletín", robots: { index: false, follow: false } };

async function darDeBaja(formData: FormData) {
  "use server";
  const s = String(formData.get("s") ?? "");
  const t = String(formData.get("t") ?? "");
  if (!verifyUnsubscribeToken(s, t)) return;
  await db.update(newsletterSubscribers).set({ unsubscribedAt: new Date() }).where(eq(newsletterSubscribers.id, s));
}

/**
 * Baja con confirmación explícita: el enlace no actúa al abrirse (los filtros
 * antispam abren los enlaces de los correos y darían de baja a todos). La baja
 * de un solo clic desde el cliente de correo va por /api/boletin/baja.
 */
export default async function BajaPage({ searchParams }: { searchParams: Promise<{ s?: string; t?: string; ok?: string }> }) {
  const { s = "", t = "", ok } = await searchParams;
  const site = await getSiteTheme();
  const valido = s.length > 0 && t.length > 0 && verifyUnsubscribeToken(s, t);
  let yaDeBaja = false;
  if (valido) {
    const [row] = await db.select({ u: newsletterSubscribers.unsubscribedAt }).from(newsletterSubscribers).where(eq(newsletterSubscribers.id, s)).limit(1);
    yaDeBaja = !!row?.u;
  }

  return (
    <SiteShell theme={site.theme} style={site.style} locale="es" variant="institucional">
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="lx-kicker text-[var(--accent)]">Boletín</p>
        {!valido ? (
          <>
            <h1 className="lx-display mt-3 text-4xl font-semibold">Enlace no válido</h1>
            <p className="mt-4 text-[var(--fg-muted)]">
              Abre el enlace «Darme de baja» desde el final de cualquier boletín, o escríbenos desde el formulario de contacto y lo gestionamos.
            </p>
          </>
        ) : yaDeBaja || ok ? (
          <>
            <h1 className="lx-display mt-3 text-4xl font-semibold">Te diste de baja</h1>
            <p className="mt-4 text-[var(--fg-muted)]">No volverás a recibir el boletín. Sentimos verte partir; siempre puedes suscribirte de nuevo desde el sitio.</p>
          </>
        ) : (
          <>
            <h1 className="lx-display mt-3 text-4xl font-semibold">¿Quieres dejar de recibir el boletín?</h1>
            <p className="mt-4 text-[var(--fg-muted)]">Confirma y dejaremos de enviártelo. No se borra nada más.</p>
            <form action={darDeBaja} className="mt-8">
              <input type="hidden" name="s" value={s} />
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="lx-btn">Sí, darme de baja</button>
            </form>
          </>
        )}
        <div className="mt-8">
          <Link href="/" className="lx-link text-sm">Volver a la portada</Link>
        </div>
      </div>
    </SiteShell>
  );
}
