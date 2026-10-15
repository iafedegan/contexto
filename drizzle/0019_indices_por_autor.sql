-- Notas de un autor (página de la firma, filtro del panel) y notas creadas por una cuenta («mis notas»): sin estos índices la base recorría las
-- 51 mil filas de `articles`. Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
CREATE INDEX IF NOT EXISTS "articles_author_idx" ON "articles" USING btree ("author_id","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_created_by_idx" ON "articles" USING btree ("created_by");
