---
codigo: CG-DOC-07
titulo: Inventario de cuentas, servicios y credenciales, y acta de entrega
subtitulo: Qué cuentas existen, quién es el titular, qué secretos dependen de ellas, procedimiento de entrega segura y formato de acta
version: 1.0
audiencia: Supervisor del contrato, oficial de seguridad y auditores de FEDEGÁN
fuente: Configuración del repositorio y del despliegue, y consola de cada servicio, a la fecha de emisión. Los campos marcados «A confirmar» solo los puede llenar FEDEGÁN
---

# 1. Propósito

La obligación 19 exige entregar las **credenciales y contraseñas** del sistema. Por seguridad, **este documento no contiene ninguna credencial**: contiene el **inventario completo de cuentas y secretos** (qué existe, para qué sirve, quién lo administra, dónde vive y cómo se rota), el **procedimiento de entrega segura** y el **acta** que deja constancia de lo entregado. Las credenciales en sí se entregan por el canal protegido descrito en la sección 4, nunca por correo, chat o documento.

# 2. Inventario de servicios y cuentas

Leyenda de estado de transferencia: **Pendiente** = aún a nombre del contratista o de una cuenta personal; **FEDEGÁN** = ya es de FEDEGÁN; **A confirmar** = no verificable desde el código.

| N.º | Servicio | Para qué | Identificador / dirección | Titular actual | Estado de transferencia | Rol que debe tener FEDEGÁN |
|---|---|---|---|---|---|---|
| 1 | **Vercel** | Alojamiento, despliegues, cron, logs, Firewall, dominios | Proyecto `contexto`; despliegue actual `contexto-olive.vercel.app` | Cuenta personal del contratista (plan Hobby) | **Pendiente** | Propietario del equipo/organización |
| 2 | **Supabase** | Base de datos PostgreSQL y almacenamiento de medios | Proyecto `CONTEXTOPRO` (`cguzwzffmzxubfruulem`), organización con plan Pro | A confirmar (organización «FNG») | A confirmar | Propietario de la organización |
| 3 | **GitHub** | Código fuente, CI y programados cada 5 minutos | Repositorio `iafedegan/contexto` | Cuenta `iafedegan` | **Pendiente** | Propietario del repositorio u organización |
| 4 | **Dominio** `contextoganadero.com` | Nombre público del sitio | DNS actual del sitio anterior | FEDEGÁN | **FEDEGÁN** (A confirmar quién administra el DNS) | Administrador de DNS |
| 5 | **Proveedor de IA** (Google Gemini; opcionales Anthropic y OpenAI) | Asistente público, redacción asistida, consejo de redacción | Clave de API | A confirmar | A confirmar | Propietario de la cuenta y de la facturación |
| 6 | **Resend** | Correo del boletín y confirmaciones | Dominio remitente verificado | **Sin crear** | **Pendiente** (bloquea el envío de correos) | Propietario de la cuenta |
| 7 | **Cloudflare Turnstile** | Verificación humana en login y formularios | Claves de sitio y secreta | A confirmar | A confirmar | Propietario de la cuenta |
| 8 | **Google Analytics 4 / Tag Manager / Search Console / Ad Manager** | Analítica, indexación y publicidad | Identificadores `G-…`, `GTM-…` | **Sin cargar** | **Pendiente** | Administrador de cada propiedad |
| 9 | **Telegram** (bot) | Canal editorial por mensajería | Token del bot | A confirmar | A confirmar | Propietario del bot (BotFather) |
| 10 | **Inngest** | Trabajos en segundo plano (archivo histórico) | `app.inngest.com` | Cuenta del contratista | **Pendiente** (se retira cuando se apague el sitio anterior) | — |
| 11 | **Claves VAPID** | Notificaciones push | Par público/privado | Generadas por el contratista | **Pendiente** de entregar | Custodio |
| 12 | **Storyblok** (sitio anterior) | Gestor de contenido del sitio anterior; origen de la migración | Proyecto del sitio anterior | FEDEGÁN / proveedor anterior | A confirmar | Se cancela tras el corte (CG-DOC-06, R-11) |
| 13 | **Cuentas del panel editorial** | Acceso del equipo al panel | Panel `/panel` | Personas de FEDEGÁN y cuentas semilla | Ver sección 5 | Al menos 2 administradores de FEDEGÁN |

