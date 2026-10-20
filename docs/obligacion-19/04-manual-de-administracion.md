---
codigo: CG-DOC-04
titulo: Manual de administración
subtitulo: Gestión de personas y permisos, configuración del sitio, IA, correo, analítica, publicidad, API y tareas del administrador
version: 1.0
audiencia: Administradores del sitio y contraparte técnica de FEDEGÁN
---

# 1. Alcance y responsabilidades del administrador

Este manual es para las personas con rol **administrador**. El administrador es el único rol que puede: crear y desactivar cuentas, cambiar roles y permisos, modificar la identidad del sitio, conectar la IA y el correo, definir límites de gasto, administrar anuncios y claves de la API pública, y recibir las alertas operativas. Es una responsabilidad de alto privilegio: **conviene que FEDEGÁN tenga al menos dos administradores** con 2FA activo, de modo que nadie quede bloqueado y ninguna persona concentre el control.

Relación con otros documentos: el trabajo editorial diario está en CG-DOC-03; los procedimientos técnicos (despliegue, respaldo, rotación de secretos) en CG-DOC-06; las cuentas y credenciales en CG-DOC-07; la seguridad en CG-DOC-05.

# 2. Roles y permisos

## 2.1 Los tres roles
Redactor < Editor < Administrador. Los permisos de cada rol se detallan en CG-DOC-05 (§2) y se resumen aquí:

| Permiso | Redactor | Editor | Administrador |
|---|:-:|:-:|:-:|
| Redactar artículos y enviarlos a revisión | ✔ | ✔ | ✔ |
| Publicar, programar, despublicar y borrar | — | ✔ | ✔ |
| Borradores de IA | — | ✔ | ✔ |
| Avisos, mensajes, portada y plantillas, newsletter, centro de análisis | — | ✔ | ✔ |
| API pública (claves para terceros) | — | — | ✔ |
| Personas y roles, identidad del sitio, claves de IA, límites, anuncios | — | — | ✔ |

## 2.2 Ajustes por persona
En **Configuración → Personas y roles** se puede encender o apagar cada permiso de una persona (por ejemplo, dar el newsletter a un redactor). Lo que **no** se puede delegar, a propósito: cambiar roles y crear o eliminar cuentas.

# 3. Gestión de cuentas del panel

| Tarea | Cómo se hace | Notas |
|---|---|---|
| **Alta** | Configuración → Personas y roles → nueva persona: nombre, correo, **contraseña temporal** y rol | La persona debe cambiar su contraseña y activar el 2FA en su primer ingreso |
| **Cambio de rol o permisos** | Misma tabla, fila de la persona | Aplica en la siguiente petición |
| **Plazo de gracia del 2FA** | Eximir temporalmente a una cuenta nueva hasta una fecha | Vence sola. **Nunca** se exime a un administrador |
| **Baja** | **Desactivar** la cuenta | Pierde la sesión al instante; no se borra para conservar la autoría de sus notas |
| **Recuperar acceso de una persona** | Un administrador restablece su contraseña; si perdió el segundo factor, se vuelve a activar el 2FA | Verifica la identidad de la persona por otro canal antes |
| **Revisión periódica** | Cada mes: ¿quién tiene cuenta activa, con qué rol y con 2FA? | Consulta de apoyo en CG-DOC-02, §11 |

**Registro de accesos:** el panel guarda los últimos accesos (fecha, cuenta, dispositivo y resultado) y los muestra a los administradores en Configuración. El correo se enmascara en los registros técnicos.

**Estilos de escritura (Configuración → Estilos de escritura):** cada escritor (de la redacción o externo) puede cargar muestras de sus notas para que la IA aprenda cómo escribe. El administrador administra a todos los escritores; cada persona gestiona el suyo. La IA usa ese estilo cuando esa persona es la **responsable** de una pieza.

# 4. Configuración del sitio

| Apartado (Configuración →) | Qué controla |
|---|---|
| **Identidad del sitio** | Nombre, lema y datos que aparecen en la cabecera, el pie y las plantillas |
| **Personas y roles / Mis datos** | Cuentas, roles, permisos, cuota de IA predeterminada por persona; cada persona cambia aquí su nombre, correo y contraseña |
| **Seguridad de mi cuenta** | Activar el segundo factor (TOTP), registrar o borrar passkeys |
| **Analítica y SEO** | Identificadores de Google Analytics 4 y Tag Manager, PageSpeed, y los datos del Observatorio |
| **Asistente y agentes de IA** | Clave del proveedor de IA (se guarda **cifrada**), presupuesto mensual, tope de consultas por sesión y tope diario de borradores |
| **Telegram** | Vinculación del bot para redactar desde el celular, y registro del webhook |

Además, fuera de Configuración: **Portada y plantillas** (diseño del sitio, anuncios y ventana emergente), **Secciones** (menú), **Avisos**, **Newsletter** (ajustes del boletín y suscriptores) y **API pública**.

# 5. Inteligencia artificial: claves y límites

1. **Clave del proveedor.** En *Configuración → Asistente y agentes de IA* se pega la clave de API; se guarda **cifrada** (AES-256-GCM) y el panel solo muestra una máscara. Una variable de entorno de Vercel tiene prioridad sobre la guardada aquí. El indicador «Origen de la clave» dice de dónde sale.
2. **Presupuesto mensual (US$).** Al alcanzarlo, el asistente público pasa a **búsqueda sin generación**.
3. **Tope de consultas por sesión** y **tope diario de borradores de IA:** al llegar, los agentes dejan de generar.
4. **Cuota por persona.** La cuota predeterminada de uso de IA se define en *Personas y roles*; se puede ajustar por persona.
5. **Qué datos salen hacia el proveedor:** el texto de las consultas y las fuentes recuperadas. **No** se envían datos personales de suscriptores.
6. **Costos:** se vigilan en el panel del proveedor de IA y en *Demanda del asistente*. Revisar mensualmente.

