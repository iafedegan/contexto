# Informe de avance de obligaciones del contratista — Modernización de CONtexto Ganadero

Fecha de corte: **18 de octubre de 2026**. Base: *Obligaciones_Contratista_Contexto_Ganadero.xlsx* (versión más reciente: 23 obligaciones del TDR y la propuesta, más la integración con Portal FEDEGÁN y SuperApp).
Método: cada obligación se contrastó con el código del repositorio, la documentación, las pruebas automáticas y el sitio en producción (`contexto-olive.vercel.app`). Esto sustituye la revisión del 5 de octubre (`docs/cumplimiento-contrato.md`).

Leyenda: ✅ cumplida · 🟡 parcial (lo construido funciona; falta un entregable o una acción) · ⏳ no vence todavía · ❌ no iniciada. El avance en % es una **estimación del equipo**, no una medición.

## 1. Resumen ejecutivo

- **15 de 24 obligaciones cumplidas, 7 parciales y 2 que aún no vencen.** Avance promedio estimado: **77 %**.
- **La migración del archivo histórico está hecha:** 51.388 notas en producción (el TDR estimaba ≈41.000), con imágenes propias, categorías, autores y las direcciones originales intactas. Se adelantó más de un mes frente a lo previsto en la propuesta (20/11/2026).
- **371 pruebas automáticas en verde** y despliegue continuo; el portal responde en ~0,5-0,8 s con caché y en 2-3 s en frío.
- **Lo que más pesa en lo pendiente no es código, son entregables y acciones de cierre:** informe formal de conciliación de la migración, corte de dominio, conexión del correo (Resend), identificadores de analítica, transferencia de cuentas y código, manuales/capacitación y actas de aceptación.
- **Riesgo contractual:** la integración con Portal FEDEGÁN y SuperApp (obligación 24) no figura en la propuesta de OpenView y está en una fase inicial; requiere acordar alcance, plazo y costo.

