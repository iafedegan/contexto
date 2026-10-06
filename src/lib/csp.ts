/**
 * Política de seguridad de contenido (CSP) del sitio (hallazgo H-14). Es una función pura (recibe el entorno) para poder
 * probarla sin servidor, y la usa `next.config.ts` para armar la cabecera.
 *
 * Modo OBLIGATORIO por defecto en producción: el navegador bloquea lo que no esté permitido y avisa a
 * `/api/csp-report`. Dos válvulas, sin tocar código:
 *  - `CSP_MODE=report-only` vuelve al modo solo-informe (para investigar un bloqueo que afecte a algo legítimo).
 *  - `CSP_SCRIPT_SRC_EXTRA`, `CSP_STYLE_SRC_EXTRA`, `CSP_IMG_SRC_EXTRA`, `CSP_CONNECT_SRC_EXTRA`, `CSP_FRAME_SRC_EXTRA` y
 *    `CSP_MEDIA_SRC_EXTRA` añaden orígenes (separados por espacios o comas) a cada directiva. Es lo que hay que hacer al
 *    cargar una etiqueta publicitaria nueva: su dominio se autoriza de forma explícita, no de manera implícita.
 *
 * Qué NO se puede quitar todavía: `'unsafe-inline'` en scripts y estilos. Next.js inyecta scripts en línea para arrancar
 * y para el flujo de datos de cada página, y las notas se sirven como páginas estáticas (ISR, cacheadas) a las que no se
 * les puede dar un `nonce` distinto por visita sin renderizarlas en cada petición. Mientras tanto la política sí cierra
 * lo importante: de qué orígenes se cargan scripts, marcos, formularios y conexiones; `object-src 'none'`; `base-uri`;
 * `form-action`; y quién puede enmarcar el sitio.
 */

type Entorno = Record<string, string | undefined>;

/** Una fuente CSP admitida desde el entorno: https con host (o `*.host`) y puerto opcional. Nada de comillas, `;` ni espacios. */
const FUENTE_VALIDA = /^https:\/\/(\*\.)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

/** Orígenes adicionales de una variable de entorno, ya validados (los inválidos se descartan en silencio). */
export function fuentesExtra(valor: string | undefined): string[] {
  return (valor ?? "").split(/[\s,]+/).filter((f) => FUENTE_VALIDA.test(f));
}

/**
 * Cabecera y valor de la CSP según el entorno. Con `documentacionApi` se arma la política de `/api-docs`, la única página
 * que la necesita distinta: Scalar (la documentación interactiva de la API) usa `eval` y sus propias tipografías. Es una
 * página sin sesión ni datos, y la excepción vale solo para esa ruta.
 */
export function cabeceraCsp(
  env: Entorno = process.env,
  opciones: { documentacionApi?: boolean } = {},
): { key: "Content-Security-Policy" | "Content-Security-Policy-Report-Only"; value: string } {
  const docs = opciones.documentacionApi === true;
  const extra = (nombre: string) => fuentesExtra(env[nombre]);
  const dir = (nombre: string, base: string[], variable: string) => [nombre, ...base, ...extra(variable)].join(" ");

  const value = [
    "default-src 'self'",
    // unpkg.com: Leaflet del mapa de suscriptores, cargado por CDN sin instalarlo (ver subscriber-map.tsx).
    dir(
      "script-src",
      ["'self'", "'unsafe-inline'", ...(docs ? ["'unsafe-eval'"] : []), "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://challenges.cloudflare.com", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      "CSP_SCRIPT_SRC_EXTRA",
    ),
    dir("style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://unpkg.com"], "CSP_STYLE_SRC_EXTRA"),
    `font-src 'self' data: https://fonts.gstatic.com${docs ? " https://fonts.scalar.com" : ""}`,
    // Las fotos de las notas vienen de varios orígenes (archivo histórico, almacenamiento, agencias): cualquier https.
    dir("img-src", ["'self'", "data:", "blob:", "https:"], "CSP_IMG_SRC_EXTRA"),
    dir("media-src", ["'self'", "blob:", "https:"], "CSP_MEDIA_SRC_EXTRA"),
    // /api-docs (Scalar) llama a su propio worker cargado desde jsdelivr.
    dir(
      "connect-src",
      ["'self'", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com", "https://challenges.cloudflare.com", "https://cdn.jsdelivr.net", "https://*.supabase.co"],
      "CSP_CONNECT_SRC_EXTRA",
    ),
    // 'self': el editor de portada enmarca /vista-portada del propio sitio.
    dir(
      "frame-src",
      ["'self'", "https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://challenges.cloudflare.com", "https://www.googletagmanager.com"],
      "CSP_FRAME_SRC_EXTRA",
    ),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "report-uri /api/csp-report",
  ].join("; ");

  // Fuera de producción (`next dev`) Next usa `eval` y estilos inyectados para la recarga en caliente: solo informe.
  const obligatoria = env.NODE_ENV === "production" && env.CSP_MODE !== "report-only";
  return { key: obligatoria ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value };
}

/** Deja de un aviso de la CSP (`report-uri` o Reporting API) solo la directiva, el recurso bloqueado y la página, cortados. */
export function resumirAvisoCsp(cuerpo: string): string {
  try {
    const json = JSON.parse(cuerpo) as unknown;
    const bruto = Array.isArray(json) ? (json[0] as { body?: unknown } | undefined)?.body : ((json as Record<string, unknown>)["csp-report"] ?? json);
    const r = (bruto ?? {}) as Record<string, unknown>;
    // `report-uri` usa guiones («blocked-uri»); la Reporting API usa camelCase («blockedURL»).
    const campo = (...claves: string[]) => String(claves.map((k) => r[k]).find((v) => v !== undefined && v !== null) ?? "").slice(0, 200);
    return JSON.stringify({
      directiva: campo("effective-directive", "effectiveDirective") || campo("violated-directive", "violatedDirective"),
      bloqueado: campo("blocked-uri", "blockedURL", "blockedUri"),
      pagina: campo("document-uri", "documentURL", "documentUri"),
    });
  } catch {
    return cuerpo.slice(0, 300);
  }
}
