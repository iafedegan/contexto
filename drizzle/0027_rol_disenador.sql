-- Rol «disenador» (portada y plantillas sin publicar). Idempotente: en producción se aplica a mano en el SQL Editor de Supabase.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'disenador' BEFORE 'editor';
