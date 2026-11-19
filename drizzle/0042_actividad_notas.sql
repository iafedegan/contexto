CREATE TABLE IF NOT EXISTS "article_activity" (
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"dia" date NOT NULL,
	"veces" integer DEFAULT 1 NOT NULL,
	"palabras" integer DEFAULT 0 NOT NULL,
	"primera" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_activity_article_id_user_id_tipo_dia_pk" PRIMARY KEY("article_id","user_id","tipo","dia"),
	CONSTRAINT "article_activity_tipo" CHECK ("article_activity"."tipo" in ('creo', 'recibio', 'reviso', 'edito', 'publico', 'programo', 'envio', 'devolvio')),
	CONSTRAINT "article_activity_no_negativas" CHECK ("article_activity"."veces" >= 0 and "article_activity"."palabras" >= 0)
);
--> statement-breakpoint
ALTER TABLE "article_activity" DROP CONSTRAINT IF EXISTS "article_activity_article_id_articles_id_fk";--> statement-breakpoint
ALTER TABLE "article_activity" ADD CONSTRAINT "article_activity_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_activity" DROP CONSTRAINT IF EXISTS "article_activity_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "article_activity" ADD CONSTRAINT "article_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_activity_user_idx" ON "article_activity" USING btree ("user_id","dia");
