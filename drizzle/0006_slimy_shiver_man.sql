CREATE TABLE "article_views_daily" (
	"article_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "article_views_daily_article_id_day_pk" PRIMARY KEY("article_id","day")
);
--> statement-breakpoint
ALTER TABLE "article_views_daily" ADD CONSTRAINT "article_views_daily_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_views_daily_day_idx" ON "article_views_daily" USING btree ("day");