---
codigo: CG-DOC-05
titulo: Seguridad de la información y matriz de controles
subtitulo: Controles implementados, evidencia verificable, roles y permisos, hallazgos abiertos y recomendaciones
version: 1.0
audiencia: Auditores de seguridad, oficial de seguridad de FEDEGÁN y contraparte técnica
fuente: Código del repositorio, pruebas automáticas, base de datos de producción y documento docs/seguridad.md, verificados el 19 de octubre de 2026
---

# 1. Propósito y método

Este documento presenta, **desde la óptica de un auditor**, qué controles de seguridad tiene CONtexto Ganadero, **dónde se puede comprobar cada uno** y qué queda abierto. Cada control cita su **evidencia**: el archivo de código que lo implementa y la **prueba automática** que lo vigila (se ejecutan en cada cambio, ver CG-DOC-01, sección 10). Un control sin prueba o que depende de una configuración fuera del código se marca como tal.

Estados: **Implementado** (en código y verificado), **Parcial** (existe pero con un límite conocido), **Externo** (depende de una configuración en un servicio que el código no puede imponer) y **Abierto** (hallazgo sin resolver).

Los identificadores H-xx corresponden a los hallazgos de la auditoría interna de seguridad que el equipo cerró durante el desarrollo; el detalle técnico de cada uno está en `docs/seguridad.md`.

# 2. Modelo de roles y permisos

## 2.1 Roles

| Rol | Alcance |
|---|---|
| Redactor | Crea y edita **sus propias** notas y las envía a revisión; no publica |
| Editor | Lo anterior más publicar, programar, retirar y borrar; borradores de IA, avisos, mensajes, portada y plantillas, boletín y centro de análisis |
| Administrador | Todo lo anterior más usuarios y roles, ajustes del sitio, claves de IA, API pública y límites. **Siempre tiene todos los permisos y no se puede restringir** |

## 2.2 Permisos delegables por persona (`src/lib/permisos.ts`)

| Permiso | Descripción | Rol mínimo por defecto |
|---|---|---|
| `articulos` | Redactar artículos y mandarlos a revisión | Redactor |
| `publicar` | Publicar, programar, despublicar y borrar | Editor |
| `borradores_ia` | Revisar, aprobar y descartar lo que propone la IA | Editor |
| `avisos` | Crear y retirar avisos del sitio | Editor |
| `mensajes` | Leer contacto y solicitudes de pauta | Editor |
| `portada` | Diseño del sitio, orden y menú de secciones | Editor |
| `newsletter` | Ediciones, envíos y suscriptores | Editor |
| `analitica` | Centro de análisis | Editor |
| `api` | Claves para terceros | Administrador |

**Decisión de diseño:** cambiar roles y crear o eliminar cuentas **no es una casilla delegable**, a propósito: si lo fuera, una persona con ese permiso podría ascenderse a administrador. El segundo factor (`exigir_2fa`) es exigencia, no permiso: obligatorio para todos por defecto; el administrador puede eximir a una persona con un plazo de gracia, **nunca a un administrador**. Prueba: `permisos.test.ts`.

# 3. Matriz de controles

## 3.1 Autenticación y sesión

| ID | Control | Implementación | Evidencia | Estado |
|---|---|---|---|---|
| A‑01 | Contraseñas con hash robusto | `bcryptjs`; nunca en claro | `src/lib/auth.ts` | Implementado |
| A‑02 | Segundo factor obligatorio | TOTP (código de un solo uso, ±30 s); bloqueo del panel hasta activarlo (H-20) | `totp.ts`, `totp.test.ts` | Implementado |
| A‑03 | Passkeys con verificación de usuario | `userVerification: required`; token puente de 60 s y de un solo uso (H-09) | `passkey.ts`, `passkey-token.test.ts`, `passkey-hosts.test.ts` | Implementado |
| A‑04 | Límite de intentos de acceso | 5 por cuenta y 20 por IP cada 15 minutos; Turnstile si está configurado | `rate-limit.ts`, `login-log.test.ts` | Implementado |
| A‑05 | Sesión acotada | JWT de 8 horas | `auth.ts` (`maxAge`) | Implementado |
| A‑06 | Cuenta desactivada pierde la sesión al instante | Se consulta `active` en cada petición | `auth.ts`, `requireRole` | Implementado |
| A‑07 | Registro de accesos sin datos personales expuestos | Correo enmascarado en logs (`ed***@gmail.com`) | `login-log.ts` | Implementado |
| A‑08 | Secreto TOTP protegido en reposo | La columna `users.totp_secret` **se guarda en texto** | `src/db/schema.ts` | **Abierto (H-D1)** |

## 3.2 Autorización

