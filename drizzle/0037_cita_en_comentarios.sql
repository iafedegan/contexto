-- Cita del fragmento seleccionado al comentar una nota (opcional). Idempotente: se pega a mano en el SQL Editor de Supabase, después de la 0036.

ALTER TABLE "article_comments" ADD COLUMN IF NOT EXISTS "quote" text;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_comments_quote_largo') THEN
    ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_quote_largo" CHECK ("article_comments"."quote" is null or char_length("article_comments"."quote") <= 600);
  END IF;
END $$;
