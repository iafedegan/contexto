import test from "node:test";
import assert from "node:assert/strict";
import { accesoGmail, armarMime, enviarGmail } from "@/lib/newsletter/gmail";

const CRED = { clientId: "123-abc.apps.googleusercontent.com", clientSecret: "GOCSPX-secreto-de-prueba-123", refreshToken: "1//token-de-prueba-0123456789" };
const resp = (status: number, cuerpo: unknown) => (async () => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

test("el correo se arma en MIME con tildes, texto y HTML, y sin cabeceras inyectadas", () => {
  const raw = armarMime({
    from: "info@contextoganadero.com", fromName: "CONtexto Ganadero Media", to: "lector@example.com", replyTo: "info@contextoganadero.com",
    subject: "Confirma tu suscripción · Ñame", html: "<p>Hola, ganadería</p>", text: "Hola, ganadería",
    headers: { "List-Unsubscribe": "<https://x.test/baja>\r\nBcc: espia@malo.test", Bcc: "otro@malo.test" },
  });
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(mime, /^From: CONtexto Ganadero Media <info@contextoganadero\.com>\r\n/);
  assert.match(mime, /\r\nTo: <lector@example\.com>\r\n/);
  assert.match(mime, /\r\nSubject: =\?UTF-8\?B\?/, "el asunto con tildes va codificado");
  assert.match(mime, /List-Unsubscribe: <https:\/\/x\.test\/baja> Bcc: espia@malo\.test/, "el salto de línea se aplana: no crea otra cabecera");
  assert.doesNotMatch(mime, /\r\nBcc:/i, "no se puede colar un Bcc");
  const partes = [...mime.matchAll(/base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g)].map((m) => Buffer.from(m[1].replace(/\r\n/g, ""), "base64").toString("utf8"));
  assert.deepEqual(partes, ["Hola, ganadería", "<p>Hola, ganadería</p>"]);
});

test("las credenciales se prueban con Google y se explica cada fallo", async () => {
  assert.deepEqual(await accesoGmail(CRED, resp(200, { access_token: "ya29.x" })), { ok: true, token: "ya29.x" });
  const malGrant = await accesoGmail(CRED, resp(400, { error: "invalid_grant" }));
  assert.equal(malGrant.ok, false);
  assert.match(!malGrant.ok ? malGrant.error : "", /refresh token/);
  const malCliente = await accesoGmail(CRED, resp(401, { error: "invalid_client" }));
  assert.match(!malCliente.ok ? malCliente.error : "", /ID o el secreto/);
});

test("el envío distingue el tope diario (429) del resto de fallos", async () => {
  assert.deepEqual(await enviarGmail("t", "raw", resp(200, { id: "1" })), { ok: true });
  const tope = await enviarGmail("t", "raw", resp(429, { error: { message: "Daily limit" } }));
  assert.equal(!tope.ok && tope.limite, true);
  const otro = await enviarGmail("t", "raw", resp(400, { error: { message: "Invalid To header" } }));
  assert.deepEqual(otro, { ok: false, limite: false, error: "Invalid To header" });
});
