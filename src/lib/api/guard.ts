import "server-only";
import { NextResponse } from "next/server";
import { hit } from "@/lib/rate-limit";
import { keyFromRequest, verifyApiKey, type VerifiedClient } from "@/lib/api/keys";

/**
 * Puerta de entrada de `/api/v1/*`: exige una clave válida y aplica su propio
 * límite de peticiones por hora (cada cliente tiene el suyo, distinto del
 * límite por IP de los formularios públicos).
 */
export async function guardApi(req: Request): Promise<{ ok: true; client: VerifiedClient } | { ok: false; res: NextResponse }> {
  const client = await verifyApiKey(keyFromRequest(req));
  if (!client) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "unauthorized", message: "Falta una clave de API válida. Ver /api-docs." },
        { status: 401 },
      ),
    };
  }
  const limit = await hit(`apikey:${client.id}`, client.requestsPerHour, 3600);
  if (!limit.allowed) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "rate_limited", message: "Límite de peticiones por hora excedido." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      ),
    };
  }
  return { ok: true, client };
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
};

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { ...CORS_HEADERS, ...init?.headers } });
}
