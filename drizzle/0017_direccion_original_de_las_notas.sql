-- Las notas migradas se sirven en su dirección original del sitio anterior (`/seccion/titulo`), sin redirección: la guardamos aquí.
-- Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "legacy_path" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "articles_legacy_path_idx" ON "articles" USING btree ("legacy_path") WHERE legacy_path is not null;
