-- Búsqueda de texto completo rápida con decenas de miles de notas: el texto indexado (título + resumen + cuerpo, en español) se guarda ya
-- calculado en `search_vec` (columna generada por la base) en vez de recalcularse fila por fila en cada búsqueda. Sustituye al índice por expresión
-- `articles_fts_es`. Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
-- Conviene aplicarla ANTES de cargar las notas del sitio anterior (con la tabla casi vacía es instantánea).
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "search_vec" tsvector GENERATED ALWAYS AS (to_tsvector('spanish', title || ' ' || excerpt || ' ' || body)) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_search_vec_idx" ON "articles" USING gin ("search_vec");--> statement-breakpoint
DROP INDEX IF EXISTS "articles_fts_es";
