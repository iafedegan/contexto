# CONtexto Ganadero — Plataforma

Portal público + panel editorial propio + capacidades de IA para el medio
CONtexto Ganadero. Scaffold funcional basado en la propuesta OV-PRO-FDG-001.

Stack: **Next.js 16 (App Router / RSC)** · **PostgreSQL + pgvector** (Supabase en
prod, PGlite embebido en local) · **Drizzle ORM** · **Auth.js** · **Vercel AI
SDK** (Anthropic) · **Inngest** · **Tailwind CSS** · despliegue en **Vercel**.

> **Demo rápida:** `npm install && npm run dev` — sin base de datos ni claves.

---

## Puesta en marcha

### MVP local (cero infraestructura)

```bash
npm install
npm run dev
```

No hace falta base de datos ni claves. `predev` levanta un **Postgres embebido
(PGlite, con pgvector)** en `.pglite/`, aplica las migraciones y carga datos de
ejemplo (8 artículos, archivo histórico simulado, borrador de IA, log de
consultas). Abre <http://localhost:3000>.

- Panel editorial: <http://localhost:3000/panel> → `editor@contextoganadero.com` / `contexto2026`
- Sin `ANTHROPIC_API_KEY`, el asistente funciona en **modo búsqueda** (recupera y
  cita fuentes, sin generación). Añade la clave en `.env.local` para respuestas
  generativas.
- La BD local se **recrea en cada arranque** (demo determinista). Para conservar
  los cambios del panel entre reinicios: `KEEP_LOCAL_DB=1 npm run dev`.
- `npm run build:local` compila usando una BD en memoria (no toca `.pglite/`).

### Producción (Supabase + Vercel)

```bash
cp .env.example .env.local        # DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY, …
npm run db:setup                  # extensiones + migraciones + índices + seed
npm run build && npm start
```

Al definir `DATABASE_URL`, la app ignora PGlite y usa el Postgres gestionado.
`npm run db:setup` ejecuta, en orden: `db:extras:pre` (`CREATE EXTENSION vector,
pg_trgm`) → `db:generate` (SQL desde `src/db/schema.ts`, ya incluido en
`drizzle/0000_init.sql`) → `db:migrate` → `db:extras:post` (índices HNSW + GIN
español) → `db:seed`.

---

## Sistema de plantillas (diseño)

Cada plantilla es un **tema completo**: paleta, tipografías, radios, sombras,
texturas, navbar, tarjetas y footer propios. El tema se activa con
`<SiteShell theme="…">` (`src/components/site-shell.tsx`), que fija
`data-theme` y monta la pareja navbar/footer correspondiente. Los tokens viven
en `src/app/globals.css`; las tipografías se descargan y auto-hospedan en build
con `next/font` desde `src/app/fonts.ts`.

### Plantillas de portada (elegibles en `/panel/portada`)

La portada no tiene un diseño fijo: un editor elige su plantilla en
`/panel/portada`, y esa elección es también el **tema** de la página — cambian
cuadrícula, componentes, cabecera, pie, paleta y tipografías. Desde ahí se
arrastran las notas para fijar su orden (`articles.homePosition`) y se ajusta el
estilo de cada tarjeta (`articles.homeStyle`).

| Plantilla | Qué la distingue |
|---|---|
| **Esmeralda Real** | Obsidiana verde y pan de oro: cintillo de titulares, apertura a sangre, columna «Lo último» numerada |
| **Clásico** | Broadsheet de papel crema: cinta de destacados, principal + «En breve», capitular y filete rojo |
| **Revista** | Hero cinematográfico con carrusel y efecto Ken Burns, negro y oro, carrusel de arrastre |
| **Compacto** | Cuadrícula técnica blanca y zafiro: fichas numeradas, máxima densidad de notas |
| **Vanguardia** | Bento oscuro y asimétrico, orbes de gradiente, vidrio y coral → violeta |

### Plantillas de ruta

