-- Comentarios de la revisión de una nota y su estado de lectura (la notificación del listado de artículos).
-- Idempotente (en producción se pega a mano en el SQL Editor de Supabase). Las tablas nuevas nacen con RLS activo, como las demás.

CREATE TABLE IF NOT EXISTS "article_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_comments_body_largo" CHECK (char_length("article_comments"."body") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "article_comment_reads" (
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_comment_reads_article_id_user_id_pk" PRIMARY KEY("article_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "article_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "article_comment_reads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_comments_article_id_articles_id_fk') THEN
    ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_comments_author_id_users_id_fk') THEN
    ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_comment_reads_article_id_articles_id_fk') THEN
    ALTER TABLE "article_comment_reads" ADD CONSTRAINT "article_comment_reads_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_comment_reads_user_id_users_id_fk') THEN
    ALTER TABLE "article_comment_reads" ADD CONSTRAINT "article_comment_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_comments_article_idx" ON "article_comments" USING btree ("article_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_comment_reads_user_idx" ON "article_comment_reads" USING btree ("user_id");
