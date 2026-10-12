# Brief para replicar «CONtexto Ganadero»: portal de noticias con CMS ultra-ajustable y varias plantillas

> Para el agente que lo construye. Léelo entero antes de escribir código. Todo lo que aquí se describe existe y funciona en el proyecto de referencia (nombres de archivos reales). Replica el **comportamiento y la arquitectura**; cambia marca, dominio y contenido.

## 0. Qué es, en una frase

Un **portal de noticias (periodismo agropecuario, Colombia, en español con interfaz en inglés)** cuyo **panel editorial** permite cambiar, **sin tocar código y sin desplegar**, la plantilla completa del sitio, los colores por modo claro/oscuro, tipografías, tamaños, espacios, el orden y el aspecto de cada nota, el menú, el cintillo de titulares, la publicidad y la ventana emergente. Todo se edita sobre **la página real** (vista previa con el borrador aplicado) y se publica con un clic, con opción de deshacer.

Principio rector: **«todo es un ajuste»**. Si un editor puede querer cambiarlo, está en una configuración guardada en base de datos (JSON), validada y convertida a CSS/props en el servidor.

## 1. Stack y restricciones (no negociables)

- **Next.js 16 (App Router, React 19.2, Server Components)**. Mutaciones del panel con **Server Actions** (no crear una API REST paralela). Esta versión tiene cambios incompatibles: lee `node_modules/next/dist/docs/` antes de usar APIs.
- **TypeScript estricto**, **Tailwind v4** (`@tailwindcss/postcss`), `lucide-react`, `framer-motion`.
- **Postgres + pgvector**. Producción: Supabase (pooler). Desarrollo: **PGlite embebido** (cero infraestructura; mismo SQL). ORM: **Drizzle** (`src/db/schema.ts`; migraciones numeradas en `drizzle/`; en producción se aplican a mano en el SQL Editor, así que **cada sentencia debe ser idempotente**: `IF NOT EXISTS`).
- **Auth.js v5** con contraseña + **2FA TOTP obligatorio** (`otplib`) + **passkeys** (`@simplewebauthn`). Roles: `redactor`, `editor`, `administrador`; permisos finos por usuario.
- **IA**: Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`), proveedor/modelo configurable desde el panel, claves cifradas.
- Hosting: **Vercel Hobby** (límites: 2 crons diarios, funciones con tiempo máximo). Eso condiciona decisiones (ver §9).
- Tests con `node:test` + `tsx` (`npm test`), incluidas pruebas contra **PGlite en memoria** (`src/test-utils/bd-memoria.ts`).
- Idioma del código y comentarios: **español** (nombres de dominio en español: `cintillo`, `ubicacion`, `lectores`), comentarios que explican el *porqué*.

## 2. Arquitectura por módulos con dependencias dirigidas

`scripts/modulos.config.json` + `scripts/check-modulos.mjs` (parte de `npm run lint`) definen módulos por patrones de ruta y **qué puede importar cada uno**: `infra` (db, utilidades) ← `acceso` ← `contenido` ← `portada-tema` ← `newsletter`/`canales`/`analitica`/`ia` ← `ui-panel`/`ui-sitio`, más `orquestacion`. Un import fuera del grafo rompe el lint. Para reaccionar a lo que pasa en otro módulo se usan **eventos** (`src/lib/eventos.ts`, cableado en `src/lib/oyentes.ts`). Replica esto desde el día 1; es lo que mantiene el proyecto mantenible con muchas funciones.

## 3. Modelo de datos (tablas clave)

`users`, `passkeys`, `sessions`, `authors`, `categories` (con `parentId`: secciones y subsecciones, `sortOrder`), `articles` (estado enum `borrador|en_revision|programado|publicado|archivado`, `homePosition`, **`homeStyle` JSONB**, `isBreaking`, `isLive`, `views`, embedding vectorial), `article_views_daily`, `reader_sessions` (lecturas por visitante con consentimiento), `subscriber_visitors`, `newsletter_subscribers`, `newsletter_editions`, `ads_zones`, `site_settings` (**clave→JSON: aquí vive casi toda la configuración visual**), `redirects`, `archive_index` (espejo de solo lectura de un archivo histórico), `data_series`/`data_points`, `agent_drafts`, `assistant_queries`, `api_clients`, `push_subscriptions`, `contact_messages`, `rate_limits`.

Claves de `site_settings` importantes: `home_layout` (diseño publicado), `home_draft:<userId>` (borrador por editor), popup, identidad del sitio, ajustes de IA, permisos.

## 4. El corazón: el motor de plantillas y ajustes (lo que hace al CMS «dinámico»)

### 4.1 Temas por variables CSS
`src/app/globals.css` define cada plantilla como un bloque `[data-theme="<id>"] { --bg, --bg-2, --surface, --surface-2, --fg, --fg-muted, --border, --border-strong, --accent, --accent-2, --accent-fg, --link, --radius, --radius-lg, --shadow, --font-display, --font-body, --font-ui, color-scheme }`. Todo componente usa **solo tokens** (`var(--accent)`), nunca colores literales. El tema activo se pone en un contenedor `data-theme` (y `data-site-root`). Hay además `html[data-dark="0|1"]` para el **interruptor claro/oscuro del lector** (la plantilla trae su variante por modo).

Seis plantillas elegibles (cada una con su personalidad, tipografía y piezas):
1. **Esmeralda Real** – obsidiana verde (#05100b), pan de oro (#d8b558), cintillo, apertura a sangre con texto sobre la foto, columna «Lo último» numerada.
2. **Clásico** – periódico: crema (#faf7f0), rojo (#b9271a), serif, filetes.
3. **Revista** – negro cálido + dorado, carrusel héroe, tarjetas que se alzan.
4. **Compacto** – blanco nítido, azul zafiro, alta densidad, grilla técnica.
5. **Vanguardia** – casi negro, coral → violeta, bento inmersivo, vidrio.
6. **Gremial** – blanco, logotipo rojo, menú horizontal y «Mi cuenta».

### 4.2 Plantilla compuesta por piezas (`src/lib/template-parts.ts`)
Una plantilla = **navbar + cuerpo + footer**. `PRESET_PARTS` da la combinación por defecto (p. ej. Esmeralda: navbar `masthead`, body `esmeralda`, footer `grand`). El editor puede **mezclar piezas** («crear una plantilla desde cero»): `resolveParts(templateId, parts)` toma lo elegido y rellena lo que falte con la base. Cada cuerpo es un componente (`EsmeraldaTemplate`, `ClasicoTemplate`, …) que recibe las mismas props (lead, second, rail, river) — **contrato único de datos, N presentaciones**.

### 4.3 Configuración de portada (`HomeLayoutConfig`, JSON en `home_layout`)
`templateId`, `parts`, `breveDirection`/`breveColumns`/`riverColumns` (columnas de «En breve» y del río de notas), `background` (modo tema | color | degradado | imagen), `regions` (estilos por región, §4.4), `sectionEls` (piezas del encabezado de sección, §4.5), `zones` (estilo por zona de la cuadrícula), `sectionFilters` (dónde van los filtros), **`ticker`** (cintillo: encendido, origen portada/recientes/sección, cantidad, indicadores de mercado, mensajes propios, velocidad 1–10). `normalizeLayout` rellena valores por defecto y valida; **lo guardado viejo nunca rompe la página**.

### 4.4 Regiones editables (`src/lib/home-regions.ts`)
Seis regiones: `navbar`, `hero` (principal), `cards` (tarjetas), `body` (cuerpo), `encabezado` (de sección), `footer`. Cada una acepta un `RegionStyle`:
`bg`, `bgGradient`, `fg`, `accent`, **`claro` / `oscuro`** (colores solo para ese modo), `titleFont`, `textFont`, `titleScale` (70–160 %), `textScale` (80–140 %), `padY`, `padTop`, `padX`, `radius`, `maxWidth` (720–1920), `align`, `hidden`. `regionsCss(regions)` genera **CSS con selectores acotados** (`[data-region="navbar"]…`, y por modo `html[data-dark="0|1"]`), saneando todo valor (hex, rangos). El `REGIONS[].controls` dice qué controles tiene sentido mostrar por región. Click en la página → se elige la región correspondiente en el editor (`data-region` en el DOM).

### 4.5 Piezas del encabezado de sección (`src/lib/section-els.ts`)
`breadcrumb`, `kicker`, `title`, `description`, `chips`, `filters`: cada una con estilo propio (color, tamaño, degradado de texto) → `sectionElsCss`.

### 4.6 Estilo individual por nota (`HomeStyle`, columna `articles.home_style`)
`size` S/M/L, `span`, `font`, `bold`, `italic`, `color`, `titleScale`, `titlePx`, `titleGradient`, `imageScale` (%), **`imageWidth`/`imageHeight` (px exactos; solo ancho = conserva proporción; solo alto = recorta; ambos = caja)**, **`textPos`** (texto sobre la foto arriba-izq/arriba-der), y para «bloque libre»: `colSpan`, `colStart`, `rowStart`, `height`, `widthPct`, `blockAlign`, `bg`, `bgGradient`, `fg`, `radius`, `pad`, `textFont`. `sanitizeHomeStyle` valida todo; `blockStylesCss` emite una regla por nota (`[data-bslug="slug"]`). Regla de oro: **cualquier campo nuevo se añade al tipo, al saneador, a la tarjeta y a un control en el panel, y a una prueba** — sin migración (es JSON).

### 4.7 Ordenamiento
`articles.homePosition` fija a mano; el resto por fecha. `splitHomeSlots` corta en `lead(1)`, `second(1)`, `rail(4 «en breve»)`, `river(resto)` (13 notas). La API pública expone dónde está cada nota (`ubicacion`) con la misma función.

## 5. Flujo de edición: borrador → vista previa real → publicar → deshacer

- El editor guarda el **borrador por usuario** (`home_draft:<id>`) con `saveHomeDraft` (autoguardado con *debounce*). Contiene: `layout`, `items` (orden + `homeStyle` por nota), `popup`, `adDrafts`, `auto`.
- **Vista previa REAL** (`/panel/portada?vista=1`): la misma página pública renderizada con el borrador aplicado (`setPreviewDraft`; las lecturas del portal memoizan por petición, por eso el borrador se fija **antes**). Un formulario flotante («Editar esta página») permite hacer clic en una parte de la página y editarla, arrastrar/redimensionar bloques, y trae todos los bloques del editor completo: Plantilla, Notas, Menú y secciones, Cintillo, Publicidad, Ventana emergente. Cambios entre pestañas se sincronizan por `localStorage` (`*_EDIT_KEY`).
- Editor completo (`/panel/portada`): lienzo (iframe con la portada real), panel «Propiedades» contextual, lista de notas con subir/bajar, historial deshacer/rehacer, resumen de cambios («qué cambia al publicar»).
- **Publicar** (`publishHomeDraft`): aplica layout, estilos, orden, popup y anuncios en una operación; guarda una **instantánea anterior** para **«Deshacer la publicación»** (`restoreHomeSnapshot`); invalida cachés con `revalidarNotas`/`invalidarCache`.
- Cambiar de plantilla **no borra** la configuración del cintillo ni lo demás.

## 6. Funciones del sitio público

- **Rutas de contenido** estáticas con ISR (`revalidate` + `generateStaticParams`): notas y autores. **Portada y categorías `force-dynamic`** (prerenderizarlas consultaba Supabase en el build y caía el despliegue) pero leen de una **caché de datos** (`cachear` sobre `unstable_cache`, `src/lib/data-cache.ts`, JSON-serializada, etiquetas `contenido`/`ajustes`). Lecturas públicas **nunca escriben**.
- **Menú** de hasta 8 secciones + «Observatorio» fijo; árbol de secciones editable (`SectionTree`).
- **Cintillo** configurable; **Última hora** (insignia en la esquina de la foto de la nota marcada; no hay barra roja); **En vivo**.
- **«Más leídas» de verdad**: suma de `article_views_daily` de los últimos 7 días; solo notas con lecturas; leyenda visible.
- **Observatorio** (`/observatorio`): cifras oficiales leídas de un origen externo CSV (indicadores, mapa de calor por departamento, hato, documentos). Resiliencia: cupo de 4 descargas, plazo por descarga 8 s y presupuesto 15 s, lecturas incompletas no se cachean, pausa de 90 s tras fallo, **cabecera y esqueleto salen al instante y las cifras llegan por `Suspense`**.
- **Asistente conversacional (RAG)**: búsqueda híbrida (vectorial + texto, fusión RRF) sobre notas + archivo + cifras del Observatorio; **respuesta solo con citas `[n]` válidas, sin fuentes declina**; presupuesto por sesión y mensual con degradación a búsqueda; tope de generación 20 s; fuentes en lista desplegable; toro flotante **arrastrable** a cualquier lugar (posición recordada, no se sale de la pantalla).
- **PWA**: instalable (guía especial para iOS), service worker versionado por despliegue, **notificaciones push** (VAPID), página offline.
- **Boletín** con doble confirmación, ediciones, lectura autorizada opcional.
- **Analítica propia con consentimiento** (`cg_med`, `cg_vid`): lecturas por visitante, fuentes, ciudad aproximada; panel con tableros. Sin consentimiento no hay código de visitante.
- **«Para ti»** (en construcción): el espacio de «Más leídas» saluda por nombre (si el navegador está vinculado a un suscriptor que autorizó) y muestra lo que más le interesa (Observatorio, secciones), con decaimiento de 14 días y opt-in explícito. Aplica a todas las plantillas porque vive en la barra lateral común.
- **API pública `/api/v1`** con claves, OpenAPI en `/api-docs`; campo `ubicacion` por nota.
- **SEO**: JSON-LD `NewsArticle`, sitemap, RSS, `llms.txt`, canonical, redirecciones 301 de taxonomía antigua y de direcciones del sitio anterior.
- **i18n** es/en de la interfaz (`src/lib/i18n.ts`); el contenido sigue en español.

## 7. El panel (`/panel/*`)

Resumen (analítica), Artículos (asistente de redacción sin scroll, vista previa, programación), Portada y plantillas, Secciones, Newsletter, Suscriptores, Mensajes, Configuración (IA, seguridad/2FA, permisos, cuotas), API pública, Borradores de IA (agentes de producción editorial; **nada generado se publica sin acción humana**). La barra lateral toma el **color principal de la plantilla activa** (`src/lib/panel-tema.ts`).

## 8. Seguridad y robustez (aplicar desde el inicio)

- Claves derivadas por propósito con **HKDF** (`src/lib/claves.ts`); no usar `AUTH_SECRET` directo.
- Límites e intentos con `rate-limit.ts` (`hit`, `usoUnico`); leer-modificar-escribir en **una sentencia o transacción con `FOR UPDATE`**.
- Todo lo que se descarga de fuera pasa por `safe-fetch.ts` (bloquea IPs privadas, redirecciones, tamaño máximo, **plazo total**).
- HTML de notas saneado (`sanitize-html`); CSP por cabecera; bots filtrados en el proxy.
- El archivo histórico es **de solo lectura**: nunca se escribe al origen.

## 9. Lecciones aprendidas (no repitas estos errores)

1. **Lo no cacheado se paga en frío**: toda lectura externa lenta necesita plazo, tope de concurrencia, no cachear lo incompleto y UI que no espere (Suspense).
2. La caché de datos de Vercel puede arrancar vacía tras cada despliegue: calienta tras desplegar o desde un cron.
3. No uses `100vh`/`fixed` sin pensar en iOS Safari (barra compacta); prueba con Chrome real (puppeteer) además del navegador integrado.
4. Efectos de entrada con `opacity` retrasan el **LCP**: solo en pantallas grandes y con movimiento permitido.
5. Contraste y objetivos táctiles ≥ 24 px; `prefers-reduced-motion` respetado.
6. Cada región/ajuste nuevo debe sanearse en servidor; **nunca interpolar valores del editor en CSS sin validar**.
7. Un `<details>` cerrado por defecto para listas largas (fuentes del asistente, ajustes de nota).
8. Ante estado PGlite corrupto: `npm run db:local:reset`.

## 10. Plan de construcción sugerido (en este orden)

1. Esqueleto Next 16 + Drizzle + PGlite + Tailwind 4, módulos y lint de dependencias, pruebas con BD en memoria.
2. Modelo `articles/categories/authors`, rutas públicas ISR, panel con auth+2FA y CRUD de notas.
3. **Tokens de tema + 2 plantillas** con contrato único de datos (lead/second/rail/river) y `[data-theme]`.
4. `site_settings` + `HomeLayoutConfig` + `normalizeLayout` + `regionsCss` + `HomeStyle` + `blockStylesCss` (con pruebas).
5. Editor: borrador por usuario, vista previa real, publicar/deshacer, formulario flotante, historial.
6. Resto de plantillas y piezas (navbar/footer), cintillo, publicidad (zonas con medidas), ventana emergente.
7. Caché de datos + invalidación al publicar; Observatorio/indicadores con resiliencia.
8. Asistente RAG con citas obligatorias, boletín, PWA/push, analítica con consentimiento, API v1.
9. Panel con color de plantilla, personalización «para ti», auditoría de rendimiento y accesibilidad.

## 11. Criterios de aceptación mínimos

- Cambiar de plantilla en el editor y publicar transforma **toda** la portada, secciones y artículos sin desplegar.
- Un editor puede: cambiar colores por modo, tipografía y tamaños de cualquier región; mover/estilizar una nota; fijar medidas exactas de su foto; reordenar el menú; editar el cintillo; programar la ventana emergente; deshacer la última publicación.
- Un valor inválido guardado nunca rompe una página (se normaliza).
- `npm run lint && npm run typecheck && npm test && npm run build` en verde antes de cada commit.
