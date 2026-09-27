CREATE TABLE "newsletter_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"preheader" text DEFAULT '' NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"article_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"issue" integer,
	"cursor" text,
	"total" integer DEFAULT 0 NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "newsletter_editions" ADD CONSTRAINT "newsletter_editions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_editions_status_idx" ON "newsletter_editions" USING btree ("status","created_at");