| Ruta | Tema | Navbar | Tipografías |
|---|---|---|---|
| `/` | La elegida en `/panel/portada` (5 opciones) | La de su plantilla | Las de su plantilla |
| `/articulo/[slug]` | Marfil & Burdeos | Barra fija con progreso de lectura | Bodoni Moda · Spectral |
| `/categoria/[slug]` | Cobre & Obsidiana | Barra flotante con nav en píldoras | Syne · Space Grotesk |
| `/autor/[slug]` | Champán & Perla | Centrada, capitales espaciadas | Cormorant Garamond · Jost |
| `/buscar` | Zafiro Medianoche | Barra tipo consola | Space Grotesk · JetBrains Mono |
| `/asistente` | Obsidiana & Aurora | Píldora de cristal flotante | Outfit · JetBrains Mono |
| `/politica-editorial` | Mármol & Verde Botella | Institucional con sello | Marcellus · Source Serif 4 |
| `404` | Sepia & Ámbar | Mínima con etiqueta de archivo | Marcellus · Jost |
| `/panel/**` | Grafito & Jade | Barra de herramienta densa | Space Grotesk · Inter Tight |
| `/panel/login` | Platino | Sin navbar (vestíbulo) | Outfit · JetBrains Mono |

### Navegación y portada en el celular (< 768 px)

El celular no es el escritorio apretado: tiene su propia disposición (`SiteShell` la monta en todas las plantillas y
todos los temas, con los tokens de la plantilla activa).

- **Barra de pestañas inferior** (`src/components/mobile-tab-bar.tsx`): Inicio, Secciones (abre el menú de pantalla
  completa), el **asistente** —el toro, en un círculo elevado al centro—, Buscar y Boletín. Se esconde al bajar por la
  página y vuelve al subir; con el teclado enfocado dentro, siempre se ve. La pestaña activa sale de la ruta
  (`src/lib/pestanas.ts`, con prueba). El toro flotante de escritorio no se pinta aquí: ya vive en la barra.
- **Cabecera**: en el celular solo queda el nombre del sitio, porque el menú y la búsqueda ya están en la barra de
  abajo (`mobile-nav.tsx`); desde 768 px, donde no hay barra, vuelven el botón de menú y la lupa.
- **Nombre del sitio**: en las plantillas con cabecera «masthead» (Esmeralda, Clásico) el celular repite la de la web: nombre
  dorado con el brillo que lo recorre, filetes a los lados y el lema debajo. Se va con la página (solo la barra de abajo
  queda fija).
- **Portada**: apertura vertical (4:5) con el titular sobre la foto, «Lo último» con miniaturas y el río de notas en dos
  columnas (la primera nota y, si queda una impar al final, la última ocupan el ancho: `anchaEnCelular` en
  `src/lib/home-layout.ts`, con prueba). El pie reparte sus columnas de enlaces de a dos.
- **Avisos fijos** (ubicación, notificaciones): se apoyan sobre la barra con `--cg-barra` y bajan al borde cuando ella se
  esconde; `--cg-barra-alto` (constante) reserva el pie de la página para que esconderla no mueva el documento
  (`globals.css`). El aviso de ubicación sale a los 9 s en el celular (a 1,5 s en escritorio).
- El menú de pantalla completa marca `html[data-cg-overlay]`, y con eso la barra se oculta mientras está abierto.

### Logo

El logo («Cg» dorado y crema sobre baldosa esmeralda) se dibuja en código: `src/lib/logo.ts` es la única fuente. De ahí
salen el SVG de `public/logo/`, la pestaña (`icon.tsx`), iOS (`apple-icon.tsx`) y la PWA (`/api/pwa-icon`). Tras editarlo:
`npx tsx scripts/generar-logo.ts --png` (los PNG piden `npm i -D puppeteer-core` y Chrome); una prueba avisa si el SVG
queda desfasado.

