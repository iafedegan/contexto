-- Sesiones locales de quien entra desde la SuperApp de FEDEGÁN (MiniApp «Contexto Ganadero»). Idempotente: en producción se aplica a mano en el SQL Editor de Supabase.
CREATE TABLE IF NOT EXISTS "superapp_sesiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"audience" text NOT NULL,
	"subject" text NOT NULL,
	"session_reference" text NOT NULL,
	"assurance_level" integer DEFAULT 0 NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"validated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "superapp_sesiones_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "superapp_sesiones_vence_idx" ON "superapp_sesiones" USING btree ("expires_at");--> statement-breakpoint
-- Sin acceso por la API pública de Supabase: solo el servidor de la aplicación lee y escribe aquí.
ALTER TABLE "superapp_sesiones" ENABLE ROW LEVEL SECURITY;
