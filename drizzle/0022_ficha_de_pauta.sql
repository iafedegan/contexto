-- Ficha de pauta del consejo de redacción. Idempotente: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
ALTER TABLE "editorial_slots" ADD COLUMN IF NOT EXISTS "ficha" jsonb DEFAULT '{}'::jsonb NOT NULL;
