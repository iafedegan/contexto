import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { SiteShell } from "@/components/site-shell";
import { RefineLocation } from "@/components/refine-location";
import { getSiteTheme } from "@/lib/site-theme";
import { confirmarSuscripcion } from "@/app/acciones/boletin";

// Se calcula en cada petición, nunca durante la compilación.
export const dynamic = "force-dynamic";
// Título de la página; no se indexa en buscadores.
export const metadata: Metadata = { title: "Confirmar suscripción", robots: { index: false, follow: false } };

/**
 * Enlace del correo de confirmación (doble opt-in). Abrir el enlace NO confirma nada: solo muestra un botón, y la
 * confirmación ocurre en un POST (`confirmarSuscripcion`, una acción del servidor). Los antivirus y servicios de correo
 * (Safe Links, vistas previas) abren por su cuenta los enlaces de los mensajes con un GET: si el GET confirmara, darían
 * de alta a personas que no hicieron nada y el doble opt-in dejaría de valer como prueba de consentimiento (H-10).
 */
export default async function ConfirmarPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const site = await getSiteTheme();

  let estado: "pendiente" | "confirmada" | "invalido" = "invalido";
  let ubicada = false;
  if (t && t.length >= 16 && t.length <= 80) {
    // Solo lectura: esta consulta no cambia nada.
    const [row] = await db
      .select({
        confirmed: newsletterSubscribers.confirmed,
        unsubscribedAt: newsletterSubscribers.unsubscribedAt,
        source: newsletterSubscribers.signupGeoSource,
      })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.confirmToken, t))
      .limit(1);
    if (row) {
      estado = row.confirmed && !row.unsubscribedAt ? "confirmada" : "pendiente";
      ubicada = row.source === "gps" || row.source === "red";
    }
  }

  return (
    <SiteShell theme={site.theme} style={site.style} locale="es" variant="institucional">
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="lx-kicker text-[var(--accent)]">Boletín</p>
        <h1 className="lx-display mt-3 text-4xl font-semibold">
          {estado === "confirmada" ? "¡Suscripción confirmada!" : estado === "pendiente" ? "Confirma tu suscripción" : "Este enlace no es válido"}
        </h1>
        <p className="mt-4 text-[var(--fg-muted)]">
          {estado === "confirmada"
            ? "Desde ahora recibirás el boletín en tu correo. Puedes darte de baja cuando quieras desde cualquiera de sus mensajes."
            : estado === "pendiente"
              ? "Pulsa el botón para empezar a recibir el boletín. Si no fuiste tú quien lo pidió, cierra esta página: no se te enviará nada."
              : "Puede que el enlace esté incompleto o que la suscripción ya no exista. Vuelve a suscribirte desde el sitio para recibir uno nuevo."}
        </p>
        {estado === "pendiente" && t && (
          <form action={confirmarSuscripcion} className="mt-8">
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="lx-btn">Confirmar mi suscripción</button>
          </form>
        )}
        {estado === "confirmada" && !ubicada && t && <RefineLocation token={t} />}
        <Link href="/" className="lx-btn mt-8 inline-flex">Ir a la portada</Link>
      </div>
    </SiteShell>
  );
}
