-- Etiquetas de suscriptores: grupos que pone el equipo desde el panel («Aliados», «Prensa»…) para enviar una edición solo a quienes las llevan.
-- Idempotente: en producción se aplica a mano en el SQL Editor de Supabase. Hay que aplicarla ANTES de desplegar el código que la usa
-- (el alta del boletín y la lista de suscriptores leen y escriben esta columna).
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