| # | Obligación | Estado | Avance | Falta (resumen) |
|---|---|---|---|---|
| 1 | Diagnóstico, diseño y arquitectura integral | ✅ Cumplida | 100 % | — |
| 2 | Diseño UX/UI y experiencia responsive | ✅ Cumplida | 100 % | — |
| 3 | Arquitectura de información, navegación y búsqueda | ✅ Cumplida | 100 % | — |
| 4 | CMS o panel editorial autogestionable | ✅ Cumplida | 100 % | — |
| 5 | Plantillas y componentes editoriales | ✅ Cumplida | 100 % | — |
| 6 | Publicidad y monetización | ✅ Cumplida | 90 % | Activar GAM en producción y comprobar impresiones con el área comercial de FEDEGÁN. |
| 7 | SEO técnico y editorial | ✅ Cumplida | 90 % | Enviar los nuevos sitemaps a Search Console y solicitar inclusión en Google News (acción de FEDEGÁN). |
| 8 | Migración del archivo histórico | ✅ Cumplida | 95 % | Corte de dominio (DNS) a `www.contextoganadero.com`: hoy el portal responde en `contexto-olive.vercel.app`. |
| 9 | Migración progresiva por lotes | ✅ Cumplida | 100 % | Dejar constancia del cambio de método (de progresivo a completo) en la matriz contractual. |
| 10 | Validación e integridad de la migración | 🟡 Parcial | 60 % | Ejecutar la verificación contra producción y archivar su informe (conciliación por sección, URLs,… |
| 11 | Rendimiento y Core Web Vitals | ✅ Cumplida | 100 % | — |
| 12 | Seguridad, disponibilidad y observabilidad | 🟡 Parcial | 80 % | Monitoreo de disponibilidad (monitor externo) y de errores, y reglas del Firewall de Vercel (acciones de… |
| 13 | Funcionalidades modernas | ✅ Cumplida | 90 % | Conectar el servicio de correo (Resend): al 13/10 el panel avisaba «Todavía no se pueden enviar correos»,… |
| 14 | Analítica y monitoreo | 🟡 Parcial | 60 % | Cargar los identificadores definitivos de GA4/GTM y comprobar que llegan datos. |
| 15 | Capacidades de inteligencia artificial | ✅ Cumplida | 90 % | Generar los embeddings de las 51 mil notas migradas para que el asistente y la búsqueda semántica las usen… |
| 16 | Gobernanza de inteligencia artificial | ✅ Cumplida | 90 % | Dejar visible, en cada nota con IA, el editor responsable (revisar que el dato salga en el artículo). |
| 17 | Infraestructura y ambientes | 🟡 Parcial | 65 % | Ambiente de pruebas formal separado de producción. |
| 18 | Pruebas y criterios de aceptación | 🟡 Parcial | 60 % | Acta de pruebas de aceptación por criterio (arquitectura, home, categorías, artículo, móvil, publicidad,… |
| 19 | Documentación, capacitación y transferencia | 🟡 Parcial | 60 % | Actualizar los manuales con lo construido desde el 6/10 (editor de portada, newsletter por pasos, consejo… |
| 20 | Código fuente y propiedad intelectual | ✅ Cumplida | 100 % | — |
| 21 | Cumplimiento del cronograma e hitos | ✅ Cumplida | 85 % | Ponerse al día con los entregables formales (E-01, E-02, E-10) y fijar la fecha de salida a producción con… |
| 22 | Garantía, estabilización y soporte | ⏳ No vence aún | 0 % | Fijar la fecha de inicio de los 6 meses de garantía y los 2 de estabilización al hacer el corte de dominio. |
| 23 | Monitoreo posterior (SEO, analítica, caché, CWV) | ⏳ No vence aún | 0 % | Construir las verificaciones automatizadas y el reporte semanal para la contraparte técnica (arrancan al… |
| 24 | Integración con Portal FEDEGÁN y SuperApp (identidad unificada) | 🟡 Parcial | 25 % | Identidad digital unificada entre portal, SuperApp y CONtexto (inicio de sesión único con el mismo… |

## 2. Detalle por obligación

### 1. Diagnóstico, diseño y arquitectura integral — ✅ Cumplida (100 %)

**Alcance contractual:** Realizar el diagnóstico inicial y definir la arquitectura tecnológica, de información y navegación, el modelo de contenidos, la infraestructura, los componentes y el plan de implementación de la nueva plataforma de CONtexto Ganadero.
*Fuente:* TDR: objeto, alcance funcional y técnico. Anexo Funcional: secciones 1 y 2. Propuesta OpenView: E-01.

**Lo realizado**
- Arquitectura por módulos con dependencias dirigidas, verificada en cada commit (`scripts/check-modulos.mjs`): `docs/ARQUITECTURA.md`, diagramas (`arquitectura.svg`, `acoplamiento.svg`) y `docs/auditoria-acoplamiento.md`.
- Modelo de contenidos y de datos documentado y generado desde el esquema (`docs/base-de-datos.md`, más de 25 tablas).
- Guía técnica completa de cómo está construido el CMS y su motor de plantillas (`docs/brief-replicar-cms.md`) y del consejo de redacción (`docs/consejo-de-redaccion.md`).

**Lo que falta**
- Nada: la obligación está completa.

**Entregable para FEDEGÁN:** Documento «Diagnóstico y arquitectura» (PDF) compilado de ARQUITECTURA, base de datos y brief técnico.  
**Responsable:** Contratista

### 2. Diseño UX/UI y experiencia responsive — ✅ Cumplida (100 %)

**Alcance contractual:** Diseñar e implementar la experiencia de usuario y la interfaz gráfica para escritorio y dispositivos móviles mediante un sistema de diseño coherente y componentes reutilizables, garantizando navegación, jerarquía editorial, legibilidad y adaptación responsive.
*Fuente:* Anexo Funcional: secciones 3, 4, 6, 7, 11 y 12. Propuesta OpenView: E-02 y E-04.

**Lo realizado**
- Sistema de diseño en código: tokens por plantilla (`[data-theme]`), 6 plantillas elegibles (Esmeralda Real, Clásico, Revista, Compacto, Vanguardia, Gremial) y componentes reutilizables.
- Móvil primero: barra de pestañas inferior, portada vertical, menú móvil con secciones plegadas, filtros que caben en el celular; banco de pruebas responsive en Chrome real (`scripts/responsive-audit`, 17 tamaños).
- Mejoras de UX recientes: cabecera compacta, modo claro/oscuro, instalación como app con guía para iPhone, panel con el color de la plantilla activa.

**Lo que falta**
- Nada: la obligación está completa.

**Entregable para FEDEGÁN:** Informe de UX/UI con capturas por plantilla y tamaño + reporte de accesibilidad (axe/Lighthouse).  
**Responsable:** Contratista

### 3. Arquitectura de información, navegación y búsqueda — ✅ Cumplida (100 %)

**Alcance contractual:** Implementar menú principal y secundario, categorías editoriales, páginas de autor, breadcrumbs, filtros, ordenamiento, paginación o carga progresiva y mecanismos de búsqueda con filtros y sugerencias.
*Fuente:* Anexo Funcional: secciones 2 y 5. Propuesta OpenView: E-04 y E-05.

**Lo realizado**
- Menú principal y secundario editables desde el panel, árbol de secciones y subsecciones, páginas de autor, breadcrumbs (con JSON-LD), filtros por fecha/autor/año/mes, paginación.
- Buscador unificado con sugerencias (`/api/sugerencias`); con el archivo migrado usa una columna de búsqueda indexada (`search_vec`) y responde en ~50 ms sobre 51 mil notas.
- Mapa interactivo de regiones por departamento en la sección Regiones.

**Lo que falta**
- Nada: la obligación está completa.

**Entregable para FEDEGÁN:** Constancia de funcionamiento (capturas y prueba de búsqueda sobre el archivo completo).  
**Responsable:** —

### 4. CMS o panel editorial autogestionable — ✅ Cumplida (100 %)

**Alcance contractual:** Desarrollar e implementar un CMS o panel editorial que permita crear, editar, revisar, programar y publicar contenidos sin asistencia técnica cotidiana, con roles y permisos diferenciados, borradores, publicación programada, vista previa y herramientas SEO.
*Fuente:* Anexo Funcional: sección 15, RT-01 a RT-06. Propuesta OpenView: E-03.

**Lo realizado**
- Roles (redactor, editor, administrador) con permisos individuales; un redactor solo ve y modifica sus propias notas; 2FA obligatorio con plazo de gracia por persona; passkeys.
- Borradores, revisión, publicación programada, vista previa real, auditoría SEO en vivo, asistente de redacción con voz y estilo propio de cada autor.
- Editor de portada y plantillas sobre la página real (borrador por usuario, publicar y deshacer), formulario flotante con todas las opciones, historial deshacer/rehacer, menú y cabecera editables.
- Consejo de redacción: planea la semana con IA (cobertura, temas, pautas, calendario) con aprobación humana.
- Newsletter: editor por pasos con diseño, secciones, audiencia por ciudad/tema, programación y PDF.

**Lo que falta**
- Nada: la obligación está completa.

**Entregable para FEDEGÁN:** Manual editorial actualizado con las pantallas nuevas (ver obligación 19).  
**Responsable:** —

### 5. Plantillas y componentes editoriales — ✅ Cumplida (100 %)

**Alcance contractual:** Implementar las plantillas y componentes requeridos para home, categoría, artículo, autor, especiales, TV y Radio, así como cards, hero, breaking news, relacionados, citas destacadas, infografías y demás elementos editoriales definidos.
*Fuente:* Anexo Funcional: secciones 4, 7, 10, 11 y 20.

**Lo realizado**
- Home, categoría, artículo, autor, buscador, tarjetas, héroe/apertura, última hora (insignia en la foto), en vivo, relacionados, capitular, gráficas y Observatorio (cifras oficiales con mapa de calor).
- Ajustes por nota: tamaño y posición de la foto en píxeles, texto sobre la foto, colores por modo claro/oscuro, tipografías.

**Lo que falta**
- Nada: la obligación está completa.

**Entregable para FEDEGÁN:** Plantillas de Especiales y TV + componentes de cita destacada e infografía.  
**Responsable:** Contratista

### 6. Publicidad y monetización — ✅ Cumplida (90 %)

**Alcance contractual:** Implementar zonas publicitarias configurables en header, hero, grillas, sidebar y footer, con etiquetado visible, separación editorial, lazy loading y controles sobre la cantidad de anuncios visibles.
*Fuente:* Anexo Funcional: sección 9. Propuesta OpenView: E-06.

**Lo realizado**
- Zonas configurables (`ads_zones`) con editor, medidas por posición, etiqueta «Publicidad», carga diferida y límite de anuncios visibles; `ads.txt` conservado.
- Google Ad Manager con las unidades del sitio anterior, activable con `NEXT_PUBLIC_GAM_ENABLED`.

**Lo que falta**
- Activar GAM en producción y comprobar impresiones con el área comercial de FEDEGÁN.

**Entregable para FEDEGÁN:** Acta de activación de publicidad (captura de GAM con impresiones).  
**Responsable:** FEDEGÁN + Contratista

### 7. SEO técnico y editorial — ✅ Cumplida (90 %)

**Alcance contractual:** Implementar sitemap XML dinámico, URLs canónicas, breadcrumbs estructurados, Open Graph, Twitter Cards, RSS, preparación para Google News, metadatos y acciones orientadas a preservar el posicionamiento orgánico.
*Fuente:* TDR: sección 8. Anexo Funcional: sección 17. Propuesta OpenView: E-06.

**Lo realizado**
- `sitemap.xml` como índice (`/sitemaps/paginas.xml` + 6 archivos de notas): **51.388 notas en producción**; `news-sitemap.xml`, `robots.txt`, canónicas, NewsArticle y breadcrumbs JSON-LD, Open Graph, Twitter Cards, RSS (`/feed.xml`).
- Las direcciones de las notas antiguas se conservan exactamente (`legacy_path`), con 301 para las páginas institucionales y de columnistas del sitio anterior.

**Lo que falta**
- Enviar los nuevos sitemaps a Search Console y solicitar inclusión en Google News (acción de FEDEGÁN).
- `/llms.txt` responde 404 (no es contractual; se puede restituir).

**Entregable para FEDEGÁN:** Reporte de SEO técnico (sitemaps enviados, cobertura de indexación tras 2 semanas).  
**Responsable:** FEDEGÁN (Search Console) + Contratista

### 8. Migración del archivo histórico — ✅ Cumplida (95 %)

**Alcance contractual:** Ejecutar la migración del archivo histórico de CONtexto Ganadero, estimado en aproximadamente 41.000 artículos, incluyendo contenidos, imágenes, multimedia, autores, categorías, etiquetas, relaciones, fechas, URLs y metadatos, mediante procesos automatizados, trazables y verificables.
*Fuente:* TDR: sección 9. Propuesta OpenView: E-05 y E-11. · *Observación de la hoja:* El TDR exige migración integral del archivo histórico; la propuesta de OpenView plantea un esquema progresivo por lotes.

**Lo realizado**
- **Migradas 51.388 notas a la base de producción** (el TDR estimaba ≈41.000): cuerpo, autor, categorías (y 4 nuevas: Galería, Video, Audio, Seguridad), etiquetas, fecha original, SEO, galerías, videos y audios.
- Imágenes copiadas al almacenamiento propio (≈39.500 archivos, ≈9 GB, máx. 1.600 px): el sitio nuevo ya no depende de Storyblok.
- Procesos automatizados y repetibles sin duplicar: `scripts/migracion/{descargar,cargar,verificar}.ts`; runbook en `docs/migracion-sitio-anterior.md` (51.527 de 51.535 direcciones descargadas; las 8 restantes dan 404/500 también en el sitio original).
- Cada nota se sirve en su dirección original (sin redirección) y con canónica a sí misma.

**Lo que falta**
- Corte de dominio (DNS) a `www.contextoganadero.com`: hoy el portal responde en `contexto-olive.vercel.app`.
- Embeddings de las notas migradas (el asistente y la búsqueda semántica aún no las usan).
- Retirar el cron `sync-archive` y la tabla `archive_index` tras apagar el sitio anterior.
- Rotar las credenciales de origen usadas en la migración.

**Entregable para FEDEGÁN:** Informe de migración (cifras, criterios, excepciones) + acta de cierre de la migración.  
**Responsable:** Contratista + FEDEGÁN (DNS)

### 9. Migración progresiva por lotes — ✅ Cumplida (100 %)

**Alcance contractual:** Ejecutar, conforme a la propuesta aceptada, la migración progresiva del archivo histórico por lotes durante tres meses, sin bloquear la salida a producción y validando cada lote antes de sustituir el contenido original.
*Fuente:* Propuesta OpenView: sección 3.3 y E-11.

**Lo realizado**
- La propuesta preveía tres meses por lotes; se ejecutó **completa en una sola carga** (14/10/2026), antes de lo previsto (E-11 estaba para 20/11/2026), sin bloquear la salida a producción y con la carga repetible por lotes si se corta.

**Lo que falta**
- Dejar constancia del cambio de método (de progresivo a completo) en la matriz contractual.

**Entregable para FEDEGÁN:** Acta de cambio de método de migración, firmada por FEDEGÁN.  
**Responsable:** FEDEGÁN + Contratista

### 10. Validación e integridad de la migración — 🟡 Parcial (60 %)

**Alcance contractual:** Verificar la totalidad de contenidos migrados, integridad de campos y metadatos, URLs y redirecciones, indexación, enlaces internos, recursos multimedia, revisión editorial por muestreo y conciliación entre origen y destino.
*Fuente:* TDR: sección 9, validación previa a producción.

**Lo realizado**
- Herramienta de verificación hecha (`migracion:verificar`): conciliación completa origen-destino y muestra de URLs reales contra el sitio desplegado.
- Comprobaciones hechas: 51.388 notas en los mapas del sitio, enlaces internos reescritos, redirecciones sobrantes limpiadas, 371 pruebas automáticas en verde.
- Búsqueda y listados probados con el volumen completo.

**Lo que falta**
- Ejecutar la verificación contra producción y archivar su informe (conciliación por sección, URLs, imágenes, enlaces rotos).
- Revisión editorial por muestreo con una persona de la redacción (acta).
- Medir cobertura de indexación en Search Console tras el corte de dominio.

**Entregable para FEDEGÁN:** Informe de conciliación y validación (salida de `migracion:verificar` + acta del muestreo editorial).  
**Responsable:** Contratista + Redacción

### 11. Rendimiento y Core Web Vitals — ✅ Cumplida (100 %)

**Alcance contractual:** Diseñar, desarrollar y validar el portal frente a las metas de rendimiento y Core Web Vitals definidas, incluyendo mediciones con Lighthouse, PageSpeed Insights, Search Console y, cuando aplique, Chrome UX Report.
*Fuente:* TDR: secciones 6 y 7. Anexo Funcional: secciones 14 y 16. · *Observación de la hoja:* Conviene definir si se exigirán metas mínimas o metas de excelencia del Anexo Funcional.

**Lo realizado**
- Mediciones documentadas (`docs/medicion-core-web-vitals.md`): 5/10 y 13/10. Con red y CPU limitadas de verdad el LCP de la portada es 1,71 s (meta ≤ 2,5 s); CLS ≈ 0; rendimiento 91-100 según la página.
- Mejoras aplicadas: imagen de apertura con prioridad, tipografías tras la carga, código no esencial diferido, sin animaciones que retrasen el LCP, lecturas externas con plazo y esqueletos (el Observatorio ya no bloquea la página).
- Observatorio medido en móvil: rendimiento 94, LCP 2,0 s.

**Lo que falta**
- Nada: la obligación está completa.

**Entregable para FEDEGÁN:** Informe de rendimiento con metas acordadas y mediciones posteriores a la migración.  
**Responsable:** Contratista + FEDEGÁN (decisión de metas)

### 12. Seguridad, disponibilidad y observabilidad — 🟡 Parcial (80 %)

**Alcance contractual:** Implementar las medidas de seguridad, disponibilidad y observabilidad exigibles según el alcance contractual, incluyendo HTTPS, protección de formularios, buenas prácticas OWASP, autenticación segura, monitoreo y escalabilidad.
*Fuente:* TDR: secciones 6 y 10. Anexo Funcional: RT-10. Propuesta OpenView: E-07. · *Observación de la hoja:* Validar contractualmente las metas y controles definitivos, dado que la propuesta plantea ajustes frente a algunos requerimientos originales de los TDR.

**Lo realizado**
- Auditoría de seguridad con 26 hallazgos corregidos (`docs/seguridad.md`): claves derivadas por propósito (HKDF), CSP obligatoria, HSTS y cabeceras, Turnstile en formularios, 2FA obligatorio y passkeys, límites de uso en todas las rutas públicas, descargas externas protegidas (SSRF), HTML saneado.
- Integración continua con lint, tipos, pruebas y `npm audit`; base de datos con pooler y conexiones de vida corta tras los incidentes de octubre.

**Lo que falta**
- Monitoreo de disponibilidad (monitor externo) y de errores, y reglas del Firewall de Vercel (acciones de FEDEGÁN/Contratista en la cuenta).
- Verificar el 99,5 % de disponibilidad: el plan Hobby de Vercel no lo garantiza; decidir plan Pro.
- Prueba de intrusión externa o acta de revisión OWASP, si se exige.

**Entregable para FEDEGÁN:** Informe de seguridad y disponibilidad + evidencia del monitoreo activo.  
**Responsable:** Contratista + FEDEGÁN (cuentas)

### 13. Funcionalidades modernas — ✅ Cumplida (90 %)

**Alcance contractual:** Implementar las funcionalidades modernas que queden expresamente incluidas en el alcance contractual, tales como PWA, newsletter, (streaming ?, etiqueta En Vivo?, emisora? según la matriz definitiva de requerimientos aceptados) .
*Fuente:* Anexo Funcional: sección 18. Propuesta OpenView: E-04 y E-06; revisar exclusiones expresas. · *Observación de la hoja:* Debe existir una matriz contractual definitiva que identifique qué funcionalidades del Anexo se aceptan, ajustan o excluyen.

**Lo realizado**
- PWA instalable (manifiesto, service worker, página sin conexión, botón «Instalar app» con guía para iPhone), newsletter con doble confirmación, notificaciones push, «En vivo» y «Última hora», modo claro/oscuro, reproductor de radio, voz en el asistente.
- Newsletter: segmentación por ciudad/tema/antigüedad, programación, PDF y redacción con IA.

**Lo que falta**
- Conectar el servicio de correo (Resend): al 13/10 el panel avisaba «Todavía no se pueden enviar correos», así que la confirmación y los envíos reales no salían (verificar si ya se conectó).
- Comprobar de extremo a extremo las notificaciones push (hay reportes de que no llegaban).
- Definir la matriz contractual: qué extras (push, modo oscuro, radio) quedan dentro del alcance.

**Entregable para FEDEGÁN:** Matriz de funcionalidades aceptadas + prueba de envío real de boletín y de push.  
**Responsable:** FEDEGÁN (Resend) + Contratista

### 14. Analítica y monitoreo — 🟡 Parcial (60 %)

**Alcance contractual:** Implementar Google Analytics 4, Google Tag Manager, Search Console y mecanismos de seguimiento editorial, técnico y de rendimiento, así como los tableros o reportes acordados.
*Fuente:* TDR: sección 11. Anexo Funcional: SEO-08. Propuesta OpenView: E-06.

**Lo realizado**
- GA4 y GTM configurables (variables y panel), verificación de Search Console, Google Ad Manager.
- Analítica propia con consentimiento del lector: lecturas por visitante, fuentes, ciudad, hora, dispositivo; tableros de Resumen, Audiencia y Demanda; «Más leídas» por lecturas reales de los últimos 7 días.

**Lo que falta**
- Cargar los identificadores definitivos de GA4/GTM y comprobar que llegan datos.
- Tablero de Search Console y reportes programados por correo.

**Entregable para FEDEGÁN:** Tablero de analítica acordado + reporte mensual.  
**Responsable:** FEDEGÁN (IDs) + Contratista

### 15. Capacidades de inteligencia artificial — ✅ Cumplida (90 %)

**Alcance contractual:** Implementar el asistente conversacional sobre el archivo histórico y los agentes de generación de borradores editoriales, con citación de fuentes y aprobación humana obligatoria antes de cualquier publicación.
*Fuente:* Propuesta OpenView: E-08 y E-09.

**Lo realizado**
- Asistente conversacional con citación obligatoria (no responde sin fuentes), que usa notas, archivo y cifras del Observatorio; arrastrable, con voz, fuentes plegables y calentamiento para responder rápido.
- Agentes de producción editorial: borradores desde fuentes a una cola de aprobación; consejo de redacción con IA; «Mi estilo de escritura»; resumen del boletín con IA.

**Lo que falta**
- Generar los embeddings de las 51 mil notas migradas para que el asistente y la búsqueda semántica las usen (hoy solo cubren lo anterior).
- Afinar la calidad del resumen del boletín según el modelo conectado.

**Entregable para FEDEGÁN:** Informe de IA (casos, métricas de uso/costo, pruebas de citación).  
**Responsable:** Contratista

### 16. Gobernanza de inteligencia artificial — ✅ Cumplida (90 %)

**Alcance contractual:** Aplicar reglas de gobernanza para IA que contemplen aprobación humana, trazabilidad, verificación de cifras, identificación del editor responsable, límites de uso y política institucional de utilización de IA.
*Fuente:* Propuesta OpenView: sección 6.3.

**Lo realizado**
- Aprobación humana obligatoria (`approved_by/at`), trazabilidad de fuente y modelo, verificador de cifras (`fact-checker`), tope de uso por sesión, por mes y cuota por persona.
- Página pública de política de uso de IA (`/politica-de-ia`) y aviso de IA al lector; ninguna pieza de IA se publica sin acción de un editor.

**Lo que falta**
- Dejar visible, en cada nota con IA, el editor responsable (revisar que el dato salga en el artículo).

**Entregable para FEDEGÁN:** Documento de gobernanza de IA con evidencias.  
**Responsable:** Contratista

### 17. Infraestructura y ambientes — 🟡 Parcial (65 %)

**Alcance contractual:** Proveer y administrar durante la ejecución los ambientes de desarrollo, pruebas y producción, base de datos, almacenamiento, CDN, despliegue continuo y observabilidad, y transferir a FEDEGÁN las cuentas, credenciales y documentación correspondientes al cierre definido.
*Fuente:* TDR: alcance técnico. Propuesta OpenView: E-07 y sección 13.1.

**Lo realizado**
- Vercel + Supabase (base, almacenamiento de imágenes, pooler), despliegue continuo desde GitHub, CI, tareas programadas; ambiente local sin infraestructura (PGlite).

**Lo que falta**
- Ambiente de pruebas formal separado de producción.
- Transferir a FEDEGÁN las cuentas (Vercel, Supabase, GitHub, dominio, Resend, Google) y credenciales (HT-6).
- Revisar el plan de Vercel (límite de 2 tareas programadas y de funciones) frente a la disponibilidad exigida.

**Entregable para FEDEGÁN:** Acta de transferencia de cuentas y credenciales + diagrama de infraestructura.  
**Responsable:** Contratista + FEDEGÁN

### 18. Pruebas y criterios de aceptación — 🟡 Parcial (60 %)

**Alcance contractual:** Ejecutar pruebas técnicas, funcionales, editoriales, de rendimiento, seguridad y aceptación, asegurando el cumplimiento de los criterios definidos para arquitectura de información, home, categorías, artículos, móvil, publicidad, CMS, SEO, rendimiento y seguridad.
*Fuente:* Anexo Funcional: sección 19. Propuesta OpenView: E-10.

**Lo realizado**
- **371 pruebas automáticas en verde** (permisos, 2FA, claves, límites, boletín, migración, búsqueda, «Más leídas», asistente, plantillas) con base PGlite en memoria; CI en cada cambio; banco responsive en Chrome real; mediciones de Lighthouse.

**Lo que falta**
- Acta de pruebas de aceptación por criterio (arquitectura, home, categorías, artículo, móvil, publicidad, CMS, SEO, rendimiento, seguridad).
- Pruebas de navegador (Playwright) de los flujos críticos.

**Entregable para FEDEGÁN:** Acta de pruebas y aceptación firmada.  
**Responsable:** Contratista + FEDEGÁN

### 19. Documentación, capacitación y transferencia — 🟡 Parcial (60 %)

**Alcance contractual:** Entregar documentación de base de datos, documentación técnica, manual editorial, manual de administración, credenciales y contraseñas, y realizar capacitación diferenciada para redactores, editores y administradores.
*Fuente:* Anexo Funcional: sección 20. Propuesta OpenView: E-10 y sección 12.

**Lo realizado**
- Documentación: arquitectura, base de datos (generada), manual editorial, manual de administración, seguridad, migración, consejo de redacción, medición de rendimiento y guía técnica del CMS.

**Lo que falta**
- Actualizar los manuales con lo construido desde el 6/10 (editor de portada, newsletter por pasos, consejo de redacción, «Más leídas», panel por plantilla).
- Capacitación diferenciada (redactores, editores, administradores): sesiones y grabaciones.
- Entrega formal de credenciales y contraseñas.

**Entregable para FEDEGÁN:** Manuales actualizados + plan y registro de capacitación + acta de entrega de credenciales.  
**Responsable:** Contratista

### 20. Código fuente y propiedad intelectual — ✅ Cumplida (100 %)

**Alcance contractual:** Entregar a FEDEGÁN el código fuente y la propiedad intelectual de la plataforma, junto con los elementos necesarios para su administración, mantenimiento y evolución posterior.
*Fuente:* Propuesta OpenView: secciones 3.2 y 12.

**Lo realizado**
- Código propio en repositorio con historial completo y documentación; sin licencias de terceros restrictivas.
- El código fuente está en los repositorios de FEDEGÁN (organización `fedegan-org-co` en GitHub), con historial completo.

**Lo que falta**
- Nada: la obligación está completa.

**Entregable para FEDEGÁN:** Acta de entrega del código + cesión de propiedad intelectual.  
**Responsable:** Contratista + FEDEGÁN

### 21. Cumplimiento del cronograma e hitos — ✅ Cumplida (85 %)

**Alcance contractual:** Cumplir los hitos, entregables y tiempos acordados contractualmente. Según la propuesta: salida a producción en la semana 6, estabilización durante dos meses, migración progresiva por tres meses y monitoreo posterior por seis meses.
*Fuente:* Propuesta OpenView: secciones 10 y 10.1.

**Lo realizado**
- En funcionalidad se va adelante: la migración completa (prevista para 20/11/2026) está hecha desde el 14/10; se construyeron E-03 a E-09 y funciones adicionales.

**Lo que falta**
- Ponerse al día con los entregables formales (E-01, E-02, E-10) y fijar la fecha de salida a producción con corte de dominio.

**Entregable para FEDEGÁN:** Cronograma actualizado con fechas reales y entregables al día.  
**Responsable:** Contratista

### 22. Garantía, estabilización y soporte — ⏳ No vence aún (0 %)

**Alcance contractual:** Corregir sin costo adicional los defectos cubiertos por la garantía durante seis meses desde la salida a producción y prestar acompañamiento formal de estabilización durante los dos primeros meses posteriores al lanzamiento.
*Fuente:* Propuesta OpenView: sección 13.3.

**Lo realizado**
- Corre desde la salida a producción (corte de dominio). Mientras tanto se corrigen defectos a medida que aparecen.

**Lo que falta**
- Fijar la fecha de inicio de los 6 meses de garantía y los 2 de estabilización al hacer el corte de dominio.

**Entregable para FEDEGÁN:** Acta de inicio de garantía y estabilización.  
**Responsable:** Contratista + FEDEGÁN

### 23. Monitoreo posterior (SEO, analítica, caché, CWV) — ⏳ No vence aún (0 %)

**Alcance contractual:** Realizar durante seis meses el monitoreo posterior de SEO, analítica, caché y Core Web Vitals, con verificaciones automatizadas y reporte semanal para la contraparte técnica de FEDEGÁN, según el alcance ofrecido.
*Fuente:* Propuesta OpenView: sección 6.4.

**Lo realizado**
- Aún no inicia. Hay piezas reutilizables: mediciones de Lighthouse, tableros de analítica, calentamiento de caché.

**Lo que falta**
- Construir las verificaciones automatizadas y el reporte semanal para la contraparte técnica (arrancan al cierre de la estabilización).

**Entregable para FEDEGÁN:** Reporte semanal automático de SEO, analítica, caché y rendimiento.  
**Responsable:** Contratista

### 24. Integración con Portal FEDEGÁN y SuperApp (identidad unificada) — 🟡 Parcial (25 %)

**Alcance contractual:** 
*Fuente:* 

**Lo realizado**
- En el portal institucional (`FEDEGANWEB`) la página «Mi FEDEGÁN» ya lista las aplicaciones por perfil, incluida «Administrar CONtexto Ganadero», con inicio de sesión de Microsoft Entra ID listo para configurar (hoy en modo demostración).
- En CONtexto: código anónimo de visitante con consentimiento, lecturas por visitante (notas, tiempo, dispositivo, fuentes) y vínculo opcional navegador-suscriptor con casilla expresa («para recibir contenido más útil»); el espacio «para ti» (saludo por nombre e intereses) está iniciado, sin publicar.

**Lo que falta**
- Identidad digital unificada entre portal, SuperApp y CONtexto (inicio de sesión único con el mismo identificador de usuario).
- Interfaz para que el portal y la SuperApp envíen y reciban eventos de uso (contenido consultado, tiempo, anuncios, intereses).
- Consolidación para analítica, segmentación y personalización, con política de tratamiento de datos, consentimiento y gobierno de la información.
- Esta obligación no está en la propuesta de OpenView (la fila no tiene número en la hoja): confirmar alcance, plazo y costo con FEDEGÁN.

**Entregable para FEDEGÁN:** Documento de diseño de identidad unificada y acta de alcance aprobada por FEDEGÁN.  
**Responsable:** Contratista + FEDEGÁN (TI)

## 3. Acciones que dependen de FEDEGÁN o de terceros

| Acción | Quién | Por qué importa |
|---|---|---|
| Conectar Resend (envío de correo) y verificar el dominio remitente | FEDEGÁN / Contratista | Sin esto no salen confirmaciones ni boletines (obl. 13). |
| Corte de dominio: apuntar `www.contextoganadero.com` al portal nuevo y fijar `NEXT_PUBLIC_SITE_URL` | FEDEGÁN (DNS) + Contratista | Inicia garantía y estabilización (obl. 8, 22). |
| Enviar sitemaps a Search Console y pedir inclusión en Google News | FEDEGÁN | Obl. 7. |
| Cargar identificadores de GA4 y GTM y activar Google Ad Manager | FEDEGÁN | Obl. 6 y 14. |
| Monitor de disponibilidad y reglas del Firewall de Vercel | Contratista / FEDEGÁN | Obl. 12. |
| Rotar las credenciales usadas en la migración y cancelar el sitio anterior tras el corte | FEDEGÁN / Contratista | Obl. 8 y 12. |
| Definir la matriz contractual definitiva (extras y exclusiones) y las metas de rendimiento | FEDEGÁN | Obl. 5, 11 y 13. |
| Transferencia de cuentas, repositorio y credenciales | FEDEGÁN + Contratista | Obl. 17, 19 y 20. |
| Aclarar alcance de la integración con Portal y SuperApp | FEDEGÁN | Obl. 24. |

## 4. Propuesta de entregas (en orden)

1. **Entrega 1 — Migración:** informe de conciliación (corriendo `migracion:verificar` contra producción) + acta de cierre y de cambio de método. *(obl. 8, 9, 10)*
1. **Entrega 2 — Rendimiento y SEO:** informe de Core Web Vitals posterior a la migración, con metas acordadas, y reporte de SEO técnico con sitemaps enviados. *(obl. 7, 11)*
1. **Entrega 3 — Documentación y capacitación:** manuales actualizados, plan y registro de capacitación, acta de credenciales. *(obl. 19)*
1. **Entrega 4 — Arquitectura y UX:** documento formal de diagnóstico y arquitectura (E-01) y de UX/UI con accesibilidad (E-02). *(obl. 1, 2)*
1. **Entrega 5 — Seguridad e infraestructura:** informe de seguridad y disponibilidad, evidencia del monitoreo, acta de transferencia de cuentas. *(obl. 12, 17)*
1. **Entrega 6 — Pruebas y aceptación:** acta de pruebas de aceptación por criterio. *(obl. 18)*
1. **Entrega 7 — Código y propiedad intelectual:** acta de entrega del repositorio y cesión. *(obl. 20)*
1. **Entrega 8 — Corte de dominio y arranque de garantía:** acta de salida a producción. *(obl. 21, 22)*
1. **Aparte:** alcance de la integración con Portal y SuperApp *(obl. 24)* y diseño del monitoreo posterior *(obl. 23)*.

## 5. Hitos construidos recientemente

- **14/10** — Migración de 51,5 mil notas del sitio anterior a la base, con imágenes, categorías y redirecciones
- **14-15/10** — Panel de artículos y editor de portada abren rápido con 51 mil notas; Observatorio estático con respaldo en Supabase; mapa de regiones
- **15/10** — Menú y cabecera editables, Google Ad Manager, menú móvil con secciones plegadas
- **16/10** — Consejo de redacción con IA (cobertura, temas, pautas, calendario) y aviso de IA al lector
- **13/10** — Newsletter: editor por pasos, segmentación por ciudad/tema, programación, PDF y resumen con IA
- **8-10/10** — «Más leídas» por lecturas reales, panel con color de plantilla, Observatorio sin esperas, asistente más rápido, plazos y esqueletos

## 6. Qué no se pudo verificar desde el código

- Contenido de la base de producción más allá de lo visible en el sitio (el conteo de 51.388 sale de los mapas del sitio).
- Configuración de cuentas externas: Resend, Search Console, GA4/GTM, Google Ad Manager, monitoreo y Firewall.
- Entrega real de notificaciones push y de correos.
- Datos de campo de rendimiento (Search Console/CrUX).
