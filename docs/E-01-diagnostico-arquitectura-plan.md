# E-01 — Diagnóstico, arquitectura y plan de implementación

**Proyecto:** Modernización de CONtexto Ganadero (FEDEGÁN) · **Contratista:** OpenView · **Fecha:** 18 de octubre de 2026
**Obligación:** 1 — Diagnóstico, diseño y arquitectura integral (TDR: objeto y alcance; Anexo Funcional: secciones 1 y 2; Propuesta: E-01).

Este documento reúne el diagnóstico del sitio actual (`www.contextoganadero.com`), la arquitectura de la nueva plataforma y su plan de
implementación. Todas las cifras son mediciones propias, hechas el 18/10/2026; el método está al final de cada apartado.

---

## 1. Diagnóstico del sitio actual

### 1.1 Tecnología y operación
| Aspecto | Hallazgo (verificado) |
|---|---|
| Aplicación | Next.js (cabecera `x-powered-by: Next.js`), alojado en Vercel (`x-vercel-id: iad1…`, Washington) detrás de Cloudflare (`server: cloudflare`) |
| Gestor de contenidos | Storyblok (SaaS): 96 referencias en el HTML de la portada; imágenes servidas desde `a.storyblok.com` |
| Contenido | ≈51.500 notas en 29 carpetas (`/regiones/…`, `/columna/…`, `/galeria/…`…); 51.527 de 51.535 direcciones descargables (las 8 restantes dan 404/500 en el propio sitio) |
| Navegación | ≈45 secciones, con direcciones del tipo `/gremialidad?page=1`, más páginas institucionales `/PoliticaEmpresarioView/…`, `/RegionesView`, `/IndicadoresView`, `/ColumnistasView`, `/BlogsView` |
| Analítica y publicidad | Google Tag Manager `GTM-5K7WVL8`; Google Ad Manager (DoubleClick); `ads.txt` presente |
| SEO técnico | `robots.txt` y `sitemap.xml` (índice de mapas) presentes; **sin RSS** (`/feed` y `/rss` dan 404) |

### 1.2 Rendimiento, accesibilidad, SEO y buenas prácticas
Lighthouse 12, móvil simulado (el mismo modo de PageSpeed Insights), dos corridas por página:

| Página | Corrida | Rendimiento | Accesibilidad | SEO | Buenas prácticas | LCP | CLS | TBT | Peso | Peticiones |
|---|---|---|---|---|---|---|---|---|---|---|
| Portada | 1 | 23 | 86 | 100 | 71 | 27.5 s | 0.977 | 330 ms | 8.2 MB | 358 |
| Portada | 2 | 23 | 86 | 100 | 71 | 25.9 s | 0.977 | 337 ms | 8.8 MB | 353 |
| Sección (Gremialidad) | 1 | 25 | 96 | 92 | 79 | 11.0 s | 1.173 | 300 ms | 6.6 MB | 158 |
| Sección (Gremialidad) | 2 | 49 | 96 | 92 | 79 | 11.4 s | 0.134 | 338 ms | 6.2 MB | 140 |
| Artículo | 1 | 46 | 95 | 100 | 79 | 12.2 s | 0.073 | 521 ms | 4.6 MB | 134 |
| Artículo | 2 | 47 | 95 | 100 | 79 | 13.5 s | 0.073 | 471 ms | 4.9 MB | 136 |

**Lectura:** la portada tarda **26-27 s** en pintar su elemento principal (meta del TDR: ≤ 2,5 s), descarga **8-9 MB** en **≈355 peticiones** y su
diseño **salta** al cargar (CLS 0,98; bueno es < 0,1). Secciones y artículos tardan 11-13 s. Las causas que reporta Lighthouse:
- **Imágenes sin dimensionar para el móvil:** hasta 2,3 MB de ahorro posible por página (`uses-responsive-images`).
- **JavaScript sin usar:** ≈680-740 KB por página.
- **Recursos que bloquean el pintado:** hasta 1,5 s en el artículo.
- **Código de terceros** (publicidad, etiquetas) bloqueando el hilo principal 330-630 ms.

### 1.3 Accesibilidad y SEO (hallazgos concretos)
- Contraste de color insuficiente (portada, sección y artículo).
- Roles ARIA en elementos incompatibles y elementos ocultos (`aria-hidden`) con controles enfocables (portada).
- Objetivos táctiles pequeños o muy juntos (portada) y títulos fuera de orden (artículo).
- **La portada no tiene `<h1>`** (0 encabezados de nivel 1 tras renderizar).
- **Enlaces no rastreables** en las secciones (Lighthouse, SEO); el HTML inicial de la portada solo trae enlaces a páginas institucionales: el menú se arma con JavaScript.
- La portada **no declara URL canónica ni datos estructurados**; sus etiquetas Open Graph no incluyen título ni descripción.
- Cookies de terceros y errores en la consola del navegador.

### 1.4 Conclusiones del diagnóstico
1. **El rendimiento es el problema principal:** el sitio está muy lejos de las metas del TDR en móvil.
2. **Dependencia de un CMS externo (Storyblok)** para el contenido y las imágenes.
3. **SEO técnico mejorable** sin perder lo ganado: hay que conservar las ≈51.500 direcciones indexadas.
4. **Accesibilidad aceptable pero incompleta:** contraste, ARIA, encabezados y tamaño de los objetivos táctiles.

---

## 2. Arquitectura de la solución

