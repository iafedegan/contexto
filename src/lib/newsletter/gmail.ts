import "server-only";

/**
 * Envío por la API de Gmail (Google Cloud): el sitio manda como la cuenta que autorizó el permiso `gmail.send` (p. ej.
 * info@contextoganadero.com). Se guardan tres datos del proyecto de Google Cloud: ID de cliente, secreto y «refresh token»
 * (sacado una vez en el OAuth Playground). Con ellos se pide un permiso de acceso de una hora y se envía cada correo.
 *
 * Límite: Google Workspace admite ~2.000 correos al día por cuenta; al pasarlo responde 429 y aquí se corta el envío con un
 * mensaje claro (lo que falte se reintenta en el siguiente lote, como con Resend).
 */
export type CredencialesGmail = { clientId: string; clientSecret: string; refreshToken: string };

/** Formas básicas de cada dato, para avisar al pegar algo equivocado. */
export const FORMA_GMAIL = {
  clientId: /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
  clientSecret: /^[A-Za-z0-9_-]{20,}$/,
  refreshToken: /^1\/\/[A-Za-z0-9_-]{20,}$/,
};

/** Pide a Google un permiso de acceso con el refresh token. Devuelve el permiso o el motivo del fallo. */
export async function accesoGmail(c: CredencialesGmail, f: typeof fetch = fetch): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const res = await f("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: "refresh_token" }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await res.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
    if (res.ok && j?.access_token) return { ok: true, token: j.access_token };
    if (j?.error === "invalid_grant") return { ok: false, error: "Google rechazó el refresh token: vuelve a sacarlo en el OAuth Playground con la cuenta que envía." };
    if (j?.error === "invalid_client") return { ok: false, error: "Google no reconoce el ID o el secreto de cliente: revísalos en Google Cloud → Clientes." };
    return { ok: false, error: j?.error_description || j?.error || `Google respondió ${res.status}.` };
  } catch {
    return { ok: false, error: "No hubo respuesta de Google." };
  }
}

// Texto de cabecera con tildes y ñ (RFC 2047).
const cabecera = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
// Una cabecera nunca puede traer saltos de línea (inyección de cabeceras).
const limpia = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
// Base64 en líneas de 76 caracteres, como pide MIME.
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/.{76}(?=.)/g, "$&\r\n");

/** Arma el correo (MIME, texto y HTML) que Gmail espera en `raw`. */
export function armarMime(m: { from: string; fromName: string; to: string; replyTo?: string; subject: string; html: string; text: string; headers?: Record<string, string> }): string {
  const limite = `cg_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const extra = Object.entries(m.headers ?? {})
    .filter(([k]) => /^[A-Za-z0-9-]+$/.test(k) && !/^(from|to|subject|reply-to|content-type|mime-version|bcc|cc)$/i.test(k))
    .map(([k, v]) => `${k}: ${limpia(v)}`);
  const lineas = [
    `From: ${cabecera(limpia(m.fromName).replace(/[<>"]/g, ""))} <${limpia(m.from)}>`,
    `To: <${limpia(m.to)}>`,
    ...(m.replyTo ? [`Reply-To: <${limpia(m.replyTo)}>`] : []),
    `Subject: ${cabecera(limpia(m.subject))}`,
    "MIME-Version: 1.0",
    ...extra,
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    "",
    `--${limite}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(m.text),
    `--${limite}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(m.html),
    `--${limite}--`,
    "",
  ];
  return Buffer.from(lineas.join("\r\n"), "utf8").toString("base64url");
}

/** Envía un correo ya armado. `limite` = Google cortó por el tope diario. */
export async function enviarGmail(token: string, raw: string, f: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; limite: boolean; error: string }> {
  try {
    const res = await f("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (res.status === 429) return { ok: false, limite: true, error: "Gmail llegó a su límite de envíos por hoy (~2.000 en Google Workspace). Lo que falta se envía mañana." };
    if (res.status === 403) return { ok: false, limite: false, error: "Gmail no autorizó el envío: revisa que la API de Gmail esté habilitada y que el permiso sea gmail.send." };
    return { ok: false, limite: false, error: j?.error?.message ?? `Gmail respondió ${res.status}.` };
  } catch {
    return { ok: false, limite: false, error: "No hubo respuesta de Gmail." };
  }
}
