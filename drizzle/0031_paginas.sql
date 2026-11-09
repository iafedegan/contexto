-- Páginas armadas en el panel con el constructor de cuadrícula. Se publican en /{slug}.
-- Idempotente: en producción se aplica a mano en el SQL Editor de Supabase.
CREATE TABLE IF NOT EXISTS "paginas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"titulo" text NOT NULL,
	"descripcion" text,
	"seccion_id" uuid,
	"contenido" jsonb DEFAULT '{"filas":[]}'::jsonb NOT NULL,
	"publicada" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paginas_slug_unique" UNIQUE("slug")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "paginas" ADD CONSTRAINT "paginas_seccion_id_categories_id_fk" FOREIGN KEY ("seccion_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "paginas" ADD CONSTRAINT "paginas_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "paginas_seccion_idx" ON "paginas" USING btree ("seccion_id");
