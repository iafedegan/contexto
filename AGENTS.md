# Guía para agentes — CONtexto Ganadero

- **Framework**: Next.js 16 App Router, React Server Components. Server Actions para mutaciones del panel (no crear API REST paralela).
- **Datos**: un solo Postgres (Supabase) + `pgvector`. Esquema en `src/db/schema.ts`. Acceso solo vía `src/db` (`import "server-only"`).
- **El archivo histórico es de SOLO LECTURA**: nunca escribir a la API origen; `archive_index` solo lo actualiza `src/lib/archive-client.ts`.
- **Rutas de contenido**: las notas y los autores son estáticos (`revalidate` + `generateStaticParams`). La portada y las categorías son `force-dynamic` a propósito (prerenderizarlas consultaba Supabase en el build y el despliegue caía) pero leen de la caché de datos (`cachear` en `src/lib/data-cache.ts`): una lectura nueva del portal público va por `cachear`, nunca directa a la base. La revalidación real es on-demand desde las Server Actions al publicar (`revalidarNotas` en `src/lib/article-ops.ts` es el único sitio que lo hace). Las lecturas públicas no escriben.
- **IA**: ningún contenido de agente se publica sin acción explícita de un editor. El asistente no responde sin fuentes citables.
- **Arquitectura modular**: el código se organiza en módulos de dominio con dependencias dirigidas (ver `docs/ARQUITECTURA.md`). `npm run lint` incluye `scripts/check-modulos.mjs`: no añadas importaciones fuera del grafo de `scripts/modulos.config.json`; para reaccionar a lo que ocurre en otro módulo usa eventos (`src/lib/eventos.ts`, cableado en `src/lib/oyentes.ts`).
- **Seguridad**: las claves se derivan por propósito con HKDF (`src/lib/claves.ts`); no uses `AUTH_SECRET` directamente. Los límites, los códigos de un solo uso y los intentos van por `src/lib/rate-limit.ts` (`hit`, `usoUnico`). Lo que se descarga de fuera pasa por `src/lib/safe-fetch.ts`. Una operación de leer-modificar-escribir sobre la misma fila va en una sola sentencia o en una transacción con `FOR UPDATE`.
- Antes de commit: `npm run lint && npm run typecheck && npm test && npm run build` (CI además corre `npm audit`).
- Migraciones: editar `src/db/schema.ts` → `npm run db:generate` → revisar el SQL (en producción las migraciones se aplican a mano en el SQL Editor de Supabase, así que cada sentencia debe ser idempotente: `IF NOT EXISTS`) → `npm run db:migrate`. Un archivo suelto en `drizzle/manual/` solo es para extensiones e índices que drizzle-kit no emite (`00_pre_extensions.sql`, `99_post_indexes.sql`); tablas y columnas siempre van en una migración numerada. Hay una prueba que falla si `schema.ts` y las migraciones se separan.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
