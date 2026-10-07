-- Lectura de suscriptores que la autorizaron expresamente (casilla del formulario del boletín). En producción se aplica a mano
-- en el SQL Editor de Supabase, así que TODAS las sentencias son idempotentes.
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "reading_authorized_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriber_visitors" (
	"subscriber_id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "subscriber_visitors_subscriber_id_visitor_id_pk" PRIMARY KEY("subscriber_id","visitor_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "subscriber_visitors" ADD CONSTRAINT "subscriber_visitors_subscriber_id_newsletter_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."newsletter_subscribers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriber_visitors_visitor_idx" ON "subscriber_visitors" USING btree ("visitor_id");--> statement-breakpoint
-- Datos de comportamiento de personas identificadas: ni la API pública de Supabase puede leerlos.
ALTER TABLE "subscriber_visitors" ENABLE ROW LEVEL SECURITY;
