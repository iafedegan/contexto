-- Se ejecuta ANTES de `drizzle-kit migrate`.
-- pgvector viene preinstalado en Supabase; solo hay que habilitarlo.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Diccionario de texto en español para full-text search (incluido en Postgres).
-- (no requiere acción; 'spanish' ya existe)
