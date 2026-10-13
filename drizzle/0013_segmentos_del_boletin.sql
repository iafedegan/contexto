-- Segmentos del boletín: a quién va cada edición (ciudad, temas, país, antigüedad). Cada sentencia es IDEMPOTENTE: en producción
-- las migraciones se aplican a mano en el SQL Editor de Supabase, y se puede correr más de una vez sin riesgo.
ALTER TABLE "newsletter_editions" ADD COLUMN IF NOT EXISTS "audience" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "city" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "interests" jsonb DEFAULT '[]'::jsonb NOT NULL;
