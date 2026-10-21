/**
 * El pooler de Supabase (Supavisor) tiene dos puertos: 5432 (modo SESIÓN: cada conexión de la aplicación ocupa una de las pocas del cupo, 15 en la
 * máquina Nano) y 6543 (modo TRANSACCIÓN: la conexión se presta solo mientras dura cada consulta). En Vercel cada instancia abre varias conexiones y las
 * deja ociosas, así que en modo sesión el cupo se llena y las peticiones fallan al azar. Esta función manda a la aplicación por el puerto 6543.
 *
 * Es seguro para este código: no usa consultas preparadas con nombre ni ajustes de sesión, y su único bloqueo (`pg_advisory_xact_lock`) vive dentro de la
 * transacción. `DATABASE_POOL_MODE=session` conserva el puerto original.
 */
const PUERTO_SESION = /(@[^/:?#@]+\.pooler\.supabase\.com):5432(?=[/?#]|$)/;

export function ajustarPooler(url: string, modo: string | undefined = process.env.DATABASE_POOL_MODE): string {
  if (modo?.trim().toLowerCase() === "session") return url;
  return url.replace(PUERTO_SESION, "$1:6543");
}
