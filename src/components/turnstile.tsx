"use client";

import Script from "next/script";

/**
 * Casilla de verificación humana (Cloudflare Turnstile). Añade al formulario
 * el campo oculto `cf-turnstile-response`. Sin clave pública no pinta nada.
 */
export function Turnstile({ className }: { className?: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className={`cf-turnstile ${className ?? ""}`} data-sitekey={siteKey} data-language="es" data-theme="auto" />
    </>
  );
}
