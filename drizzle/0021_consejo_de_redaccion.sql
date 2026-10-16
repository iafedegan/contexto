-- Consejo de redacción: planes semanales y sus casillas. Idempotente: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
CREATE TABLE IF NOT EXISTS "editorial_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"week_start" date NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"config" jsonb NOT NULL,
	"temas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"activated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editorial_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"publish_at" timestamp with time zone NOT NULL,
	"section_slug" text NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"angle" text DEFAULT '' NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"priority" smallint DEFAULT 2 NOT NULL,
	"approval" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'planificada' NOT NULL,
	"article_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "editorial_plans" ADD CONSTRAINT "editorial_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "editorial_plans" ADD CONSTRAINT "editorial_plans_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "editorial_slots" ADD CONSTRAINT "editorial_slots_plan_id_editorial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."editorial_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "editorial_slots" ADD CONSTRAINT "editorial_slots_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_slots_plan_idx" ON "editorial_slots" USING btree ("plan_id","publish_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_slots_pendientes_idx" ON "editorial_slots" USING btree ("status","publish_at");