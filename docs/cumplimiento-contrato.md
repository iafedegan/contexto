# Cumplimiento: obligaciones y propuesta vs. lo construido (CONtexto Ganadero)

Fecha de la revisión: 5 de octubre de 2026 (semana 3 de las 6 de construcción; el cronograma ubica hoy E-02 → E-03).
Fuentes: `Obligaciones_Contratista_Contexto_Ganadero.xlsx`, `Propuesta_OpenView_ContextoGanadero.pdf` (OV-PRO-FDG-001 v1.0) y `Cronograma_OpenView_FEDEGAN_ContextoGanadero.xlsx`.
Método: se contrastó cada obligación con el código del repositorio (rutas, esquema, acciones, configuración). Leyenda: ✅ cumple · 🟡 parcial · ❌ no construido · ⏳ no vence todavía · ⚪ no verificable desde el código.

| # | Obligación | Estado | Evidencia / brecha |
|---|---|---|---|
| 1 | Diagnóstico, diseño y arquitectura | 🟡 | `docs/ARQUITECTURA.md`, diagramas y auditoría de acoplamiento. Falta el documento formal de diagnóstico y plan de trabajo (E-01). |
| 2 | UX/UI responsive y sistema de diseño | 🟡 | Sistema de diseño en código (tokens, plantillas, componentes), móvil primero. Faltan los prototipos navegables (E-02) y no hay medición de accesibilidad. |
| 3 | Navegación, categorías, autores, búsqueda | ✅ | Menú, secciones, autor, filtros y paginación, buscador unificado con el archivo, sugerencias (`/api/sugerencias`), miga estructurada (JSON-LD). |
| 4 | CMS / panel editorial | ✅ | Roles (redactor, editor, administrador) con permisos individuales, borradores, programación, vista previa real, asistente de redacción, auditoría SEO en vivo, 2FA obligatorio. |
| 5 | Plantillas y componentes | 🟡 | Home, categoría, artículo, autor, tarjetas, hero, última hora, relacionados, gráficas. Sin plantilla de «especiales» ni de TV. Radio: hay reproductor, pero la propuesta la excluyó. |
| 6 | Publicidad | ✅ | Zonas configurables (`ads_zones`) con editor, etiqueta «Publicidad» y carga diferida. |
| 7 | SEO técnico | ✅ | Sitemap, news-sitemap, robots, canonical, NewsArticle y breadcrumbs JSON-LD, Open Graph, Twitter Cards, RSS por sitio y por sección. |
| 8 | Migración del archivo (≈41.000) | ❌ | Solo existe la indexación de solo lectura (`archive_index`, E-05). No hay proceso que traslade los artículos al modelo nuevo. Es la brecha entre el TDR y la propuesta. |
| 9 | Migración progresiva por lotes | ⏳ ❌ | E-11 no está construido (corre 20/11/2026 → 18/02/2027). |
| 10 | Validación e integridad de la migración | ⏳ ❌ | Depende de 8-9. |
| 11 | Core Web Vitals (LCP 2,5 s, Lighthouse 90) | ⚪ | Hay integración con PageSpeed, pero no hay mediciones registradas. Hay que medir antes del 20/11. |
| 12 | Seguridad, disponibilidad, observabilidad | 🟡 | (Actualizado el 6/10 tras la auditoría de seguridad: `docs/seguridad.md`.) HSTS y cabeceras; **CSP obligatoria en producción**; Turnstile; 2FA obligatorio con código de un solo uso; passkeys con verificación del usuario; claves distintas por propósito; límites en todos los endpoints públicos; protección SSRF; saneado de HTML y anuncios aislados en `iframe` con sandbox; endpoint `/api/health`; retención de datos de suscriptores. Falta el monitoreo/alertas externos (no hay Sentry ni similar) y configurar el Firewall de Vercel (`docs/seguridad.md`, apartado 3). |
| 13 | Funcionalidades modernas | ✅ | PWA instalable (manifest, `sw.js`, `/offline`), boletín. Extras no pedidos por la propuesta: push, «En vivo», modo oscuro, radio. |
| 14 | Analítica | 🟡 | GA4 y GTM configurables desde el panel, verificación de Search Console por meta, tableros (Resumen, Demanda). Sin tablero de Search Console ni reportes programados. |
| 15 | IA: asistente y agentes | ✅ | Asistente con citación obligatoria y rechazo sin fuentes, tablero de demanda, tope por sesión y presupuesto mensual. Agentes que generan borradores desde fuentes estructuradas a una cola de aprobación. |
| 16 | Gobernanza de IA | ✅ | Aprobación humana (`approved_by/at`), trazabilidad (fuente, versión del modelo), verificador de cifras (`fact-checker`) y verificación de cifras y citas en el asistente de notas. **Corregido el 5/10:** tope diario de borradores configurable desde el panel (existía por variable de entorno; mi revisión inicial lo pasó por alto), página pública `/politica-de-ia` en el menú institucional y firma de la nota con la ficha del editor que aprueba. |
| 17 | Infraestructura y ambientes | 🟡 | Vercel + Supabase, despliegue continuo (GitHub → Vercel, CI con lint, tipos y build). Pendiente: transferencia de cuentas a FEDEGÁN (HT-6) y ambiente de pruebas formal. |
| 18 | Pruebas y criterios de aceptación | 🟡 | **Actualizado el 6/10:** más de 150 pruebas automatizadas (`npm test`, también en CI) con una base PGlite en memoria —permisos, 2FA, passkeys, claves, boletín, programación, archivo histórico, búsqueda, medios, esquema contra migraciones, arquitectura y documentación—, una **prueba de humo de extremo a extremo** por HTTP (`npm run smoke`, en CI tras la compilación) y `npm audit` de producción en CI. Faltan las pruebas con navegador (Playwright) y el acta de aceptación. |
| 19 | Documentación, capacitación, transferencia | 🟡 | **Corregido el 5/10:** `docs/ARQUITECTURA.md`, `docs/base-de-datos.md` (generado del esquema), `docs/manual-editorial.md` y `docs/manual-administracion.md`. Faltan la capacitación presencial y la entrega de credenciales (HT-6). |
| 20 | Código y propiedad intelectual | ✅ | Código propio sin licencias de terceros; la transferencia se hace en HT-6. |
| 21 | Cumplimiento del cronograma | ✅ | En funcionalidad vamos adelante: E-03 a E-09 están construidos en lo esencial. Atrasado en entregables formales (E-01, E-02, E-10). |
| 22 | Garantía y estabilización | ⏳ | Corre desde el 20/11/2026. |
| 23 | Monitoreo posterior (agentes de SEO, analítica y caché) | ⏳ ❌ | No existen esos tres agentes; arrancan al cierre de la estabilización (19/01/2027). |
| 24 | Integración con Portal FEDEGÁN y SuperApp (identidad unificada) | ❌ | Nada construido. **No está en la propuesta de OpenView** (la fila no tiene número en el Excel): es un riesgo contractual si se exige. |