# 3. Inventario de secretos y configuración sensible (solo nombres, nunca valores)

| Secreto o variable | Servicio de origen | Dónde está guardado | Quién la conoce hoy | Se rota con |
|---|---|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_POOLED` | Supabase | Vercel → Environment Variables (Production) | Contratista | CG-DOC-06, R-04 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Vercel | Contratista | R-04 |
| `AUTH_SECRET` | Generada | Vercel | Contratista | R-04 (cierra todas las sesiones) |
| `CRON_SECRET` | Generada | Vercel y GitHub (deben coincidir) | Contratista | R-04 |
| `REVALIDATE_SECRET` | Generada | Vercel | Contratista | R-04 |
| `GOOGLE_GENERATIVE_AI_API_KEY` (y las opcionales de Anthropic/OpenAI) | Proveedor de IA | Vercel y/o cifrada en la base (Configuración → Asistente) | Contratista | R-04 |
| `RESEND_API_KEY` | Resend | Aún no configurada | — | R-04 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare | Vercel | A confirmar | R-04 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Generadas | Vercel | Contratista | R-04 (invalida suscripciones push) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Telegram | Vercel | A confirmar | R-04 |
| Contraseña de la base (rol `postgres`) | Supabase | Panel de Supabase | Titular de la organización | R-04 |
| Contraseñas y 2FA de las cuentas del panel | La aplicación | Hash en `users` | Cada persona | La persona, en Configuración → Mis datos |
| `ARCHIVE_API_KEY` y credenciales de acceso a Storyblok / almacenamiento del sitio anterior usadas en la migración | Sitio anterior | Archivos locales del contratista (no están en el repositorio) | Contratista | **Rotar y destruir tras el corte** (hallazgo H-D2, CG-DOC-05) |

**Regla:** cada fila debe tener, al cierre de la transferencia, **dos personas de FEDEGÁN** que la conozcan o puedan recuperarla (principio de dos custodios), y el contratista **debe quedar sin acceso** o con acceso expresamente autorizado y limitado en el tiempo.

# 4. Procedimiento de entrega segura

1. **Bóveda.** FEDEGÁN dispone un gestor de contraseñas corporativo (1Password, Bitwarden u otro) con una bóveda «CONtexto Ganadero — Producción» accesible solo a los custodios designados.
2. **Entrega.** El contratista crea cada entrada de la sección 3 en la bóveda (o la comparte desde la suya) **en una sesión con el custodio de FEDEGÁN presente**. Ninguna credencial viaja por correo, chat, documento ni captura de pantalla.
3. **Verificación inmediata.** Para cada servicio, el custodio de FEDEGÁN **inicia sesión por sí mismo** y comprueba que tiene el rol propietario; en los servicios que lo permiten, activa su propio 2FA.
4. **Transferencia de titularidad.** Servicios 1, 2 y 3: transferir el proyecto o repositorio a la organización de FEDEGÁN (Vercel → Settings → Transfer; Supabase → Organization → Transfer project; GitHub → Settings → Transfer repository) y confirmar que los despliegues, el CI y los programados siguen funcionando (CG-DOC-06, R-01 y R-07).
5. **Rotación posterior.** Con la transferencia hecha, **el contratista rota** los secretos de la sección 3 que haya conocido (CG-DOC-06, R-04) para que solo FEDEGÁN los posea, y retira sus cuentas personales de las organizaciones.
6. **Acta.** Se firma el acta de la sección 6 el mismo día.

# 5. Cuentas del panel editorial

El panel tiene tres roles (CG-DOC-05, §2): redactor, editor y administrador. **Estado a revisar al entregar:**

1. Debe haber **al menos dos administradores de FEDEGÁN** con 2FA activo.
2. Las cuentas de demostración o semilla creadas durante el desarrollo (`SEED_ADMIN_EMAIL`) deben **desactivarse o eliminarse**.
3. Las cuentas del contratista deben pasar a una cuenta propia de FEDEGÁN o desactivarse.
4. Consulta de verificación (CG-DOC-02, §11): cuentas por rol y con 2FA.

# 6. Acta de entrega de credenciales y accesos

**Proyecto:** Modernización de CONtexto Ganadero · **Obligación 19 — Documentación, capacitación y transferencia**

**Fecha:** ____ / ____ / ________  **Lugar o medio:** ______________________________

**Entrega:** OpenView Consultant, representado por ______________________________
**Recibe:** FEDEGÁN, representada por ______________________________ (custodio 1) y ______________________________ (custodio 2)

**1. Declaración.** El contratista declara que entrega los accesos listados, que no conserva copia de las credenciales fuera de los medios autorizados y que, al firmar, procederá a rotar los secretos que conoció (CG-DOC-06, R-04). FEDEGÁN declara que verificó el acceso a cada servicio.

**2. Verificación por servicio** (marcar y anotar fecha):

| N.º | Servicio | FEDEGÁN inició sesión y es propietario | 2FA activo en la cuenta | Titularidad transferida | Contratista sin acceso | Fecha | Observación |
|---|---|:-:|:-:|:-:|:-:|---|---|
| 1 | Vercel | ☐ | ☐ | ☐ | ☐ | | |
| 2 | Supabase | ☐ | ☐ | ☐ | ☐ | | |
| 3 | GitHub | ☐ | ☐ | ☐ | ☐ | | |
| 4 | Dominio / DNS | ☐ | ☐ | ☐ | ☐ | | |
| 5 | Proveedor de IA | ☐ | ☐ | ☐ | ☐ | | |
| 6 | Resend | ☐ | ☐ | ☐ | ☐ | | |
| 7 | Cloudflare Turnstile | ☐ | ☐ | ☐ | ☐ | | |
| 8 | Google (GA4, GTM, Search Console, Ad Manager) | ☐ | ☐ | ☐ | ☐ | | |
| 9 | Telegram (bot) | ☐ | ☐ | ☐ | ☐ | | |
| 10 | Inngest | ☐ | ☐ | ☐ | ☐ | | |
| 11 | Claves VAPID | ☐ | n/a | ☐ | ☐ | | |
| 12 | Panel editorial: dos administradores de FEDEGÁN con 2FA | ☐ | ☐ | n/a | ☐ | | |

**3. Rotación posterior a la entrega** (el contratista marca al terminar; FEDEGÁN verifica):

| Secreto rotado | Fecha | Quién | Verificado por FEDEGÁN |
|---|---|---|---|
| Contraseña de base de datos y claves de Supabase | | | ☐ |
| `AUTH_SECRET`, `CRON_SECRET`, `REVALIDATE_SECRET` | | | ☐ |
| Claves de IA | | | ☐ |
| Tokens de Telegram y de otros servicios | | | ☐ |
| Credenciales usadas en la migración (sitio anterior) | | | ☐ |

**4. Contactos de escalamiento** (para R-06 y R-09):

| Rol | Nombre | Correo | Teléfono |
|---|---|---|---|
| Custodio de credenciales 1 (FEDEGÁN) | | | |
| Custodio de credenciales 2 (FEDEGÁN) | | | |
| Oficial de datos personales (FEDEGÁN) | | | |
| Soporte técnico en garantía (contratista) | | | |

**5. Observaciones:** ____________________________________________________________

| Entrega (contratista) | Recibe (custodio 1, FEDEGÁN) | Recibe (custodio 2, FEDEGÁN) | Supervisor del contrato |
|---|---|---|---|
| Nombre / firma / fecha | Nombre / firma / fecha | Nombre / firma / fecha | Nombre / firma / fecha |
