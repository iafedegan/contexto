# Integración con la SuperApp de FEDEGÁN (MiniApp «Contexto Ganadero»)

Implementa el lado **receptor** de la guía «Contexto Ganadero – Integración FEDEGÁN». Está **apagada** hasta configurar las variables de entorno.

## Flujo
1. La SuperApp abre `GET /superapp/launch?code=slc_…` (cupón de un solo uso).
2. El servidor valida la forma del cupón y lo canjea con `POST {API}/v2/miniapps/secure-launch/exchange` (`Authorization: Bearer <credencial>`, cuerpo `{schemaVersion:"1.0", audience, code}`, sin seguir redirecciones, con tiempo límite).
3. La respuesta se acepta solo si: versión y `audience` coinciden, `active=true`, no ha vencido, trae `sessionReference` (`srs_…`) y `sessionValidationUrl` apunta al mismo origen y ruta autorizados.
4. Se crea una **sesión local** con identificador nuevo (cookie `httpOnly`, `sameSite=lax`), que nunca dura más que la de origen; se responde 303 a `/` (el cupón no llega a ninguna página ni al `Referer`). Una sesión previa se revoca.
5. `GET /api/superapp/sesion` devuelve el estado y, cuando corresponde, consulta a FEDEGÁN (`session/validate`): 403 → la sesión local se revoca; falla de red/503 → «sin verificar» (no se concede ni se prolonga nada).

## Qué se guarda
Tabla `superapp_sesiones` (migración `0025`, idempotente): hash del token local, `subject`, `audience`, nivel de aseguramiento, capacidades, vigencias, y la `sessionReference` **cifrada** (AES-256-GCM). **No** se guarda cupón, documento, correo ni credencial. Los registros solo llevan etapa, resultado, duración y `correlationId`.

## Variables de entorno
| Variable | Descripción |
|---|---|
| `SUPERAPP_API_BASE_URL` | Origen de la API de FEDEGÁN del ambiente (HTTPS) |
| `SUPERAPP_RECEIVER_CREDENTIAL` | Credencial del receptor; solo servidor; distinta por ambiente |
| `SUPERAPP_SCHEMA_VERSION` | Versión de respuesta acordada con FEDEGÁN |
| `SUPERAPP_AUDIENCE` | Por defecto `context-ganadero` |

## Pruebas automáticas
`src/lib/superapp/superapp.test.ts`: respuesta válida y rechazos (versión, audience, inactiva, vencida, referencia, URL ajena), traducción de 410/401/403/422/5xx/red, forma de la petición, sesión local (cifrado, revocación, vencimiento), verificación de vigencia y apagado sin configuración.

## Pendiente con FEDEGÁN antes de activar
- Credencial del receptor por ambiente (por canal seguro) y URL base confirmada.
- `schemaVersion` de respuesta acordada.
- Confirmar la ruta `/superapp/launch` y el `audience` `context-ganadero` en su configuración.
- TTL del cupón (30–60 s) y acuerdo sobre creación/vinculación de cuentas.
- Aplicar la migración `0025` en Supabase (SQL idempotente en `drizzle/0025_sesiones_de_la_superapp.sql`).

**Nota:** los registros de solicitudes de Vercel pueden guardar la cadena de consulta; el riesgo del cupón se mitiga por ser de un solo uso y muy corto.
