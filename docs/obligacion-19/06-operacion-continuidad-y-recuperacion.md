---
codigo: CG-DOC-06
titulo: Operación, continuidad y recuperación
subtitulo: Procedimientos operativos (runbooks), monitoreo, respaldo y restauración, reconstrucción del entorno y control de cambios
version: 1.0
audiencia: Operadores, administradores técnicos de FEDEGÁN y auditores de continuidad
fuente: Configuración del repositorio y del despliegue, historial de operación del proyecto (migración, optimizaciones y diagnósticos del 14 al 19 de octubre de 2026)
---

# 1. Propósito y uso

Reúne los procedimientos que una persona **distinta de quien construyó el sistema** necesita para operarlo y para recuperarlo ante un fallo. Cada procedimiento (R-01 a R-12) tiene: cuándo se usa, pasos numerados, cómo verificar que funcionó y cómo deshacerlo. Los comandos asumen un equipo con Node.js 22, Git y acceso al repositorio y a los paneles de Vercel, Supabase y GitHub.

**Nivel de servicio propuesto (a acordar con FEDEGÁN, no es un compromiso vigente):** punto de recuperación objetivo (RPO) de **24 horas** (copia diaria del proveedor) y tiempo de recuperación objetivo (RTO) de **4 horas** para el sitio público; el panel puede tardar más. Si FEDEGÁN requiere un RPO menor, debe activarse la recuperación a un punto en el tiempo (PITR) en Supabase (R-05).

# 2. Mapa de componentes y quién los opera

| Componente | Dónde se opera | Qué se hace allí |
|---|---|---|
| Aplicación | Vercel → proyecto `contexto` | Despliegues, variables de entorno, logs, Firewall |
| Base de datos y medios | Supabase → proyecto `CONTEXTOPRO` | SQL Editor (migraciones), copias de respaldo, informes, Storage |
| Código y CI | GitHub → `iafedegan/contexto` | Historial de cambios, integración continua, programados cada 5 minutos |
| Trabajos en segundo plano | Inngest | Sincronización del archivo (solo mientras exista) |
| Correo | Resend | Dominio remitente, clave, entregas |

# 3. Procedimientos

## R-01 · Despliegue normal
**Cuándo:** cada cambio de código aprobado.
1. En local: `npm run lint && npm run typecheck && npm test && npm run build` deben pasar.
2. Si el cambio incluye una migración de base de datos, **aplicarla primero** en Supabase (R-03) y solo después subir el código.
3. `git push` a `main`. La integración continua (GitHub → Actions → CI) ejecuta auditoría de dependencias, lint, tipos, 378 pruebas, compilación y prueba de humo.
4. Vercel despliega automáticamente (≈ 35–55 s). Confirmar en Vercel → Deployments que el estado es **Ready** y que el `commit` es el esperado.
5. **Verificar:** `curl -s https://<dominio>/api/health` responde 200; abrir la portada y una nota; revisar Vercel → Logs sin errores nuevos.
**Deshacer:** R-02.

## R-02 · Reversión a un despliegue anterior
**Cuándo:** el despliegue nuevo falla o degrada el servicio.
1. Vercel → proyecto → Deployments → elegir el último despliegue bueno (estado Ready) → menú **Promote to Production** (o «Instant Rollback»).
2. Verificar con R-01 paso 5.
3. Abrir un cambio que revierta o corrija el código culpable (`git revert <commit>`), pasar la integración continua y desplegar.
**Nota:** una reversión de código **no** revierte una migración de base de datos ya aplicada; por eso las migraciones son aditivas e idempotentes (R-03).