# 6. Correo del boletín (Resend)

**Sin esta configuración el boletín no sale ni llegan las confirmaciones de suscripción.** Los envíos fallan con el aviso «El proveedor de correo no está configurado».
1. Crear una cuenta de Resend a nombre de FEDEGÁN y **verificar el dominio remitente** (por ejemplo `boletin.contextoganadero.com`): Resend entrega los registros **SPF, DKIM y DMARC** que debe publicar quien administra el DNS.
2. Generar una **clave de API** y guardarla en `RESEND_API_KEY` (Vercel) o en *Newsletter → Ajustes* (queda cifrada).
3. En *Newsletter → Ajustes*, escribir el **correo remitente**, el nombre visible y, si se desea, un correo para las respuestas.
4. **Prueba:** crear una edición con un solo destinatario (la propia cuenta), enviarla y comprobar la recepción, el enlace de baja y que no cae en spam.
5. Retención y supresión de datos de suscriptores: automáticas (CG-DOC-02, §9); para atender una solicitud de supresión, borrar el registro en *Newsletter → Suscriptores* (acción irreversible).

# 7. Analítica y SEO

- Cargar los identificadores de GA4 y Tag Manager en *Configuración → Analítica y SEO* (o por variables). Solo se cargan en el portal público y **solo con el consentimiento** del lector.
- La **medición propia** del portal (centro de análisis del panel) es anónima y con permiso; no guarda IP ni agente de usuario (CG-DOC-05, D-05).
- Enviar los **mapas del sitio** (`/sitemap.xml`) a Google Search Console y pedir la inclusión en Google News (obligación 7).
- **PageSpeed:** la clave opcional permite medir el rendimiento desde el panel; el historial de mediciones está en `docs/medicion-core-web-vitals.md`.

# 8. Publicidad (anuncios)

Solo los administradores crean, editan o borran anuncios. El HTML de un anunciante se muestra **aislado** en un `iframe` con `sandbox` (no ve cookies ni el DOM del sitio ni puede redirigir al lector). **Antes de cargar una etiqueta de un anunciante nuevo hay que autorizar su dominio** en la política de contenido (variables `CSP_*_EXTRA` en Vercel; CG-DOC-05, E-02); si no, el navegador la bloquea. Los anuncios de imagen usan `rel="sponsored"`.

# 9. API pública

*API pública* (solo administradores) crea **claves para terceros** de solo lectura (artículos, categorías) y de alta de suscriptores. Cada clave tiene un nombre, un tope de solicitudes por hora (por defecto 600) y se puede desactivar. **La clave completa se muestra una sola vez al crearla**; el sistema guarda solo su huella. La especificación está en `/api-docs` y `/api/openapi.json`.

# 10. Portada y plantillas

Un editor o administrador elige la plantilla (seis disponibles) y edita la portada con vista previa real; nada sale al sitio hasta pulsar **Publicar cambios**, y se puede **deshacer** la última publicación. El administrador controla además la **identidad** (nombre, lema, logotipo) y el **fondo** que se aplica a toda la plantilla.

# 11. Tareas del administrador por frecuencia

| Frecuencia | Tarea |
|---|---|
| **Al entrar en operación** | Confirmar dos administradores con 2FA; conectar IA y correo; cargar GA4/GTM; verificar el dominio remitente; registrar el monitor de disponibilidad (CG-DOC-06, R-06) |
| **Semanal** | Revisar el estado del flujo de programados (CG-DOC-06, R-07); revisar mensajes recibidos y avisos vigentes |
| **Mensual** | Revisar cuentas activas, roles y 2FA; gasto de IA y de correo frente al presupuesto; que no haya claves de API sin uso |
| **Trimestral** | Revisar dependencias y actualizaciones (con la integración continua en verde) |
| **Anual** | Rotar secretos; probar la restauración del respaldo; revisar los permisos y cuentas de los proveedores (CG-DOC-06, CG-DOC-07) |
| **Ante un incidente** | Seguir CG-DOC-06, R-09; desactivar la cuenta comprometida; rotar secretos |

# 12. Qué hacer cuando… (consultas rápidas)

| Situación | Acción |
|---|---|
| Una persona se fue del equipo | Desactivar su cuenta; revisar sus accesos a Vercel, Supabase, GitHub, Resend |
| Una persona perdió su teléfono con el 2FA | Restablecer su 2FA y verificar su identidad; si usaba passkey, borrarla desde su cuenta |
| El asistente dejó de responder | *Configuración → Asistente*: ¿clave válida? ¿presupuesto agotado? |
| No llegan correos del boletín | Revisar clave y dominio de Resend (sección 6) |
| Un anunciante no se ve | Autorizar su dominio en la política de contenido (sección 8) |
| Hay que cambiar un permiso de una persona | *Personas y roles* (sección 2.2) |
| Se necesita un cambio técnico (despliegue, migración) | Contratista o equipo técnico, con los procedimientos de CG-DOC-06 |

# 13. Límites del rol de administrador

El administrador **no** gestiona desde el panel: el alojamiento (Vercel), la base de datos (Supabase), el repositorio (GitHub), el DNS, el Firewall ni las variables de entorno de producción. Esas tareas requieren acceso a los paneles de cada servicio (CG-DOC-07) y siguen los procedimientos de CG-DOC-06.
