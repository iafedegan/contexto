ALTER TABLE "articles" ADD COLUMN "home_position" integer;--> statement-breakpoint
CREATE INDEX "articles_home_position_idx" ON "articles" USING btree ("home_position");