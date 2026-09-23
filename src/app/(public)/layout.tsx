/**
 * El grupo público no impone marco: cada página monta su propia plantilla con
 * `<SiteShell theme="…">` (navbar, paleta, tipografías y footer propios).
 * Lo único común es la medición: GA4 se carga aquí, así que queda fuera del
 * panel y de las vistas previas.
 */
import { Ga4 } from "@/components/analytics-ga4";
import { getGa4Id } from "@/lib/analytics-server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const ga4 = await getGa4Id().catch(() => "");
  return (
    <>
      {children}
      <Ga4 id={ga4} />
    </>
  );
}