| ID | Control | Implementación | Evidencia | Estado |
|---|---|---|---|---|
| Z‑01 | Permisos efectivos en cada acción | `requirePermiso` / `requireRole` al inicio de cada Server Action | `permisos-server.ts` | Implementado |
| Z‑02 | Un redactor solo abre sus notas | `exigirNotaPropia` | `propiedad-notas.ts` | Implementado |
| Z‑03 | Máquina de estados editorial única | Publicar, programar, archivar y borrar exigen permiso «publicar» (H-01, H-04) | `article-ops.ts`, `article-ops.test.ts` | Implementado |
| Z‑04 | Anuncios solo por administradores | Todas las acciones de anuncios exigen ese rol | `ads-actions.ts` y su prueba | Implementado |
| Z‑05 | Tareas del consejo visibles solo a su responsable | La consulta filtra por responsable asignado | `app/panel/(app)/pendientes/consultas.ts` | Implementado |

## 3.3 Protección de datos y secretos

| ID | Control | Implementación | Evidencia | Estado |
|---|---|---|---|---|
| D‑01 | Claves derivadas por propósito | HKDF-SHA256 desde `AUTH_SECRET`; cada uso rotable por separado (H-17) | `claves.ts`, `claves.test.ts` | Implementado |
| D‑02 | Secretos de integración cifrados en la base | AES-256-GCM (claves de IA y de Resend guardadas desde el panel) | `secrets.ts`, `secrets.test.ts` | Implementado |
| D‑03 | Seguridad por fila en toda la base | RLS habilitada en las 26 tablas de aplicación y en la de respaldo (verificado en producción) | CG-DOC-02, sección 11 | Implementado |
| D‑04 | Retención y supresión de datos de suscriptores | Purga diaria con salvaguardas y supresión a petición (H-21) | `newsletter/retencion.ts` y su prueba | Implementado |
| D‑05 | Medición anónima y con permiso | Cookie `cg_med`; sin IP ni agente de usuario guardados; lectura por suscriptor solo con autorización expresa | `medicion-consent.tsx`, `lectores-*.ts` | Implementado |
| D‑06 | Sin secretos en el repositorio | Variables de entorno; `.env.example` sin valores | `.gitignore`, `.env.example` | Implementado |
| D‑07 | Rotación de credenciales empleadas en la migración | Pendiente de ejecutar tras el corte | CG-DOC-07 | **Abierto** |

## 3.4 Entrada, contenido y perímetro

| ID | Control | Implementación | Evidencia | Estado |
|---|---|---|---|---|
| E‑01 | Saneamiento del HTML de las notas | `sanitize-html` con lista de etiquetas permitidas | `sanitize.ts`, `sanitize.test.ts` | Implementado |
| E‑02 | Política de seguridad de contenido (CSP) | Obligatoria en producción; informes a `/api/csp-report` (H-14) | `csp.ts`, `csp.test.ts` | **Parcial** (conserva `'unsafe-inline'`, ver 4) |
| E‑03 | Cabeceras de seguridad | HSTS (2 años, subdominios y precarga), `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` | `proxy.ts`, `next.config.ts`; prueba de humo | Implementado |
| E‑04 | Defensa frente a SSRF | Toda descarga externa pasa por `safe-fetch` (rechaza IP privadas, límite de tamaño y de saltos) (H-05) | `safe-fetch.ts`, `safe-fetch.test.ts` | Implementado |
| E‑05 | Subida de medios | Tipo por firma binaria, SVG/HTML no admitidos, cuota de 60 por hora (H-22) | `media-firma.ts`, pruebas | Implementado |
| E‑06 | Anuncios aislados | HTML del anunciante en `iframe sandbox` sin `allow-same-origin` (H-26) | `ads-frame.ts` | Implementado |
| E‑07 | Doble confirmación del boletín | Confirmación por POST; 3 correos por dirección y hora (H-10, H-11) | `newsletter/alta.test.ts` | Implementado |
| E‑08 | Límites en endpoints públicos | Tabla de límites por IP y por recurso (H-19) | `docs/seguridad.md`, sección 9 | Implementado |
| E‑09 | Política de bots | Bloquea solo crawlers de entrenamiento de IA y copiadores que se anuncian; nunca bloquea monitores ni auditorías (H-13) | `bots.ts`, `bots.test.ts` | Implementado |
| E‑10 | Freno global y reglas de bots en el Firewall | Reglas recomendadas: límite de 100 solicitudes por minuto por IP y protección de bots | Panel de Vercel | **Externo** (confirmar que están activas) |

## 3.5 Disponibilidad e integridad operativa

