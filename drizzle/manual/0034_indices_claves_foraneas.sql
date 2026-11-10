-- Índices de claves foráneas que se consultan (aviso «unindexed foreign keys» de Supabase). Las demás claves sin índice están en tablas
-- de pocas filas, donde un índice no aporta. Idempotente: se puede pegar en el SQL Editor de Supabase. CONCURRENTLY no bloquea la tabla
-- (por eso va fuera de una transacción: ejecutar cada línea tal cual).
CREATE INDEX CONCURRENTLY IF NOT EXISTS sessions_user_idx ON public.sessions (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS authors_user_idx ON public.authors (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS media_assets_uploaded_by_idx ON public.media_assets (uploaded_by);
