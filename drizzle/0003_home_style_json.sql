ALTER TABLE "articles" DROP COLUMN "home_size";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "home_span";--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "home_style" jsonb;