## R-03 · Migración de base de datos
**Cuándo:** cualquier cambio de `src/db/schema.ts`.
1. Editar `src/db/schema.ts`.
2. `npm run db:generate` → se crea `drizzle/NNNN_*.sql`. **Renombrar** el archivo con un nombre descriptivo y actualizar su entrada en `drizzle/meta/_journal.json`.
3. **Revisar y hacer idempotente cada sentencia** (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` antes de crear). En producción las migraciones se aplican a mano y pueden repetirse sin daño.
4. Local: `npm run db:migrate` y `npm test` (la base de pruebas aplica todas las migraciones desde cero y una prueba compara el esquema con ellas).
5. Producción: pegar el contenido del `.sql` en **Supabase → SQL Editor** y ejecutar. Si el script es largo y el editor corta la conexión, ejecutarlo **por partes** (estructura primero; actualizaciones de datos por tandas, ver R-08).
6. **Verificar:** consulta que confirme la columna o el índice (por ejemplo `select column_name from information_schema.columns where table_name='editorial_slots'`).
7. Subir el código (R-01).
**Deshacer:** escribir una migración nueva que revierta (no se editan migraciones ya aplicadas). Ejemplo vigente: la migración 0024 agregó una columna nula; revertirla es `ALTER TABLE … DROP COLUMN IF EXISTS`.

## R-04 · Rotación de secretos
**Cuándo:** sospecha de filtración, salida de una persona con acceso, o al menos una vez al año (y tras el corte de dominio, para las credenciales de la migración).

| Secreto | Dónde se cambia | Efecto al rotar |
|---|---|---|
| `AUTH_SECRET` | Vercel → Environment Variables | Se cierran **todas** las sesiones; como todas las claves derivan de ella, también cambian los enlaces firmados y se invalidan las claves cifradas guardadas en la base (hay que volver a escribirlas) |
| `SECRETS_ENCRYPTION_KEY` (si se usa) | Vercel | Hay que volver a introducir las claves guardadas desde el panel |
| `NEWSLETTER_LINK_SECRET`, `PREVIEW_TOKEN_SECRET`, `PASSKEY_BRIDGE_SECRET`, `ASSISTANT_SESSION_SECRET`, `NEWSLETTER_READING_SECRET` | Vercel | Efecto limitado a su propio uso (ver CG-DOC-05 y `docs/seguridad.md` §1) |
| `CRON_SECRET` | Vercel **y** secreto `CRON_SECRET` del repositorio en GitHub (deben coincidir) | Si solo se cambia uno, los programados dejan de funcionar |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → regenerar; luego Vercel | La subida de medios falla hasta actualizarla |
| `DATABASE_URL`, `DATABASE_URL_POOLED` | Supabase → Database → restablecer contraseña; luego Vercel | Sin base hasta actualizar ambas |
| `RESEND_API_KEY` | Resend → API Keys; luego Vercel o panel | Sin correo hasta actualizar |
| Claves de IA | Proveedor del modelo; luego Vercel o Configuración → Asistente | El asistente y la redacción asistida se detienen hasta actualizar |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | BotFather / Vercel | Volver a registrar el webhook en Configuración → Telegram |
| `VAPID_PRIVATE_KEY` | Generar un par nuevo | Las suscripciones push existentes dejan de valer |

Pasos: (1) generar el valor nuevo; (2) actualizarlo en Vercel (Production) y, si aplica, en GitHub; (3) **Redeploy** para que lo tome; (4) verificar la función afectada; (5) revocar el valor anterior en el servicio de origen; (6) registrar la fecha y el motivo en el libro de cambios (sección 5).

## R-05 · Respaldo y restauración de la base
**Estado de partida:** el proyecto Supabase está en plan de pago (Pro), que incluye copias diarias automáticas gestionadas por el proveedor. **Confirmar y documentar** al recibir la operación: retención de copias (días) y si PITR está activado (Supabase → Database → Backups).
**Restauración (procedimiento):**
1. Supabase → Database → Backups: elegir la copia (o el instante, con PITR).
2. **No restaurar sobre producción como primer paso.** Restaurar en un proyecto nuevo o ensayar en una rama, comprobar la integridad (consultas de CG-DOC-02 §11) y solo entonces decidir.
3. Si se restaura en producción: poner el sitio en modo de solo lectura anunciando mantenimiento (desactivar publicación, pausar programados), restaurar, verificar y reabrir.
4. Después de restaurar, **repetir las migraciones posteriores a la copia** (son idempotentes) y ejecutar el `VACUUM (ANALYZE)` de R-08.
5. Medios: el bucket `media` es independiente de la base; las imágenes migradas tienen su origen en el almacenamiento de objetos y deben respaldarse por separado (exportación periódica del bucket a un almacenamiento de FEDEGÁN).

**Acta de prueba de restauración (anual, formato):**

| Campo | Valor |
|---|---|
| Fecha y responsable | |
| Copia usada (fecha/hora) | |
| Entorno de prueba | |
| Tiempo total de restauración | |
| Resultado de las consultas de integridad (notas, usuarios, RLS) | |
| Observaciones y acciones | |
| Firma contraparte FEDEGÁN | |

## R-06 · Monitoreo y alertas
1. Registrar en un servicio de monitoreo de disponibilidad (UptimeRobot, Better Stack u otro) la dirección `https://<dominio>/api/health` cada 1–5 minutos, con alerta por correo a al menos dos personas. `GET /api/health` responde 200 si la aplicación **y la base** funcionan y 503 si no.
2. Además monitorear la portada (`/`) y una nota, para detectar fallas que el endpoint de salud no vería.
3. Vercel → Logs / Observability: revisar errores 5xx y los informes de política de contenido buscando `[csp]`.
4. Supabase → Reports: uso de CPU, conexiones y almacenamiento (la base pesa 697 MB; el cuerpo de las notas es lo que más crece).
5. Registrar a quién se alerta y el tiempo de respuesta esperado en el acta de CG-DOC-07.

## R-07 · Programados que no salen (notas o boletines)
**Síntoma:** una nota programada no se publica a su hora o un boletín no sale.
1. Verificar el flujo de GitHub: repositorio → Actions → «Programados» (cada 5 minutos). Si aparece «Faltan los secretos CRON_SECRET y SITE_URL», crearlos en Settings → Secrets and variables → Actions.
2. Forzar una pasada a mano: `curl -H "Authorization: Bearer $CRON_SECRET" "https://<dominio>/api/cron/publish-scheduled?solo=programados"` (debe responder 200).
3. Si responde 401/403: el `CRON_SECRET` de GitHub no coincide con el de Vercel (R-04).
4. Si la edición del boletín volvió a «borrador», faltaba una nota o nadie cumplía el filtro de audiencia (el sistema la devuelve a borrador a propósito).
5. El cron diario de Vercel (06:00 Colombia) es la red de seguridad: tras él deben haber salido las pendientes.

## R-08 · Mantenimiento de la base de datos
**Cuándo:** después de cargas o actualizaciones masivas, o si el panel o un listado se vuelven lentos de repente.
1. `VACUUM (ANALYZE) articles;` en el SQL Editor. Efecto medido el 19/10/2026: consulta de conteo por estado de **5,6 s → 0,43 s**, porque los recorridos solo de índice vuelven a ser posibles.
2. **Actualizaciones masivas por tandas.** El servicio cancela sentencias largas (`statement_timeout`). Dividir por el primer carácter del identificador, por ejemplo: `update articles set … where substr(id::text,1,1) in ('0','1')` y repetir con los demás grupos; en este proyecto 19.456 notas se marcaron en 14 tandas.
3. No ejecutar dos tandas en paralelo (compiten y vencen el tiempo).
4. Diagnóstico de lentitud: `EXPLAIN (ANALYZE, BUFFERS) <consulta>` y la extensión `pg_stat_statements` (consultas más costosas).

## R-09 · Incidente de seguridad
1. **Contener:** si hay una cuenta comprometida, desactivarla en Configuración → Personas y roles (pierde la sesión al instante); si hay un secreto expuesto, rotarlo (R-04) antes de investigar.
2. **Evaluar:** Vercel → Logs, el **registro de los últimos accesos al panel** (fecha, cuenta, dispositivo y resultado; lo ve un administrador en Configuración y se guarda acotado en `site_settings`) y qué datos pudo ver la cuenta o el secreto.
3. **Erradicar y recuperar:** rotar secretos relacionados, cerrar sesiones (rotar `AUTH_SECRET` si el alcance es amplio), restaurar contenido alterado desde el historial de Git o un respaldo (R-05).
4. **Comunicar:** si hay datos personales de suscriptores comprometidos, notificar a la autoridad y a los titulares según la Ley 1581 de 2012 y la política de privacidad del sitio. Responsable: FEDEGÁN (oficial de datos).
5. **Cerrar:** registrar causa raíz, acciones y fecha en el libro de cambios.

## R-10 · Altas y bajas de personas y de la tabla de respaldo
- **Alta:** Configuración → Personas y roles → crear con contraseña temporal, rol y permisos; la persona debe activar su 2FA en el primer ingreso.
- **Baja:** desactivar la cuenta (no se borra, para conservar la autoría de sus notas). Revisar también sus accesos a Vercel, Supabase, GitHub y Resend.
- **Cambio de titular de cuentas de proveedores:** ver CG-DOC-07.
- **Tabla `articles_meta_title_respaldo`:** copia de seguridad de 7.391 títulos SEO creada el 19/10/2026. Una vez FEDEGÁN decida el criterio del título SEO y se ejecute el cambio, puede eliminarse con `drop table articles_meta_title_respaldo;` tras conservar una exportación.

## R-11 · Corte de dominio (de `contexto-olive.vercel.app` a `www.contextoganadero.com`)
1. Antes: confirmar el informe de validación de la migración (`docs/validacion-migracion-2026-10-19.md`), **corregir las 438 notas con imágenes aún en el servidor anterior**, definir el título SEO, configurar Resend y los identificadores de analítica.
2. En Vercel → Domains: agregar `www.contextoganadero.com`; FEDEGÁN apunta el DNS (registro CNAME indicado por Vercel) y fija `NEXT_PUBLIC_SITE_URL` al dominio definitivo; añadir el dominio a `PASSKEY_ALLOWED_HOSTS` si se usan passkeys.
3. Redeploy; verificar canónicas, mapas del sitio (`/sitemap.xml`) y `robots.txt` con el dominio nuevo.
4. Enviar los mapas a Search Console y pedir la inclusión en Google News.
5. Mantener el sitio anterior **sin cancelar** hasta confirmar que ninguna imagen ni enlace depende de él; luego rotar las credenciales de la migración (R-04) y cancelar.
**Deshacer:** devolver el DNS al sitio anterior (TTL bajo antes del corte).

## R-12 · Reconstrucción del entorno desde cero
**Cuándo:** pérdida total del proyecto de base de datos o de la cuenta de despliegue.
1. **Base:** crear un proyecto Supabase (PostgreSQL 17) y habilitar las extensiones `vector`, `pg_trgm`, `pgcrypto`, `uuid-ossp` (`drizzle/manual/00_pre_extensions.sql`).
2. **Esquema:** aplicar en orden `drizzle/0000_init.sql` … `drizzle/0024_aviso_de_tarea_nueva.sql`, y luego `drizzle/manual/99_post_indexes.sql` (índices vectoriales y de texto completo). Habilitar RLS en todas las tablas.
3. **Datos:** restaurar desde la copia (R-05) o, para un entorno de prueba, `npm run db:seed` (datos de demostración).
4. **Medios:** crear el bucket público `media` y restaurar los archivos respaldados.
5. **Aplicación:** crear el proyecto en Vercel conectado al repositorio y cargar **todas** las variables de CG-DOC-01 §8 (los valores se toman de la bóveda de credenciales de FEDEGÁN, CG-DOC-07).
6. **Programados:** secretos `CRON_SECRET` y `SITE_URL` en GitHub Actions.
7. **Verificar:** R-01 paso 5, consultas de integridad de CG-DOC-02 §11, iniciar sesión en el panel, publicar una nota de prueba y retirarla.

# 4. Calendario de mantenimiento recomendado

| Frecuencia | Tarea | Procedimiento |
|---|---|---|
| Diaria (automática) | Publicación de programados, retención de datos, purga de límites y medios huérfanos | Mantenimiento (CG-DOC-01 §7) |
| Semanal | Revisar Vercel → Logs (5xx, `[csp]`), el estado del flujo «Programados» y el informe de uso de Supabase | R-06, R-07 |
| Mensual | Revisar el gasto de IA y de correo frente al presupuesto; revisar cuentas activas y permisos | CG-DOC-04 |
| Trimestral | `npm audit` y actualización de dependencias con la integración continua en verde; `VACUUM (ANALYZE)` si hubo cargas masivas | R-08 |
| Anual | Prueba de restauración; rotación de secretos; revisión de cuentas y 2FA de los proveedores; revisión de este documento | R-05, R-04, CG-DOC-07 |

# 5. Control de cambios y trazabilidad

- **Código:** cada cambio es un commit en `main` (`git log`); cada despliegue de Vercel enlaza al commit que lo originó. La integración continua deja el resultado de lint, tipos, pruebas y compilación asociado al commit.
- **Base de datos:** las migraciones son archivos numerados versionados en Git; su aplicación en producción es manual y debe anotarse (fecha, quién, resultado). Ejemplos de la ventana del 14 al 19/10/2026: 0023 (zonas de las notas) y 0024 (aviso de tarea nueva) aplicadas por el contratista el 19/10/2026; `VACUUM (ANALYZE) articles` el 19/10/2026.
- **Libro de cambios operativos (formato):** fecha · quién · qué cambió (código, migración, variable, DNS) · motivo · verificación · cómo se revierte.
- **Aprobación de cambios:** cambios que afectan datos de producción o credenciales requieren autorización explícita de FEDEGÁN; los cambios de código siguen el ciclo de R-01.
