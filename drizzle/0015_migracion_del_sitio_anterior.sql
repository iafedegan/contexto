-- Migración del sitio anterior: pie de foto de la portada, secciones adicionales de cada nota e índices para listar categorías con decenas de
-- miles de notas. Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase, y se puede
-- correr más de una vez sin riesgo.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "cover_image_caption" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "secciones" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_category_published_idx" ON "articles" USING btree ("category_id","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_secciones_idx" ON "articles" USING gin ("secciones");
