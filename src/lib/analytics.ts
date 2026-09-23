/**
 * Tipos y constantes de analítica. SIN `server-only`: los consumen también
 * componentes de cliente (el formulario de configuración), y arrastrar aquí el
 * acceso a la base de datos envenenaría el bundle del navegador.
 */

export const ANALYTICS_KEY = "analytics";

export type AnalyticsSettings = {
  /** Identificador de medición GA4, del tipo `G-XXXXXXXXXX`. Es público. */
  ga4Id: string;
  /** Clave de PageSpeed Insights, cifrada. Nunca sale del servidor. */
  psiKey: string | null;
  /**
   * Base pública con la que Google alcanza el sitio. Solo hace falta cuando se
   * trabaja en local y se quiere auditar a través de un túnel (ngrok y afines).
   */
  publicBaseUrl: string;
  /** Contenedor de Google Tag Manager, del tipo GTM-XXXXXXX. */
  gtmId: string;
  /** Código de verificación de Search Console (etiqueta meta). */
  searchConsoleToken: string;
};

export const DEFAULT_ANALYTICS: AnalyticsSettings = {
  ga4Id: "",
  psiKey: null,
  publicBaseUrl: "",
  gtmId: "",
  searchConsoleToken: "",
};

/** Estado que se muestra en el panel: nunca incluye la clave entera. */
export type AnalyticsStatus = {
  ga4Id: string;
  gtmId: string;
  searchConsoleToken: string;
  publicBaseUrl: string;
  psiPresent: boolean;
  psiSource: "entorno" | "panel" | null;
  psiMasked: string | null;
};

export const GA4_ID_RE = /^G-[A-Z0-9]{6,}$/i;
export const GTM_ID_RE = /^GTM-[A-Z0-9]{5,}$/i;
