/**
 * El grupo público no impone marco: cada página monta su propia plantilla con
 * `<SiteShell theme="…">` (navbar, paleta, tipografías y footer propios).
 * Lo único común es la medición: GA4 se carga aquí, así que queda fuera del
 * panel y de las vistas previas.
 */
import { ToroFlotante } from "@/components/toro-flotante";
import { LocationConsent } from "@/components/location-consent";
import { MedicionConsent } from "@/components/medicion-consent";
import { InstalarApp } from "@/components/instalar-app";
import { Ga4, Gtm } from "@/components/analytics-ga4";
import { getGa4Id, getGtmId } from "@/lib/analytics-server";

/**
 * El portal se sirve desde caché (ISR), no se renderiza en cada visita.
 *
 * Cada página fija su `revalidate` y la invalidación real es on-demand: las
 * Server Actions del panel llaman a `revalidatePath` al publicar. Notas y
 * secciones usan `generateStaticParams` vacío, así que NO se generan en el
 * build (el build de Vercel se caía al prerenderizar miles de páginas): cada
 * una se genera en su primera visita y desde ahí sale de la CDN.
 */

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [ga4, gtm] = await Promise.all([
    getGa4Id().catch(() => ""),
    getGtmId().catch(() => ""),
  ]);
  return (
    <>
      {children}
      <Ga4 id={ga4} />
      <Gtm id={gtm} />
      <ToroFlotante />
      <MedicionConsent />
      <LocationConsent />
      <InstalarApp locale="es" variante="aviso" />
    </>
  );
}
