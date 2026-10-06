/**
 * Dominios desde los que se aceptan passkeys (hallazgo H-09).
 *
 * El "Relying Party ID" de una passkey es el dominio desde el que se creó, y el navegador lo exige idéntico al
 * usarla. Antes se tomaba tal cual de la cabecera `host`/`x-forwarded-host` de la petición; ahora esa cabecera solo
 * sirve para ELEGIR uno de los dominios que el despliegue declara, nunca para inventar uno.
 *
 * Los permitidos salen de la configuración del propio despliegue:
 *  - `NEXT_PUBLIC_SITE_URL`: el dominio público del sitio.
 *  - `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL` y `VERCEL_BRANCH_URL`: los dominios que Vercel asigna.
 *  - `PASSKEY_ALLOWED_HOSTS`: dominios adicionales, separados por comas (p. ej. el `.vercel.app` anterior cuando
 *    ya hay dominio propio y siguen existiendo passkeys creadas allí).
 * Fuera de Vercel (desarrollo y `next start` local) también se admite `localhost`.
 *
 * Es una función pura (recibe el entorno) para poder probarla sin servidor.
 */

type Entorno = Record<string, string | undefined>;

/** Nombre de dominio (sin protocolo, ruta ni puerto, en minúsculas) de un valor como `https://a.b/c`, `a.b:443` o `a.b`. */
export function hostnameDe(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim().toLowerCase();
  if (!v) return null;
  try {
    const h = new URL(v.includes("://") ? v : `https://${v}`).hostname;
    return h || null;
  } catch {
    return null;
  }
}

/** Dominios declarados por el despliegue, sin repetir. */
export function hostsPermitidos(env: Entorno = process.env): string[] {
  const fuentes = [
    env.NEXT_PUBLIC_SITE_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
    ...(env.PASSKEY_ALLOWED_HOSTS ?? "").split(","),
  ];
  return [...new Set(fuentes.map(hostnameDe).filter((h): h is string => h !== null))];
}

// Nombres de máquina que solo existen en el equipo de quien desarrolla.
const LOCALES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * `true` si el dominio de la petición puede usarse como origen de passkeys.
 *
 * Si el despliegue no declara NINGÚN dominio (ni siquiera los de Vercel) no hay con qué comparar y se acepta el de la
 * petición, para no dejar sin entrada con passkey a un sitio recién instalado; el aviso lo da `avisoSinHosts`.
 */
export function hostPermitido(hostHeader: string | null | undefined, env: Entorno = process.env): boolean {
  const host = hostnameDe(hostHeader);
  if (!host) return false;
  if (!env.VERCEL && LOCALES.has(host)) return true;
  const lista = hostsPermitidos(env);
  if (lista.length === 0) return true;
  return lista.includes(host);
}

/** `true` si el despliegue no declara dominios y, por tanto, `hostPermitido` no puede filtrar nada. */
export function avisoSinHosts(env: Entorno = process.env): boolean {
  return hostsPermitidos(env).length === 0;
}