Efectos compartidos (`lx-*` en `globals.css`): grano, aurora animada, viñeta,
barrido de luz en tarjetas, marco interior metálico, texto con lámina de oro,
aparición al hacer scroll (`animation-timeline: view()`) y capitular en el
cuerpo del artículo. Todo respeta `prefers-reduced-motion`.

Los artículos sin imagen reciben una **portada generada** determinista
(`src/components/cover-art.tsx`): malla de degradados en `oklch` sobre una
paleta curada + monograma.

---

## Cómo el código implementa los principios de arquitectura

| # | Principio | Dónde |
|---|---|---|
| 1 | Sin migración del archivo · integración de solo lectura | `src/lib/archive-client.ts` (nunca escribe al origen), tabla `archive_index`, cron `src/app/api/cron/sync-archive` |
| 2 | Sin CMS comercial · panel a medida | `src/app/panel/**` (roles, borradores, programación, vista previa, asistencia SEO) |
| 3 | Un solo motor de base de datos | `src/db/schema.ts` — contenido, usuarios, avisos, series de datos y vectores en el mismo Postgres |
| 4 | Generación estática + borde | Notas y autores son estáticos (ISR: `revalidate` + `generateStaticParams`). La portada y las categorías se generan por visita (`force-dynamic`: prerenderizarlas consultaba Supabase desde el servidor de compilación y el despliegue caía por tiempo de espera, y las categorías filtran por parámetros de la dirección), pero leen de una caché de datos de 60 s (`src/lib/data-cache.ts`) que las acciones del panel invalidan al instante al publicar: ninguna visita consulta la base. Revalidación *on-demand* en `src/app/api/revalidate` y en las Server Actions del panel |
| 5 | Módulos de dominio, un solo deploy | `src/lib` (contenido, búsqueda, archivo, seo), `src/agents`, `src/inngest` — separados en código, un despliegue |
| 6 | IA con aprobación humana obligatoria | `agent_drafts.status`, `src/app/panel/borradores-ia` — aprobar crea un borrador atribuido al editor; publicar es un paso aparte |

## SEO técnico (corrige los hallazgos del diagnóstico)

- **`NewsArticle` JSON-LD** — `src/lib/seo.ts` + `src/components/json-ld.tsx`, en cada artículo.
- **`robots.txt`** permite los buscadores y los buscadores de IA que citan y enlazan (PerplexityBot, OAI-SearchBot…) y rechaza los crawlers que copian contenido para entrenar modelos (GPTBot, ClaudeBot, CCBot…) — `src/app/robots.ts` y `src/lib/bots.ts`; el proxy los rechaza además con 403.
- **Metadatos por artículo** derivados de título/resumen, sin acumulación de keywords — `articleMetadata()`.
- **Sitemap XML dinámico**, **RSS**, **canonical** — `src/app/sitemap.ts`, `src/app/feed.xml`, `alternates.canonical`.
- **`llms.txt`** — `src/app/llms.txt/route.ts`.
- **Redirecciones 301** taxonomía antigua → nueva — `src/proxy.ts` (prefijos) + tabla `redirects` (`src/app/(public)/[...path]`).

## Asistente conversacional (RAG)

`src/app/api/assistant/route.ts` + `src/components/assistant-chat.tsx`

- Recuperación híbrida (vectorial + full-text, fusión RRF) sobre índice unificado `articles` + `archive_index` — `src/lib/search.ts`.
- **Sin fuentes recuperadas → declina responder** (criterio de aceptación).
- Citación: solo se registran como citadas las fuentes referenciadas con `[n]` en la respuesta.
- Guardrails y límite de dominio en el prompt de sistema — `src/agents/prompts.ts`.
- Presupuesto: tope por sesión + tope mensual USD; al superarlo **degrada a búsqueda semántica** sin generación — `src/lib/budget.ts`.
- Log en `assistant_queries` → tablero de demanda informativa (`/panel/demanda`).

## Agentes de producción editorial

