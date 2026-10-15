-- Listado de artículos del panel con 51 mil notas: ordenar por «última edición» o por fecha de publicación recorría y ordenaba toda la tabla (~3 s).
-- Con estos índices lee solo las 200 filas que muestra. `updated_at` es NOT NULL, así que `DESC` (NULLS FIRST por defecto) coincide con la consulta.
-- Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
CREATE INDEX IF NOT EXISTS "articles_updated_idx" ON "articles" USING btree ("updated_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_published_desc_idx" ON "articles" USING btree ("published_at" DESC NULLS LAST);
