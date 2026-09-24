/**
 * El grupo público no impone marco: cada página monta su propia plantilla con
 * `<SiteShell theme="…">` (navbar, paleta, tipografías y footer propios).
 * Lo único común es la medición: GA4 se carga aquí, así que queda fuera del
 * panel y de las vistas previas.
 */
import { Ga4, Gtm } from "@/components/analytics-ga4";
import { getGa4Id, getGtmId } from "@/lib/analytics-server";

/**
 * El portal se renderiza en cada petición, no en el build.
 *
 * Prerenderizar exige consultar la base una vez por página y en paralelo, y el
 * build de Vercel se caía por agotar los 60 s por página. Además el destino de
 * este portal son 41.000 artículos del archivo histórico: generarlos en cada
 * despliegue nunca fue viable.
 *
 * Coste: cada visita ejecuta sus consultas (medidas en ~100 ms contra el
 * pooler). Cuando el tráfico lo justifique, el paso siguiente es cachear por
 * etiquetas e invalidar al publicar, no volver al prerenderizado masivo.
 */
export const dynamic = "force-dynamic";

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
    </>
  );
}
