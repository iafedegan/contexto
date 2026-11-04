-- Personas que entran desde la SuperApp de FEDEGÁN y los navegadores con que leen (pestaña «SuperApp» del análisis).
-- Idempotente: en producción se aplica a mano en el SQL Editor de Supabase.
CREATE TABLE IF NOT EXISTS "superapp_personas" (
	"audience" text NOT NULL,
	"subject" text NOT NULL,
	"email_cifrado" text,
	"documento_tipo" text,
	"documento_cifrado" text,
	"documento_final" text,
	"assurance_level" integer DEFAULT 0 NOT NULL,
	"subscriber_id" uuid,
	"primera_entrada" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima_entrada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "superapp_personas_audience_subject_pk" PRIMARY KEY("audience","subject")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "superapp_visitantes" (
	"audience" text NOT NULL,
	"subject" text NOT NULL,
	"visitor_id" uuid NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "superapp_visitantes_audience_subject_visitor_id_pk" PRIMARY KEY("audience","subject","visitor_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "superapp_personas" ADD CONSTRAINT "superapp_personas_subscriber_id_newsletter_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."newsletter_subscribers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "superapp_personas_ultima_idx" ON "superapp_personas" USING btree ("ultima_entrada");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "superapp_visitantes_visitor_idx" ON "superapp_visitantes" USING btree ("visitor_id");--> statement-breakpoint
-- Sin acceso por la API pública de Supabase: solo el servidor de la aplicación lee y escribe aquí.
ALTER TABLE "superapp_personas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "superapp_visitantes" ENABLE ROW LEVEL SECURITY;