### 2.1 Decisiones que responden al diagnóstico
| Hallazgo | Decisión |
|---|---|
| LCP 26 s, 8-9 MB | Renderizado en el servidor (React Server Components), imágenes optimizadas y redimensionadas por dispositivo, imagen principal precargada, tipografías y código no esencial después de la carga, caché de datos |
| Dependencia de Storyblok | CMS propio dentro de la plataforma (panel editorial) y **migración** del contenido e imágenes a la base y almacenamiento propios |
| URLs indexadas | Cada nota migrada se sirve **en su dirección original** (sin redirección); redirecciones 301 para las páginas antiguas que cambian |
| Menú no rastreable, sin `<h1>`, sin canónica | HTML con enlaces reales, jerarquía de encabezados, canónica, JSON-LD (NewsArticle, breadcrumbs), Open Graph y Twitter Cards completos, RSS |
| Accesibilidad | Sistema de diseño con contraste verificado, objetivos táctiles ≥ 24 px, foco visible, `prefers-reduced-motion` |

### 2.2 Componentes
- **Aplicación:** Next.js 16 (App Router, React 19), TypeScript estricto, Tailwind CSS 4.
- **Datos:** PostgreSQL (Supabase) con `pgvector` para búsqueda semántica; esquema y migraciones con Drizzle (`docs/base-de-datos.md`).
- **Almacenamiento:** bucket `media` en Supabase (imágenes propias, incluidas las ≈39.500 migradas).
- **Infraestructura:** Vercel (despliegue continuo desde GitHub, CDN, tareas programadas), Cloudflare (DNS).
- **Acceso:** Auth.js con 2FA obligatorio y passkeys; roles redactor, editor y administrador.
- **IA:** proveedor configurable (Anthropic / Google) con citación obligatoria y aprobación humana.
- **Arquitectura modular** con dependencias dirigidas verificadas en cada cambio (`docs/ARQUITECTURA.md`, `docs/auditoria-acoplamiento.md`).

### 2.3 Modelo de contenidos
Notas (`articles`) con estado editorial (borrador → revisión → programado → publicado → archivado), categoría principal y secciones adicionales,
autor, etiquetas, SEO, dirección original (`legacy_path`) y estilo de portada; categorías jerárquicas (sección / subsección); autores; zonas
publicitarias; ediciones y suscriptores del boletín; configuración del sitio (plantilla, portada, menú) en `site_settings`. Detalle en `docs/base-de-datos.md`.

### 2.4 Arquitectura de información y navegación
Menú principal editable desde el panel (secciones, enlaces y submenús), árbol de 56 secciones y subsecciones, páginas de autor, migas de pan,
filtros (subsección, fechas, autor/año/mes en columnas, región y departamento en Regiones), paginación numérica y buscador con sugerencias.
Formatos propios para TV, Radio y Especiales. Seis plantillas visuales intercambiables sin desplegar.

---

## 3. Plan de implementación (real)

Inicio del desarrollo: **7/9/2026** · 451 cambios registrados en el repositorio al 18/10/2026.

| Fase | Entregable | Estado al 18/10/2026 | Fecha real |
|---|---|---|---|
| E-01 | Diagnóstico y arquitectura | Este documento | 18/10 |
| E-02 | UX/UI y prototipos | Sistema de diseño y 6 plantillas en producción; prototipos navegables: ver `docs/E-02-prototipos` | 23/09 → 18/10 |
| E-03 | CMS / panel editorial | En producción (roles, 2FA, borradores, programación, vista previa, editor de portada) | 07/09 → 28/09 |
| E-04 | Portal, plantillas y PWA | En producción | 23/09 |
| E-05 | Navegación y búsqueda | En producción (búsqueda indexada sobre 51 mil notas) | 23/09 → 14/10 |
| E-06 | SEO, publicidad, boletín | En producción | 23/09 |
| E-07 | Seguridad e infraestructura | En producción (auditoría de 26 hallazgos corregida) | 28/09 → 06/10 |
| E-08 / E-09 | Asistente de IA y agentes editoriales | En producción | 23/09 → 16/10 |
| E-10 | Pruebas, documentación y capacitación | 374 pruebas automáticas; manuales escritos; falta capacitación y acta | En curso |
| E-11 | Migración del archivo | **Hecha:** 51.388 notas en producción | 14/10 (previsto 20/11) |
| Salida | Corte de dominio a `www.contextoganadero.com` | Pendiente del cambio de DNS (FEDEGÁN) | Por fijar |

### 3.1 Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Pérdida de posicionamiento al cambiar de plataforma | Mismas direcciones, canónicas, mapas del sitio por partes y verificación de una muestra de URLs |
| Primera visita lenta con el servidor en frío | Caché de borde de portada y secciones (en curso) |
| Plan Hobby de Vercel frente al 99,5 % de disponibilidad | Decidir plan Pro y monitor de disponibilidad |
| Alcance no contratado (integración Portal / SuperApp) | Definir alcance, plazo y costo antes de ejecutarlo |

---

## 4. Método
- Cabeceras y HTML con `curl`; estructura del menú renderizando la portada en Chrome real (puppeteer-core).
- Lighthouse 12 con Chrome sin interfaz, móvil simulado, sobre `www.contextoganadero.com` (sitio actual) el 18/10/2026.
- Cifras del portal nuevo: `docs/medicion-core-web-vitals.md` (sección 7).
