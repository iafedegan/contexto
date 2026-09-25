import "server-only";

/**
 * Verificación humana con Cloudflare Turnstile (alternativa a reCAPTCHA sin
 * rastreo publicitario; normalmente invisible para la persona).
 *
 * Se activa definiendo TURNSTILE_SECRET_KEY (servidor) y
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY (navegador). Sin claves, la verificación se
 * omite y quedan el resto de defensas (campo trampa, tiempo mínimo, límites).
 */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

export async function verifyHuman(token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!.trim(), response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Si Cloudflare no responde, no se bloquea a nadie: siguen los límites.
    console.warn("[turnstile] verificación no disponible");
    return true;
  }
}
