-- Aviso de tarea nueva del consejo de redacción: cuándo vio el responsable que la pieza le llegó. Idempotente (se aplica a mano en Supabase).
ALTER TABLE "editorial_slots" ADD COLUMN IF NOT EXISTS "responsable_visto_at" timestamp with time zone;