## Lo que más urge (por fecha de entrega)
1. **Documentos formales E-01 y E-02** (diagnóstico, plan de trabajo, prototipos navegables) — vencían el 28/09 y el 05/10.
2. **Medir Core Web Vitals y Lighthouse** y dejar evidencia — son criterio de aceptación de HT-5.
3. ~~Pasar la CSP de «solo reporte» a obligatoria~~ (hecho el 6/10); queda poner monitoreo de errores y disponibilidad (E-07) y las reglas del Firewall de Vercel.
4. **Pruebas con navegador (Playwright)** de los flujos críticos y acta de pruebas (E-10, HT-6); las pruebas automáticas por HTTP y de integración ya existen.
5. **Documentación y manuales** (base de datos, editorial, administración) y plan de capacitación (E-10).
6. **Gobernanza de IA incompleta:** página de política de uso de IA, límite diario de borradores y comprobar la firma humana (sección 6.3).
7. **E-11 (migración progresiva)** y los **agentes de monitoreo**: diseñar ahora, ejecutar tras el 20/11.
8. **Aclarar el punto 24** con FEDEGÁN: no está en la propuesta.

## Cosas a vigilar
- El Excel del cronograma incluye también el proyecto «FEDEGÁN Portal» (SSO Entra ID, CIAM, WCAG 2.1 AA, GTM/GA4, SEO tooling, automatizaciones de IA). Ese proyecto **no está en este repositorio**.
- La propuesta excluye push, modo oscuro, Twitter Cards y emisora; se construyeron igualmente. No incumple, pero aumenta la superficie de mantenimiento y conviene reflejarlo en la matriz contractual definitiva.
- Disponibilidad (99,5 %) y rendimiento dependen de Vercel/Supabase y de la configuración del plan; el límite de almacenamiento de funciones ya está alto (7,94 de 10 GB).
