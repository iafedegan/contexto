-- Biblioteca de imágenes: carpetas y archivos que la diseñadora deja listos para las notas, y quién ve cada carpeta.
-- Los archivos viven en el bucket «media»; aquí solo se guarda dónde están. Los de la biblioteca nunca se borran por falta de uso.
-- Idempotente: en producción se aplica a mano en el SQL Editor de Supabase.
CREATE TABLE IF NOT EXISTS "media_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'imagen' NOT NULL,
	"bytes" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_url_unique" UNIQUE("url")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_folder_access" (
	"folder_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_folder_access_folder_id_user_id_pk" PRIMARY KEY("folder_id","user_id")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parent_id_media_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media_folders"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_folder_id_media_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."media_folders"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_folder_access" ADD CONSTRAINT "media_folder_access_folder_id_media_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."media_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_folder_access" ADD CONSTRAINT "media_folder_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_folders_parent_idx" ON "media_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_folder_idx" ON "media_assets" USING btree ("folder_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_folder_access_user_idx" ON "media_folder_access" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "media_folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_folder_access" ENABLE ROW LEVEL SECURITY;
