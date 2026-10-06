-- Formaliza en el journal lo que antes eran dos archivos sueltos (drizzle/manual/passkeys.sql y
-- drizzle/manual/newsletter_subscriber_details.sql). Producción ya tiene todo esto aplicado a mano en el SQL Editor de
-- Supabase, así que cada sentencia es IDEMPOTENTE: se puede correr en una base nueva (migrate) o en producción sin riesgo.
CREATE TABLE IF NOT EXISTS "passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" text,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "first_name" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "last_name" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "birth_date" date;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "mobile" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "signup_ip" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "signup_city" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "signup_postal" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "neighborhood" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "signup_geo_source" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "signup_geo_accuracy" numeric;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "signup_country" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "signup_lat" numeric;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "signup_lon" numeric;--> statement-breakpoint
-- El formulario solo pedía «celular»; «teléfono» se descartó por duplicado.
ALTER TABLE "newsletter_subscribers" DROP COLUMN IF EXISTS "phone";--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "passkeys_user_id_idx" ON "passkeys" USING btree ("user_id");
