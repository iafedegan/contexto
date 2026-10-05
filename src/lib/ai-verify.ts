import "server-only";
import { providerMeta, type AiProviderId } from "@/lib/ai-providers";

/**
 * Comprueba una clave contra el propio proveedor antes de guardarla.
 *
 * Sustituye a la validación por prefijo, que era adivinación: Google emite
 * claves con formatos distintos (`AIza…`, `AQ.…`) y rechazar por el prefijo
 * bloqueaba claves perfectamente válidas. Quien sabe si una clave sirve es el
 * proveedor, así que se le pregunta.
 *
 * Se usa el endpoint de listado de modelos: no consume tokens ni genera coste.
 */
export async function verifyApiKey(
  provider: AiProviderId,
  key: string,
): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  const label = providerMeta(provider).label;

  try {
    const res =
      provider === "google"
        ? await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
            { signal: AbortSignal.timeout(12_000) },
          )
        : await fetch("https://api.anthropic.com/v1/models?limit=20", {
            headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
            signal: AbortSignal.timeout(12_000),
          });

    if (!res.ok) {
      // Google devuelve 400 (API_KEY_INVALID) y Anthropic 401: en vez de
      // traducir códigos, se muestra el mensaje del propio proveedor, que es
      // más útil («API key not valid», «credit balance too low»…).
      const detalle = await providerError(res);
      return {
        ok: false,
        error: detalle
          ? `${label} rechazó la clave: ${detalle}`
          : `${label} respondió ${res.status} al comprobar la clave.`,
      };
    }

    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      data?: Array<{ id?: string }>;
    };

    // Google devuelve también modelos de embeddings y de imagen: solo sirven
    // los que soportan generateContent.
    const google = (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? ["generateContent"]).includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""));
    // Ids de los modelos que devuelve la cuenta de Anthropic.
    const anthropic = (data.data ?? []).map((m) => m.id ?? "");

    return { ok: true, models: [...google, ...anthropic].filter(Boolean) };
  } catch (err) {
    // Sin red (o el proveedor caído) no se puede afirmar que la clave sea mala.
    const reason = err instanceof Error && err.name === "TimeoutError" ? "tardó demasiado" : "no respondió";
    return { ok: false, error: `No se pudo comprobar la clave: ${label} ${reason}.` };
  }
}

/** Extrae el mensaje de error del cuerpo, sea cual sea el proveedor. */
async function providerError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string } | string;
    };
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    return message ? message.slice(0, 180) : null;
  } catch {
    return null;
  }
}
