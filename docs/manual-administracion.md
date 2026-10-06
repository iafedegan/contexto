# Manual de administración — CONtexto Ganadero

Para personas con rol **administrador** y para la contraparte técnica de FEDEGÁN.

## 1. Servicios y cuentas
| Servicio | Para qué | Dónde se gestiona |
|---|---|---|
| Vercel | Alojamiento, red de borde, despliegues, cron | vercel.com → proyecto `contexto` |
| Supabase | PostgreSQL + pgvector, almacenamiento de medios | supabase.com |
| GitHub | Código y CI | repositorio `iafedegan/contexto` |
| Proveedor de IA (Gemini/Claude) | Asistente, agentes y asistente de redacción | clave en Configuración → Asistente o variables de entorno |
| Inngest | Tareas en segundo plano | app.inngest.com |
| Google (GA4/GTM/Search Console) | Analítica y verificación | Configuración → Sitio |
Al salir a producción (HT-6) las cuentas de Vercel y Supabase pasan a nombre de FEDEGÁN.

## 2. Despliegue
Cada `push` a `main` ejecuta CI (lint + verificación de arquitectura, tipos, **pruebas**, compilación) y Vercel despliega. En *Deployments* se ve el estado; **Redeploy** repite un despliegue. Para volver atrás: «Promote to Production» sobre un despliegue anterior.

## 3. Variables de entorno principales
`DATABASE_URL`/Supabase, `AUTH_SECRET` (obligatoria en producción: sin ella el servidor no arranca el panel), `NEXT_PUBLIC_SITE_URL`, claves de IA, `CRON_SECRET` (obligatoria para los cron), claves VAPID (push), Turnstile, Telegram, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (subida de medios). Las de producción se gestionan en Vercel → Settings → Environment Variables. El listado completo, con comentarios, está en `.env.example`.

Opcionales de seguridad (ver `docs/seguridad.md`): `PASSKEY_ALLOWED_HOSTS` (dominios extra para passkeys), `SECRETS_ENCRYPTION_KEY`, `PASSKEY_BRIDGE_SECRET`, `NEWSLETTER_LINK_SECRET`, `TELEGRAM_WEBHOOK_SECRET` y `PREVIEW_TOKEN_SECRET` (rotar cada uso por separado), `CSP_MODE` y `CSP_*_EXTRA` (política de contenido), `BOT_ALLOW_EXTRA` y `BOT_BLOCK_EXTRA` (bots).

## 4. Personas y seguridad
- **Configuración → Personas y roles**: altas con contraseña temporal, rol, permisos por persona y exención de 2FA (nunca para administradores). Cada persona cambia su contraseña en **Configuración → Mis datos**.
- 2FA obligatorio (TOTP: el código sirve una sola vez y admite ±30 s de desfase del reloj) y passkeys opcionales (exigen PIN, huella o rostro). Contraseñas con hash; sesiones JWT de 8 h.
- Cabeceras de seguridad y HSTS activos. La **política de contenido (CSP) es obligatoria en producción**; los avisos llegan a `/api/csp-report` y se ven en Vercel → Logs buscando `[csp]`. Si algo legítimo se bloquea: `CSP_MODE=report-only` la vuelve a solo-reporte, y `CSP_*_EXTRA` autoriza un dominio nuevo (p. ej. el de una etiqueta publicitaria).
- Perímetro: las reglas de Firewall de Vercel recomendadas están en `docs/seguridad.md` (apartado 3).
- Anuncios: solo los administradores los editan y el HTML se muestra aislado en un `iframe` con sandbox.

## 5. Límites de IA
**Configuración → Asistente**: presupuesto mensual (US$), tope de consultas por sesión y **tope diario de borradores de IA**. Al llegar al presupuesto el asistente pasa a búsqueda sin generación; al llegar al tope diario los agentes dejan de generar.

## 6. Monitoreo y salud
- `GET /api/health` responde 200 si la aplicación y la base están bien y 503 si no: apúntalo a un monitor de disponibilidad (UptimeRobot, Better Stack…) con alertas por correo.
- Vercel → Logs / Observability; Supabase → Reports. Resumen del panel: lecturas y estado de las notas.
- Medición de rendimiento: ver `docs/medicion-core-web-vitals.md`.

## 7. Datos y respaldos
Esquema en `docs/base-de-datos.md`. Los respaldos son los de Supabase (el plan Pro incluye copias diarias); para restaurar, usar el panel de Supabase. Migraciones: `npm run db:generate` → revisar el SQL → `npm run db:migrate`. **En producción las migraciones se aplican a mano** pegando el SQL de `drizzle/NNNN_*.sql` en el SQL Editor de Supabase: por eso cada sentencia nueva es idempotente (`IF NOT EXISTS`) y se puede repetir sin riesgo. Las migraciones están todas en el journal (`drizzle/meta/_journal.json`); `drizzle/manual/` solo guarda extensiones e índices. Una prueba falla si `schema.ts` y las migraciones se separan.

## 8. Archivo histórico
Solo lectura. El índice (`archive_index`) lo actualiza únicamente `src/lib/archive-client.ts` desde el cron `sync-archive` (a diario) o desde Inngest. La sincronización es **reanudable**: guarda su avance en `site_settings` (clave `archive_sync`) y la carga completa de ~41.000 notas se completa en varias ejecuciones. Para cargar todo de una vez, llama a `/api/cron/sync-archive?full=1` (con `Authorization: Bearer $CRON_SECRET`) las veces que haga falta hasta que responda `"completa": true`; `?reiniciar=1` descarta una pasada a medias. Cada siete días hace una pasada completa que además retira del índice lo que desapareció del origen (si desaparecieran demasiadas de golpe, no borra nada y avisa en `removedSuspicious`). Un registro inválido del origen se descarta y se cuenta (`invalid`); no detiene la pasada. La migración por lotes al modelo nuevo es el entregable E-11.

## 8b. Datos de suscriptores y medios
- **Retención** (política de privacidad): altas sin confirmar, 30 días; IP del alta, hasta confirmar; datos personales de quien se da de baja, 30 días. Corre sola cada día (`src/lib/newsletter/retencion.ts`). Para atender una solicitud de supresión, un administrador borra el registro en **Newsletter → Suscriptores**.
- **Medios**: los archivos de hasta 25 MB se suben directo a Supabase Storage; el tipo se comprueba por los primeros bytes del archivo. Cada persona puede subir 60 archivos por hora. Cada día se borran los archivos sin uso desde hace más de 7 días.

## 9. Desarrollo local
```bash
npm install && npm run dev         # PGlite local, sin servidor de base de datos
npm run lint && npm run typecheck && npm test && npm run build
npm run check:modulos              # arquitectura (docs/ARQUITECTURA.md)
npm run docs:bd                    # regenera docs/base-de-datos.md
```
