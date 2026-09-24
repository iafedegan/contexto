# Guía para agentes — CONtexto Ganadero

- **Framework**: Next.js 16 App Router, React Server Components. Server Actions para mutaciones del panel (no crear API REST paralela).
- **Datos**: un solo Postgres (Supabase) + `pgvector`. Esquema en `src/db/schema.ts`. Acceso solo vía `src/db` (`import "server-only"`).
- **El archivo histórico es de SOLO LECTURA**: nunca escribir a la API origen; `archive_index` solo lo actualiza `src/lib/archive-client.ts`.
- **Rutas de contenido**: mantenerlas estáticas (`revalidate` + `generateStaticParams`). La revalidación real es on-demand desde las Server Actions al publicar.
- **IA**: ningún contenido de agente se publica sin acción explícita de un editor. El asistente no responde sin fuentes citables.
- Antes de commit: `npm run lint && npm run typecheck && npm run build`.
- Migraciones: editar `src/db/schema.ts` → `npm run db:generate` → revisar el SQL → `npm run db:migrate`. Índices vectoriales/FTS van en `drizzle/manual/99_post_indexes.sql`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
