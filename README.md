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
| 4 | Generación estática + borde | `revalidate` + `generateStaticParams` en las rutas de contenido; revalidación *on-demand* en `src/app/api/revalidate` y en las Server Actions del panel |
| 5 | Módulos de dominio, un solo deploy | `src/lib` (contenido, búsqueda, archivo, seo), `src/agents`, `src/inngest` — separados en código, un despliegue |
| 6 | IA con aprobación humana obligatoria | `agent_drafts.status`, `src/app/panel/borradores-ia` — aprobar crea un borrador atribuido al editor; publicar es un paso aparte |

## SEO técnico (corrige los hallazgos del diagnóstico)

- **`NewsArticle` JSON-LD** — `src/lib/seo.ts` + `src/components/json-ld.tsx`, en cada artículo.
- **`robots.txt`** permite explícitamente buscadores y crawlers de IA (GPTBot, ClaudeBot, PerplexityBot…) — `src/app/robots.ts`.
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
| Home/categoría/artículo estáticos, regenerados al publicar | ✅ ISR + revalidación on-demand en Server Actions |
| Lighthouse móvil ≥ 90 / LCP ≤ 2.5 s | ⏳ base lista (RSC, next/font, next/image, JS mínimo); medir con datos reales |
| `NewsArticle` JSON-LD válido en 100 % de artículos nuevos | ✅ emitido siempre desde el servidor |
| `robots.txt` permite crawlers de buscadores y de IA | ✅ |
| 0 artículos del archivo transformados; URLs legadas 200/301 | ✅ archivo solo lectura; 301 en proxy + tabla `redirects` |
| Asistente: 0 respuestas sin cita verificable | ✅ modo generativo solo con fuentes; declina si no hay |
| Nada generado por agentes visible sin aprobación registrada | ✅ `agent_drafts` + atribución al editor |

`⏳` = requiere despliegue y datos reales para verificar.

---

## Pendiente / siguientes pasos

- Provisionar el proyecto Supabase y Vercel (variables + `vercel.json` ya listo con crons).
- Sanitizar el HTML del cuerpo en el panel (p. ej. `sanitize-html`) antes de persistir.
- Editor enriquecido (TipTap) en lugar del textarea HTML.
- Flujo de alta de 2FA (`otplib` ya instalado: `generateSecret` + `generateURI` + QR).
- Cliente real de la API del archivo histórico (ajustar `src/lib/archive-client.ts` al contrato real).
- Gestión de `ads_zones` y newsletter en el panel.
- Tests e2e (Playwright) de los criterios de aceptación.
