import Script from "next/script";

/**
 * Google Analytics 4. Solo se inyecta en el portal público (nunca en el panel
 * ni en las vistas previas) y solo si hay identificador configurado, para no
 * contaminar las métricas con la navegación del equipo editorial.
 */
export function Ga4({ id }: { id: string }) {
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
