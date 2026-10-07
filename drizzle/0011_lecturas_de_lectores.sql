-- Lecturas por visitante para el centro de análisis del panel (solo de quien aceptó la medición; sin nombre, correo ni IP).
-- En producción se aplica a mano en el SQL Editor de Supabase, así que TODAS las sentencias son idempotentes.
CREATE TABLE IF NOT EXISTS "reader_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visitor_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"device" text DEFAULT 'otro' NOT NULL,
	"browser" text,
	"os" text,
	"country" text,
	"region" text,
	"city" text,
	"source" text,
	"campaign" text,
	"returning" boolean DEFAULT false NOT NULL,
	"max_scroll" smallint DEFAULT 0 NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "reader_sessions" ADD CONSTRAINT "reader_sessions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reader_sessions_created_idx" ON "reader_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reader_sessions_article_idx" ON "reader_sessions" USING btree ("article_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reader_sessions_visitor_idx" ON "reader_sessions" USING btree ("visitor_id");
