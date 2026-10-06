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
`DATABASE_URL`/Supabase, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, claves de IA, `CRON_SECRET` (obligatoria para los cron), claves VAPID (push), Turnstile, Telegram. Las de producción se gestionan en Vercel → Settings → Environment Variables.

## 4. Personas y seguridad
- **Configuración → Personas y roles**: altas con contraseña temporal, rol, permisos por persona y exención de 2FA (nunca para administradores).
- 2FA obligatorio (TOTP) y passkeys opcionales. Contraseñas con hash; sesiones JWT.
- Cabeceras de seguridad y HSTS activos; la política de contenido (CSP) está en modo **solo reporte** y los reportes llegan a `/api/csp-report` (se revisan antes de hacerla obligatoria).

## 5. Límites de IA
**Configuración → Asistente**: presupuesto mensual (US$), tope de consultas por sesión y **tope diario de borradores de IA**. Al llegar al presupuesto el asistente pasa a búsqueda sin generación; al llegar al tope diario los agentes dejan de generar.

## 6. Monitoreo y salud
- `GET /api/health` responde 200 si la aplicación y la base están bien y 503 si no: apúntalo a un monitor de disponibilidad (UptimeRobot, Better Stack…) con alertas por correo.
- Vercel → Logs / Observability; Supabase → Reports. Resumen del panel: lecturas y estado de las notas.
- Medición de rendimiento: ver `docs/medicion-core-web-vitals.md`.

## 7. Datos y respaldos
Esquema en `docs/base-de-datos.md`. Los respaldos son los de Supabase (el plan Pro incluye copias diarias); para restaurar, usar el panel de Supabase. Migraciones: `npm run db:generate` → revisar el SQL → `npm run db:migrate`.

## 8. Archivo histórico
Solo lectura. El índice (`archive_index`) lo actualiza únicamente `src/lib/archive-client.ts` desde el cron `sync-archive`. La migración por lotes al modelo nuevo es el entregable E-11.

## 9. Desarrollo local
```bash
npm install && npm run dev         # PGlite local, sin servidor de base de datos
npm run lint && npm run typecheck && npm test && npm run build
npm run check:modulos              # arquitectura (docs/ARQUITECTURA.md)
npm run docs:bd                    # regenera docs/base-de-datos.md
```
