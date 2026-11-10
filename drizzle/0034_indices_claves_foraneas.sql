-- Índices de claves foráneas que se consultan (aviso «unindexed foreign keys» de Supabase). Las demás claves sin índice están en
-- tablas de pocas filas, donde un índice no aporta.
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "authors_user_idx" ON "authors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_uploaded_by_idx" ON "media_assets" USING btree ("uploaded_by");
