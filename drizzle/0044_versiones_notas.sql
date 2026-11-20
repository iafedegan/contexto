CREATE TABLE IF NOT EXISTS "article_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid,
	"motivo" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_versions_motivo" CHECK ("article_versions"."motivo" in ('envio', 'devolvio', 'publico', 'aceptado', 'corte', 'rechazo'))
);
--> statement-breakpoint
ALTER TABLE "article_versions" DROP CONSTRAINT IF EXISTS "article_versions_article_id_articles_id_fk";--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_versions" DROP CONSTRAINT IF EXISTS "article_versions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_versions_nota_idx" ON "article_versions" USING btree ("article_id","created_at");
