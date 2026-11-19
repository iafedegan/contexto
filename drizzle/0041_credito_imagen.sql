ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "credit" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT IF EXISTS "media_assets_credit_largo";--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_credit_largo" CHECK (char_length("media_assets"."credit") <= 200);--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT IF EXISTS "media_assets_description_largo";--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_description_largo" CHECK (char_length("media_assets"."description") <= 500);
