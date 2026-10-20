---
codigo: CG-DOC-00
titulo: Índice maestro y matriz de trazabilidad
subtitulo: Paquete de documentación, capacitación y transferencia de CONtexto Ganadero (obligación 19)
version: 1.0
audiencia: Supervisor del contrato, auditores y contraparte técnica de FEDEGÁN
---

# 1. Qué es este paquete

La obligación 19 del contrato («Documentación, capacitación y transferencia») exige entregar: documentación de base de datos, documentación técnica, manual editorial, manual de administración, credenciales y contraseñas, y capacitación diferenciada para redactores, editores y administradores. Este paquete reúne **nueve documentos controlados** que cubren cada exigencia, con el detalle que necesitaría un auditor o un equipo que reciba el mantenimiento sin conocer el sistema.

Todos los documentos comparten un mismo formato de control (código, versión, fecha, quién elaboró, quién revisa y quién aprueba), no contienen credenciales ni secretos y citan la **evidencia verificable** (archivo de código, prueba automática o consulta a la base) de cada afirmación.

# 2. Índice de documentos

| Código | Documento | Exigencia que cubre | Dirigido a |
|---|---|---|---|
| CG-DOC-00 | Índice maestro y matriz de trazabilidad (este documento) | Control documental | Todos |
| CG-DOC-01 | Documentación técnica del software | Documentación técnica | Auditores y equipo técnico |
| CG-DOC-02 | Documentación de la base de datos | Documentación de base de datos | Auditores y administradores de datos |
| CG-DOC-03 | Manual editorial | Manual editorial | Redactores y editores |
| CG-DOC-04 | Manual de administración | Manual de administración | Administradores |
| CG-DOC-05 | Seguridad de la información y matriz de controles | Documentación técnica (seguridad) y control de acceso | Auditores de seguridad |
| CG-DOC-06 | Operación, continuidad y recuperación | Documentación técnica (operación) y transferencia | Operadores y auditores de continuidad |
| CG-DOC-07 | Inventario de cuentas y credenciales, y acta de entrega | Credenciales y contraseñas | Supervisor y oficial de seguridad |
| CG-DOC-08 | Plan de capacitación diferenciada | Capacitación para redactores, editores y administradores | Coordinación editorial y supervisor |

# 3. Matriz de trazabilidad: exigencia → documento → cómo se verifica

| Exigencia de la obligación 19 | Documento(s) | Qué contiene | Cómo lo verifica un auditor |
|---|---|---|---|
| **Documentación de base de datos** | CG-DOC-02 | Motor y topología; inventario de las 26 tablas con volumen real; diccionario de datos completo (Anexo A, generado del esquema); 25 migraciones; índices; integridad; datos personales y retención; mantenimiento | Ejecutar las consultas de solo lectura de CG-DOC-02 §11 y comparar con el diccionario |
| **Documentación técnica** | CG-DOC-01, CG-DOC-05, CG-DOC-06 | Arquitectura de 12 módulos y su grafo verificable; flujos; inventario de rutas y endpoints; tareas programadas; variables de entorno; integraciones; calidad e integración continua; despliegue; matriz de 39 controles de seguridad con su evidencia; runbooks de operación y reconstrucción | `npm run lint` (grafo de módulos), `npm test` (378 pruebas), `npm run build`; revisar la matriz de CG-DOC-05 |
| **Manual editorial** | CG-DOC-03 | Acceso y 2FA; roles; el asistente de 9 pasos; estados; consejo de redacción (crear, tareas del equipo, mis pendientes, escribir una tarea); borradores de IA; portada y plantillas; boletín; problemas frecuentes; glosario | Seguir el manual con una cuenta de prueba: debe poder crearse y publicarse una nota |
| **Manual de administración** | CG-DOC-04 | Personas, roles y permisos; configuración del sitio; IA (claves y límites); correo (Resend); analítica; anuncios; API; tareas por frecuencia | Seguir el manual con una cuenta de administrador |
| **Credenciales y contraseñas** | CG-DOC-07 | Inventario de 13 servicios/cuentas y de los secretos (solo nombres); procedimiento de entrega segura con bóveda y doble custodia; acta firmable con verificación por servicio y rotación posterior | Revisar el acta firmada y comprobar el acceso de FEDEGÁN a cada servicio |
| **Capacitación diferenciada** | CG-DOC-08 | Tres perfiles con objetivos medibles, temario con tiempos, 9 ejercicios con criterio de aceptación, guías rápidas, calendario, formatos de asistencia, evaluación y acta, e indicadores | Revisar los registros de asistencia, evaluaciones y acta de cada sesión realizada |

# 4. Estado de cumplimiento de la obligación (honesto)

| Componente | Estado | Qué falta |
|---|---|---|
| Documentación de base de datos | **Completa** | Nada del lado del contratista. Pendiente solo la aprobación de FEDEGÁN |
| Documentación técnica (arquitectura, seguridad, operación) | **Completa** | Aprobación de FEDEGÁN; confirmar los puntos marcados «a confirmar» (plan de Vercel y Supabase, reglas del Firewall, respaldos) |
| Manual editorial | **Completo** | Aprobación de FEDEGÁN; se actualiza si cambia la interfaz |
| Manual de administración | **Completo** | Aprobación de FEDEGÁN |
| Credenciales y contraseñas | **Inventario y acta completos; entrega pendiente** | La **entrega efectiva** de las credenciales exige a FEDEGÁN: bóveda, dos custodios y transferencia de titularidad de Vercel, Supabase y GitHub; después, rotación por el contratista y firma del acta (CG-DOC-07) |
| Capacitación | **Plan, materiales y formatos completos; sesiones por realizar** | Programar y dictar las sesiones con los participantes que designe FEDEGÁN y firmar los registros (CG-DOC-08 §8–9) |

**La obligación pasa al 100 % cuando se cumplan los dos pendientes que dependen de acciones presenciales y de FEDEGÁN**: la entrega firmada de credenciales y las tres capacitaciones registradas. Lo demás está entregado.

# 5. Control de versiones del paquete

| Versión | Fecha | Cambio | Elaboró |
|---|---|---|---|
| 1.0 | 19/10/2026 | Emisión inicial del paquete de nueve documentos | OpenView Consultant |

**Integridad.** Junto a los PDF se entrega el archivo `HUELLAS_SHA256.txt` con la huella SHA-256 de cada documento. Para verificar que un PDF no fue alterado: `shasum -a 256 -c HUELLAS_SHA256.txt` en la carpeta del paquete.

**Fuente editable.** Cada documento existe también como archivo Markdown versionado en el repositorio (`docs/obligacion-19/`), de modo que sus cambios quedan en el historial de Git. El diccionario de datos se regenera con `npm run docs:bd` y los PDF con `node scripts/docs-pdf.mjs`.

**Mantenimiento.** Los documentos se revisan al menos una vez al año y ante cambios mayores (nuevo módulo, cambio de proveedor, cambio de plantilla de seguridad). Cada revisión aumenta la versión y deja una fila en esta tabla.

# 6. Documentos de apoyo existentes en el repositorio

`docs/ARQUITECTURA.md`, `docs/auditoria-acoplamiento.md`, `docs/base-de-datos.md`, `docs/seguridad.md`, `docs/consejo-de-redaccion.md`, `docs/migracion-sitio-anterior.md`, `docs/validacion-migracion-2026-10-19.md`, `docs/medicion-core-web-vitals.md`, `docs/E-01-diagnostico-arquitectura-plan.md`, `docs/E-02-prototipos/`, `docs/cumplimiento-contrato.md` y `docs/informe-obligaciones-contratista-2026-10-18.md`.
