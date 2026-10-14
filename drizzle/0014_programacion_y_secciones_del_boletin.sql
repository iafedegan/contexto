-- Boletín: armado con secciones (`items`) y envío programado (`scheduled_for`). Cada sentencia es IDEMPOTENTE: en producción las
-- migraciones se aplican a mano en el SQL Editor de Supabase, y se puede correr más de una vez sin riesgo.
ALTER TABLE "newsletter_editions" ADD COLUMN IF NOT EXISTS "items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "newsletter_editions" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp with time zone;
