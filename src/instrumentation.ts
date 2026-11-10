import type { Instrumentation } from "next";

/**
 * Se ejecuta una vez cuando arranca el servidor de Next. Aquí se cablean los oyentes de eventos de dominio
 * (ver src/lib/eventos.ts y src/lib/oyentes.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("@/lib/oyentes");
}

/**
 * Todo error del servidor (páginas, rutas, acciones) deja una línea buscable en los registros de Vercel: «[error-servidor]».
 * Si existe `ERROR_WEBHOOK_URL`, además se envía allí (Slack, Discord, un servicio de monitoreo…). Nunca se envían cabeceras
 * ni cookies de la petición: solo la ruta, el método y el error.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as { message?: string; digest?: string; stack?: string };
  const registro = {
    mensaje: e?.message ?? String(err),
    digest: e?.digest,
    ruta: request.path,
    metodo: request.method,
    plantilla: context.routePath,
    tipo: context.routeType,
    momento: new Date().toISOString(),
  };
  console.error("[error-servidor]", JSON.stringify(registro), e?.stack?.split("\n").slice(0, 6).join("\n") ?? "");
  const destino = process.env.ERROR_WEBHOOK_URL;
  if (!destino) return;
  try {
    await fetch(destino, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Error en ${registro.metodo} ${registro.ruta}: ${registro.mensaje}`, ...registro }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // El aviso nunca debe tumbar nada.
  }
};