`src/agents/draft-generator.ts` (borrador desde fuente estructurada) +
`src/agents/fact-checker.ts` (contrasta cada cifra contra la fuente; marca lo no
verificable). Tope diario configurable. Encolados vía Inngest
(`src/inngest/functions.ts`, evento `agent/draft.requested`).

---

## Estado de los criterios de aceptación

| Criterio | Estado en el scaffold |
|---|---|
| Notas y autores estáticos, regenerados al publicar; portada y categorías sin consultar la base en cada visita | ✅ ISR + revalidación on-demand en Server Actions; portada y categorías con caché de datos que se invalida al publicar |
| Lighthouse móvil ≥ 90 / LCP ≤ 2.5 s | ⏳ base lista (RSC, next/font, next/image, JS mínimo); medir con datos reales |
| `NewsArticle` JSON-LD válido en 100 % de artículos nuevos | ✅ emitido siempre desde el servidor |
| `robots.txt` permite buscadores y buscadores de IA que enlazan, y rechaza el entrenamiento de modelos | ✅ |
| 0 artículos del archivo transformados; URLs legadas 200/301 | ✅ archivo solo lectura; 301 en proxy + tabla `redirects` |
| Asistente: 0 respuestas sin cita verificable | ✅ modo generativo solo con fuentes; declina si no hay |
| Nada generado por agentes visible sin aprobación registrada | ✅ `agent_drafts` + atribución al editor |

`⏳` = requiere despliegue y datos reales para verificar.

---

## Pendiente / siguientes pasos

- Provisionar el proyecto Supabase y Vercel (variables + `vercel.json` ya listo con crons) y configurar el Firewall de Vercel (`docs/seguridad.md`).
- Cliente real de la API del archivo histórico: el cliente ya valida, reintenta y es reanudable, pero hay que contrastarlo con el contrato real de la API (`src/lib/archive-client.ts`).
- Tests e2e (Playwright) de los criterios de aceptación; hoy hay pruebas unitarias y de integración (`npm test`, PGlite en memoria).
- Medir con datos reales (Search Console, Vercel Speed Insights): ver `docs/medicion-core-web-vitals.md`.

## Tareas programadas y el plan de Vercel

`vercel.json` declara dos crons con **frecuencia diaria**, que es el máximo que
permite el plan Hobby (y solo admite dos):

| Cron | Qué hace |
|---|---|
| `/api/cron/publish-scheduled` (11:00 UTC) | Publica las notas programadas que ya llegaron a su hora **y revalida el sitio** (`procesarProgramadas`, `src/lib/scheduled.ts`); refresca TRM/petróleo; y hace el **mantenimiento diario** (`src/lib/mantenimiento.ts`): purga la tabla `rate_limits`, aplica la retención de datos de suscriptores y borra los medios huérfanos. |
| `/api/cron/sync-archive` (07:00 UTC) | Sincroniza el índice del archivo histórico. Es **reanudable**: guarda el cursor tras cada página, así que la carga completa de ~41.000 notas se completa en varias ejecuciones (`?full=1` para forzarla, `?reiniciar=1` para empezar de cero). |

Para que una nota programada salga a su hora sin esperar al cron del día, el
navegador de cualquier visitante avisa a `/api/programadas` (como mucho una vez
cada cinco minutos por navegador y una pasada por minuto en todo el sitio;
`ProgramadasTick`). Las lecturas públicas **no escriben**. Con un programador
externo (p. ej. Supabase `pg_cron`) se puede llamar cada minuto a
`/api/cron/publish-scheduled?solo=programados` con `Authorization: Bearer $CRON_SECRET`.

En cuanto el proyecto pase a Pro conviene devolver los crons a su cadencia real:

```json
{ "path": "/api/cron/publish-scheduled", "schedule": "*/5 * * * *" }
{ "path": "/api/cron/sync-archive",      "schedule": "0 */6 * * *" }
```
