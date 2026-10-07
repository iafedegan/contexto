# Seguridad — claves, acceso, perímetro, CSP, anuncios y datos personales

Resume cómo está protegido CONtexto Ganadero, qué hace el código y qué se configura fuera de él. Cada apartado indica el
hallazgo de la auditoría que cierra (H-xx) y la prueba automática que lo vigila (`npm test`).

## 1. Claves por propósito (H-17)
`AUTH_SECRET` es la raíz. Ningún uso la emplea directamente: cada uno deriva su propia clave con HKDF-SHA256
(`src/lib/claves.ts`), de modo que conocer la de un uso no revela la raíz ni las demás. Cada propósito admite además su
propia variable, que **sustituye** a `AUTH_SECRET` solo para ese uso y permite rotarlo sin tocar el resto.

| Propósito | Qué protege | Variable propia (opcional) | Si cambia |
|---|---|---|---|
| Sesiones | Cookie de sesión del panel (la cifra Auth.js, que deriva su clave con HKDF) | — (`AUTH_SECRET`) | Todas las sesiones se cierran |
| `cifrado-secretos` | Claves de API guardadas en la base (AES-256-GCM, formato `v2.`) | `SECRETS_ENCRYPTION_KEY` | Hay que volver a introducir las claves guardadas |
| `passkey-puente` | Token de 60 s y de un solo uso entre la passkey y Auth.js | `PASSKEY_BRIDGE_SECRET` | Nada duradero |
| `baja-boletin` | Enlaces de baja de los boletines | `NEWSLETTER_LINK_SECRET` | Los enlaces nuevos usan la clave nueva; los ya enviados con la anterior siguen valiendo mientras `AUTH_SECRET` no cambie |
| `webhook-telegram` | Secreto con el que Telegram firma sus avisos | `TELEGRAM_WEBHOOK_SECRET` | Volver a registrar el webhook (Configuración → Telegram) |
| `token-previa` | Enlaces de vista previa de borradores (caducan a los 7 días) | `PREVIEW_TOKEN_SECRET` | Los enlaces de vista previa vigentes dejan de valer |
| `sesion-asistente` | Cookie firmada con la sesión del asistente público | `ASSISTANT_SESSION_SECRET` | Cada visitante recibe una sesión nueva |
| `lectura-boletin` | Firma del enlace por suscriptor en los correos (relaciona la lectura con quien autorizó) | `NEWSLETTER_READING_SECRET` | Solo la tiene quien recibió ese correo; rotarla deja de vincular lectores con enlaces ya enviados, sin borrar nada. |

- **Producción exige el secreto.** Fuera de `next dev` no hay valor de respaldo: sin `AUTH_SECRET` el servidor lanza error
  (el webhook de Telegram responde 503 «sin configurar», no 401).
- El webhook compara la cabecera con `timingSafeEqual` (en tiempo constante). Un webhook registrado antes de este cambio
  sigue funcionando (se acepta también el secreto anterior) hasta que se vuelva a registrar.
- Lo cifrado antes del cambio (sin prefijo `v2.`) se sigue descifrando y pasa al formato nuevo al volver a guardarlo.
- Pruebas: `claves.test.ts`, `secrets.test.ts`, `newsletter/token.test.ts`, `telegram-webhook.test.ts`.

## 2. Acceso al panel
**Contraseña + 2FA (H-20).** Máximo 5 intentos por cuenta y 20 por IP cada 15 minutos; Turnstile si está configurado. El
código TOTP admite un paso de desfase (±30 s) y **sirve una sola vez** (su paso de tiempo queda marcado en `rate_limits`).
Los logs enmascaran el correo (`ed***@gmail.com`). Pruebas: `totp.test.ts`, `login-log.test.ts`.

**Passkeys (H-09).** Sustituyen a contraseña y 2FA, así que exigen más:
- Verificación del usuario obligatoria (`userVerification: "required"`, y `requireUserVerification` explícito): PIN, huella
  o rostro; una llave que solo se toca no basta. Vale al registrarla y al usarla.
