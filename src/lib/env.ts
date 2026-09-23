/**
 * Lectura de variables de entorno tolerante a valores vacíos.
 *
 * Los paneles de despliegue (Vercel entre ellos) crean variables declaradas
 * pero sin valor. Con `??` esa cadena vacía se considera válida, porque "" no
 * es null, y el valor por defecto nunca entra: el sitio se quedó sin nombre en
 * producción y el build llegó a fallar entero por una URL base vacía.
 *
 * `env()` exige contenido, no mera existencia.
 */
export function env(valor: string | undefined, porDefecto: string): string {
  const limpio = valor?.trim();
  return limpio ? limpio : porDefecto;
}