| ID | Control | Implementación | Evidencia | Estado |
|---|---|---|---|---|
| O‑01 | Cron autenticados | Rechazan toda llamada sin `CRON_SECRET`; comparación en tiempo constante (H-02) | `cron-auth.ts`, `cron-auth.test.ts`, prueba de humo | Implementado |
| O‑02 | Webhook de Telegram autenticado | Secreto en cabecera, comparación en tiempo constante | `telegram-webhook.test.ts` | Implementado |
| O‑03 | Operaciones atómicas | Aprobar borrador, vincular Telegram, programar: una sola sentencia o transacción con bloqueo (H-23) | `article-ops.test.ts`, `scheduled.test.ts` | Implementado |
| O‑04 | Control de gasto de IA | Presupuesto mensual apartado de forma atómica antes de llamar al modelo; tope por sesión e IP (H-07) | `budget.ts`, `budget.test.ts` | Implementado |
| O‑05 | El asistente no responde sin fuentes | Verificación de citas `[n]` (H-08) | `citas.ts`, `citas.test.ts`, prueba de humo | Implementado |
| O‑06 | Revisión humana de todo contenido de IA | Ningún borrador de IA se publica sin acción de un editor | `article-ops.ts`; `consejo/plan.ts` (`pasaControl`) | Implementado |
| O‑07 | Auditoría de dependencias | `npm audit` en cada integración continua; falla con severidad alta o crítica | `.github/workflows/ci.yml` | Implementado |
| O‑08 | Salud monitoreable | `GET /api/health` (200/503) | `app/api/health/route.ts` | Implementado; monitor externo **pendiente** (CG-DOC-06) |
| O‑09 | Respaldo y recuperación | Copias diarias del proveedor; prueba de restauración | CG-DOC-06, R-05 | **Externo** (confirmar y probar) |

# 4. Límites conocidos y riesgo residual

1. **`'unsafe-inline'` en la CSP.** Next.js inyecta scripts en línea y las notas son páginas estáticas cacheadas que no admiten un `nonce` distinto por visita. La mitigación vigente es el saneamiento del HTML y una lista cerrada de orígenes de scripts y conexiones. Eliminarlo exigiría renderizar cada página en cada petición (costo de rendimiento).
2. **Límite de páginas por IP aproximado.** El proxy limita a 120 páginas por minuto **por instancia**; el freno global real debe configurarse en el Firewall de Vercel (control E-10).
3. **Medición del asistente por IP y presupuesto.** El «sessionId» lo emite el servidor; borrar cookies da una sesión nueva, así que el freno real al gasto es la IP más el presupuesto mensual.

# 5. Hallazgos abiertos y recomendaciones

| ID | Severidad | Hallazgo | Recomendación | Responsable |
|---|---|---|---|---|
| H‑D1 | Media | `users.totp_secret` se almacena en texto en la base (control A-08) | Cifrarlo con una clave derivada (HKDF, propósito `totp`) y migrar los valores existentes en una sola pasada; el acceso a la base ya está restringido, por eso la severidad es media | Contratista |
| H‑D2 | Media | Credenciales de servicios usadas durante la migración deben rotarse tras el corte de dominio (D-07) | Rotarlas todas y retirar `ARCHIVE_API_KEY` y `SITIO_ANTIGUO_URL` del entorno | FEDEGÁN + Contratista |
| H‑D3 | Media | Reglas del Firewall de Vercel sin verificar (E-10) | Aplicar las tres reglas de `docs/seguridad.md` §3 y conservar captura de la configuración como evidencia | FEDEGÁN |
| H‑D4 | Baja | Segundo factor y contraseña robusta en las **cuentas de los proveedores** (Vercel, Supabase, GitHub, Resend, proveedor de IA) no verificables desde el código | Exigir 2FA a todos los miembros de cada organización y registrar la evidencia en el acta de CG-DOC-07 | FEDEGÁN |
| H‑D5 | Baja | Monitoreo de disponibilidad externo sin configurar (O-08) | Registrar `/api/health` en un monitor con alerta por correo (CG-DOC-06, R-06) | Contratista / FEDEGÁN |
| H‑D6 | Baja | Prueba de restauración de respaldo sin evidencia (O-09) | Ejecutar R-05 una vez y archivar el acta | FEDEGÁN + Contratista |
| H‑D7 | Informativa | El grafo de dependencias es estricto, pero varias capas consultan la base directamente (deuda técnica declarada) | Seguir la hoja de ruta de `docs/ARQUITECTURA.md` (repositorio por módulo) | Contratista |

# 6. Cómo verificar de forma independiente

1. **Pruebas:** `npm ci && npm test` (378 pruebas, ≈ 1 minuto) reproduce la evidencia de los controles marcados «Implementado».
2. **Prueba de humo:** `npm run build:local` y `SMOKE_URL=… npm run smoke` comprueba por HTTP cabeceras, acceso al panel, cron y webhook sin secreto, bots, asistente sin fuentes, boletín y lecturas.
3. **Dependencias:** `npm run audit:prod`.
4. **Base de datos:** consultas de solo lectura de CG-DOC-02, sección 11 (RLS, cuentas con 2FA, integridad).
5. **Cabeceras en producción:** `curl -sI https://<dominio>/` debe mostrar `strict-transport-security`, `content-security-policy`, `x-content-type-options`, `referrer-policy` y `cross-origin-opener-policy`.
6. **Cron sin secreto:** `curl -s -o /dev/null -w "%{http_code}" https://<dominio>/api/cron/publish-scheduled` debe responder 401 o 403, nunca 200.

# 7. Gestión de incidentes de seguridad

El procedimiento de respuesta (clasificación, contención, rotación de secretos, comunicación y cierre) está en CG-DOC-06, runbook R-09. Contactos de escalamiento: se completan en el acta de entrega (CG-DOC-07).