- El token que pasa a Auth.js caduca a los 60 s y es **de un solo uso** (se registra su identificador de forma atómica).
- Límites: 20 intentos por IP y 10 por credencial cada 15 minutos.
- **Dominios permitidos**: salen del despliegue (`NEXT_PUBLIC_SITE_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`,
  `VERCEL_BRANCH_URL`) más `PASSKEY_ALLOWED_HOSTS` (separados por comas). Una passkey creada en un dominio solo sirve en él:
  si el panel se usa desde otro (p. ej. el `.vercel.app` anterior cuando ya hay dominio propio), añádelo ahí. Si el
  despliegue no declara ninguno, se acepta el de la petición y se deja un aviso en los logs.
- Una cuenta solo puede borrar sus propias passkeys.
Pruebas: `passkey-hosts.test.ts`, `passkey-token.test.ts`.

## 3. Bots y Firewall de Vercel (H-13)
El User-Agent lo escribe quien pide la página: **no es una identidad**. Por eso el código ya no bloquea por él lo que no es un
lector (curl, Python, un Chrome sin interfaz, un navegador de pruebas): rompía auditorías, monitores y validadores, y no frenaba
a quien cambia el User-Agent. Lo que hace `src/lib/bots.ts`:
- Rechaza con 403 solo a los **crawlers de entrenamiento de IA** (los mismos que declara `robots.txt`) y a los **copiadores de
  sitios** que se anuncian por su nombre (HTTrack, Scrapy…).
- **Nunca** bloquea las herramientas documentadas: Lighthouse/PageSpeed, monitores de disponibilidad (UptimeRobot, Pingdom,
  StatusCake, Better Stack, Datadog…), validadores de feeds y de HTML, lectores RSS, vistas previas al compartir y el agente
  `ContextoGanadero-Monitor`. Con `BOT_ALLOW_EXTRA` (fragmentos separados por comas) se añaden más sin tocar código.
- `BOT_BLOCK_EXTRA` añade fragmentos a rechazar para reaccionar a un abuso sin desplegar.
- El proxy limita a 120 páginas por minuto y por IP **por instancia** (aproximado a propósito; no cuentan las navegaciones
  internas de Next ni el panel).

**El freno fuerte y global se configura en el panel de Vercel** (el código no puede crear estas reglas). Reglas recomendadas en
*Vercel → proyecto → Firewall*:
1. **Rate limit** sobre todas las rutas excepto `/_next/static` y `/_next/image`: 100 solicitudes por minuto por IP → *Challenge*.
2. **Bot Protection** (reglas administradas) en *Challenge* y **AI Bots** en *Deny*.
3. **Bypass** para las auditorías propias (por IP de la herramienta o por una cabecera secreta) delante de las dos anteriores.
4. *Attack Challenge Mode* solo ante un ataque en curso.
Prueba: `bots.test.ts`.

## 4. Política de seguridad de contenido (H-14)
Definida en `src/lib/csp.ts` y enviada por `next.config.ts`. En producción es **obligatoria** (`Content-Security-Policy`); en
`next dev` solo informa. Cierra de qué orígenes se cargan scripts, estilos, conexiones y marcos, y fija `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'` y `frame-ancestors 'self'`. Los avisos llegan a `/api/csp-report` (muestreados) y se ven en
*Vercel → Logs* buscando `[csp]`.
- `CSP_MODE=report-only` vuelve al modo solo-informe sin tocar código (para investigar un bloqueo legítimo).
- `CSP_SCRIPT_SRC_EXTRA`, `CSP_STYLE_SRC_EXTRA`, `CSP_IMG_SRC_EXTRA`, `CSP_CONNECT_SRC_EXTRA`, `CSP_FRAME_SRC_EXTRA` y
  `CSP_MEDIA_SRC_EXTRA` autorizan orígenes `https` adicionales (separados por espacios o comas; lo que no sea `https://host`
  se descarta). **Antes de cargar una etiqueta publicitaria nueva hay que autorizar su dominio aquí.**
- **Límite conocido:** se mantiene `'unsafe-inline'` en scripts y estilos, porque Next.js inyecta scripts en línea y las notas
  son páginas estáticas cacheadas que no pueden llevar un `nonce` distinto por visita. Quitarlo exigiría renderizar cada página en
  cada petición. Hasta entonces la defensa frente a XSS en el contenido es `sanitize-html` (`src/lib/sanitize.ts`) más esta
  política, que impide cargar scripts y conexiones de orígenes no autorizados.
