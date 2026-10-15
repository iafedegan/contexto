-- Editor de portada y portada pública con 51 mil notas: «las ancladas primero y luego las más recientes» ordenaba todas las publicadas para quedarse con
-- 13, 80 o 200. Con este índice parcial lee solo esas primeras filas. `published_at DESC` (NULLS FIRST, el valor por defecto) coincide con las consultas.
-- Idempotente: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
CREATE INDEX IF NOT EXISTS "articles_portada_idx" ON "articles" USING btree ((home_position is null),"home_position","published_at" DESC) WHERE status = 'publicado';
