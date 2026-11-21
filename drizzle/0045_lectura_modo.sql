ALTER TABLE "reader_sessions" ADD COLUMN IF NOT EXISTS "used_magazine" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reader_sessions" ADD COLUMN IF NOT EXISTS "used_listen" boolean DEFAULT false NOT NULL;