Prueba: `csp.test.ts`.

## 5. Anuncios (H-26)
Las etiquetas de los anunciantes son HTML con JavaScript, por eso el panel admite HTML sin filtrar: es una decisión. Medidas:
1. **Solo administradores** crean, editan o borran anuncios (todas las acciones de `ads-actions.ts` exigen ese rol; hay una
   prueba que lo comprueba).
2. **El HTML no se inyecta en la página**: se muestra dentro de un `<iframe sandbox>` con documento propio
   (`src/lib/ads-frame.ts`). Sin `allow-same-origin`: no ve el DOM, las cookies ni el almacenamiento del sitio. Sin
   `allow-top-navigation`: no puede redirigir a quien lee. Sí puede ejecutar scripts y abrir el anuncio en una pestaña nueva.
3. La CSP del sitio se hereda en ese documento: solo carga scripts de los orígenes autorizados (apartado 4).
4. Un anuncio de imagen no ejecuta nada: solo muestra la imagen y su enlace con `rel="sponsored"`.
Si una etiqueta necesitara el origen del sitio para funcionar, no funcionará: es el efecto buscado.

## 6. Datos personales de suscriptores (H-21)
La política de privacidad (`/politica-de-privacidad`) declara qué se recoge, para qué y por cuánto tiempo, y el código lo cumple
(`src/lib/newsletter/retencion.ts`, que corre cada día en el cron de mantenimiento):

| Dato | Plazo |
|---|---|
| Alta que nadie confirmó | Se elimina a los 30 días |
| IP del alta | Se borra al confirmar la suscripción |
| Nombre, apellido, celular, fecha de nacimiento, ubicación | Se borran a los 30 días de la baja |
| Correo y fecha de baja | Se conservan para no volver a escribirle, hasta que la persona pida borrarlos |
| Supresión a petición | Un administrador borra el registro entero en Newsletter → Suscriptores |

Salvaguardas, porque borrar es irreversible: mientras **no haya proveedor de correo configurado** nadie ha recibido el correo
de confirmación y, por tanto, nadie ha podido confirmar, así que no se elimina ninguna alta pendiente; y `RETENCION_BOLETIN=off`
detiene todo el trabajo sin tocar código.
El CSV de suscriptores solo lleva correo, estado y fecha de alta, y lo exporta quien tenga el permiso «newsletter».
Pruebas: `newsletter/retencion.test.ts`, `newsletter/alta.test.ts`.

## 7. Boletín: doble confirmación (H-10, H-11)
El enlace del correo solo muestra un botón; la confirmación es un POST (acción del servidor), así que los antivirus y servicios
de correo que abren los enlaces por su cuenta no dan de alta a nadie. Una dirección recibe como mucho 3 correos de confirmación
por hora, venga de la IP que venga; una alta pendiente conserva su token y sus datos (solo se completan los campos vacíos).

## 8. Subida de medios (H-22)
- El tipo del archivo lo decide su **firma** (primeros bytes), no lo que declare el navegador (`src/lib/media-firma.ts`). SVG y HTML no se admiten.
- Hasta ~3,5 MB el archivo viaja por la propia acción; hasta 25 MB se sube **directo a Supabase Storage** con una dirección
  firmada y luego se confirma (si no es lo que dice ser, se borra). La función de Vercel solo admite ~4,5 MB por petición.
- Cuota de 60 subidas por persona y hora.
- Cada día se borran los archivos del bucket sin uso desde hace más de 7 días (notas borradas, subidas abandonadas); nunca más
  de 200 por pasada, y no se borra nada si no se encuentra ninguna referencia (señal de que algo falla). `MEDIA_CLEANUP=off`
  detiene la limpieza sin tocar código.
Pruebas: `media-firma.test.ts`, `media-limpieza.test.ts`.

