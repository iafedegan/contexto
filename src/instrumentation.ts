/**
 * Se ejecuta una vez cuando arranca el servidor de Next. Aquí se cablean los oyentes de eventos de dominio
 * (ver src/lib/eventos.ts y src/lib/oyentes.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("@/lib/oyentes");
}
