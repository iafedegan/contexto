# Guía para agentes — CONtexto Ganadero

- **Framework**: Next.js 16 App Router, React Server Components. Server Actions para mutaciones del panel (no crear API REST paralela).
- **Datos**: un solo Postgres (Supabase) + `pgvector`. Esquema en `src/db/schema.ts`. Acceso solo vía `src/db` (`import "server-only"`).
- **El archivo histórico es de SOLO LECTURA**: nunca escribir a la API origen; `archive_index` solo lo actualiza `src/lib/archive-client.ts`.
- **Rutas de contenido**: mantenerlas estáticas (`revalidate` + `generateStaticParams`). La revalidación real es on-demand desde las Server Actions al publicar.
- **IA**: ningún contenido de agente se publica sin acción explícita de un editor. El asistente no responde sin fuentes citables.
- Antes de commit: `npm run lint && npm run typecheck && npm run build`.
- Migraciones: editar `src/db/schema.ts` → `npm run db:generate` → revisar el SQL → `npm run db:migrate`. Índices vectoriales/FTS van en `drizzle/manual/99_post_indexes.sql`.