## 9. Endpoints públicos y sus límites (H-19)
| Endpoint | Límite |
|---|---|
| `/api/vista` | Una lectura por IP y nota cada 6 h; 120 lecturas por IP y hora |
| `/api/sugerencias` | 60 por minuto y por IP; los comodines `%` y `_` se escapan |
| `/api/csp-report` | 20 por IP y hora, 200 por hora en total; solo se registra directiva, recurso y página |
| `/api/programadas` | Una pasada por minuto en todo el sitio |
| Alta al boletín | 5 por IP y hora; 3 correos por dirección y hora |
| Confirmación del boletín | 20 por IP y hora |
| Login | 5 por cuenta y 20 por IP cada 15 min |
| Passkey | 20 por IP y 10 por credencial cada 15 min |
| Asistente público | Presupuesto mensual y tope por sesión (`src/lib/budget.ts`) |

La tabla `rate_limits` se purga cada día (contadores vencidos hace más de una hora).

## 10. Operaciones atómicas (H-23)
- Aprobar un borrador de IA: una transacción con `UPDATE … WHERE status = 'pendiente' RETURNING`; dos aprobaciones a la vez no
  crean dos notas (`aprobarBorradorCore`).
- Vínculos y códigos de Telegram, y la lista de notas ya avisadas: una sola sentencia atómica o una transacción con
  `FOR UPDATE`; un código solo vincula una vez y dos vínculos a la vez no se pisan.
- Un aviso por nota: se reclama de forma atómica antes de enviar.
- La publicación programada es un único `UPDATE … RETURNING` (`procesarProgramadas`).
Pruebas: `article-ops.test.ts`, `telegram-store.test.ts`, `push.test.ts`, `scheduled.test.ts`.

## 11. Asistente público: presupuesto y citas (H-07, H-08)
- **Sin fuentes no responde**: si la búsqueda no recupera nada, declina. Si el modelo responde, el texto solo se muestra
  cuando cita al menos un fragmento con `[n]` y todos los marcadores existen (`src/lib/citas.ts`); si no, se descarta y se
  muestran las fuentes. Los fragmentos entran al prompt delimitados como datos, con la orden de ignorar instrucciones dentro de ellos.
- **Freno por IP**: 40 consultas por hora y por IP, y 600 caracteres como máximo por pregunta.
- **La sesión la emite el servidor** (cookie firmada `contexto.asistente`, 30 días): lo que mande el navegador como `sessionId`
  se ignora. Descartar las cookies da otra sesión, así que el freno real al gasto es la IP más el presupuesto mensual.
- **El presupuesto se aparta antes de llamar al modelo**, de forma atómica (un candado de transacción en Postgres): varias
  consultas a la vez ya no ven el mismo gasto y se pasan del tope. Se reservan US$ 0,02 y al terminar se ajusta al coste real
  (tokens del modelo + embedding de la pregunta). Si el proceso muere a medias, la reserva se queda y cuenta como gasto.
- Un valor no numérico en `ASSISTANT_MONTHLY_BUDGET_USD` o `ASSISTANT_SESSION_QUERY_LIMIT` se ignora y se usa el valor por defecto (antes daba `NaN` y el tope no bloqueaba nunca).
Pruebas: `budget.test.ts`, `citas.test.ts`; y `npm run smoke` comprueba que sin fuentes declina.

## 12. Lectura de enlaces (H-05) y suscripciones push (H-06)
- Los enlaces que pega la redacción se descargan con `src/lib/safe-fetch.ts`: el DNS se resuelve dentro de la conexión y se
  rechazan las IP privadas, locales y reservadas (también IPv6 y mapeadas); cada redirección pasa por las mismas
  comprobaciones, el cuerpo se lee por flujo con tope de 2 MB y como mucho 4 saltos. Prueba: `safe-fetch.test.ts`.
- `/api/push` solo acepta endpoints `https` de los servicios push de los navegadores y claves con formato válido, con 60 altas o
  bajas por IP y hora; los avisos salen por lotes de 50. Prueba: `push.test.ts`.

## 13. Cuentas, cron y flujo editorial (H-01, H-02, H-04)
- Los tres cron rechazan toda llamada si `CRON_SECRET` no existe o está vacía (antes se abrían con «Bearer undefined») y
  comparan en tiempo constante (`src/lib/cron-auth.ts`). `npm run smoke` lo comprueba en cada despliegue de CI.
- Una cuenta desactivada pierde la sesión al instante: el callback `session` y `requireRole` consultan `active` en cada petición.
- Publicar, programar, archivar, borrar y los distintivos exigen permiso «publicar» y rol de editor o superior; editar una nota
  ya publicada solo lo hace quien puede publicar; enviar a revisión no saca del sitio una nota publicada. El panel y Telegram
  usan los mismos núcleos de `src/lib/article-ops.ts` (una sola máquina de estados). Pruebas: `article-ops.test.ts`.

## 14. Medición de lectura y centro de análisis

El panel (`/panel/analitica`, permiso «analitica») muestra cómo se lee el sitio: qué notas, a qué hora, desde qué ciudad y departamento, con qué dispositivo, desde qué origen y cuánto de cada nota. Es una medición **anónima y con permiso**:

- **Permiso previo.** El aviso (`src/components/medicion-consent.tsx`) guarda la decisión en la cookie `cg_med`. Sin «sí» no se crea ningún código ni se manda nada a `/api/lectura`. «No» borra el código y no vuelve a preguntar en 90 días; en la política de privacidad (sección «Medición de lectura») se puede aceptar o retirar en cualquier momento (`preferencias-medicion.tsx`).
- **Qué se guarda** (`reader_sessions`, una fila por nota leída): un código aleatorio de visitante (cookie `cg_vid`, 400 días), la nota, el dispositivo / navegador / sistema ya clasificados, país, departamento y ciudad aproximados (cabeceras de Vercel), el origen, si ya había leído antes, hasta dónde bajó (0–100) y los segundos con la pestaña a la vista (tope de una hora).
- **Qué NO se guarda:** nombre, correo, IP (solo vive como clave de los límites de `rate_limits`, que se purga a diario) ni el `User-Agent` (solo se clasifica). Por defecto la medición **no se une** con la lista de suscriptores.
- **Lectura por suscriptor (solo con autorización expresa).** El formulario del boletín trae una casilla, sin marcar, «Autorizo que se relacione lo que leo con mi suscripción» (Ley 1581 de 2012: autorización previa, expresa e informada; la política de privacidad lo explica). Marcarla guarda `newsletter_subscribers.reading_authorized_at`, activa la medición en ese navegador y, si se trata de un alta nueva o pendiente, lo vincula (`subscriber_visitors`). El vínculo queda **sin verificar** (salió del formulario) hasta que se **verifica**: al confirmar la suscripción en el mismo navegador, o al abrir una nota desde un enlace del boletín, cuyas URLs llevan `cgs`/`cgt` (id y firma HMAC con la clave `lectura-boletin`) **solo** para quien autorizó; el navegador manda la firma a `/api/lectura` (`a: "v"`) y limpia la dirección. Una dirección que ya estaba suscrita nunca se vincula desde el formulario (no se revela que existe ni se deja que otra persona le atribuya su lectura). Solo cuentan las lecturas posteriores al vínculo. Darse de baja o eliminar la suscripción borra los vínculos (`purgarVinculosDeBajas` en el mantenimiento diario; `ON DELETE CASCADE`), y el panel solo muestra a quien sigue suscrito. La vista de personas (con correo) exige además el permiso «newsletter». Riesgo conocido: un enlace del boletín reenviado vincularía el navegador de quien lo abra; por eso se limpia de la dirección y el vínculo se muestra como lo que es.
- **Retención.** `purgarVencidos` borra las lecturas de más de 400 días (`RETENCION_LECTORES`, mínimo 30; `off` detiene el borrado). Borrar una nota borra sus lecturas (`ON DELETE CASCADE`).
- **Validación y límites** (`lectores-entrada.ts`, `api/lectura`): códigos con forma de UUID, números acotados, una lectura por visitante y nota cada 30 minutos, 900 llamadas por IP y hora; el avance solo sube y solo lo actualiza quien empezó la lectura. Los robots no entran.
- **Análisis agregado.** Las consultas (`lectores-consulta.ts`, `suscriptores-consulta.ts`) devuelven conteos y promedios, nunca filas ni visitantes individuales; las pruebas comprueban que el análisis de suscriptores no deja salir correos ni fechas de nacimiento.
- **Tabla en Supabase.** Se crea con `drizzle/0011_lecturas_de_lectores.sql` (idempotente) y se activa su seguridad por filas, para que la API pública de Supabase no pueda leerla.
