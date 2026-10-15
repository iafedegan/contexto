-- Para pegar en el SQL Editor de Supabase (proyecto CONTEXTOPRO).
-- Reúne las migraciones 0014 a 0019 del repositorio; todas son idempotentes (se pueden correr más de una vez).

-- ===== 0014_programacion_y_secciones_del_boletin.sql =====
-- Boletín: armado con secciones (`items`) y envío programado (`scheduled_for`). Cada sentencia es IDEMPOTENTE: en producción las
-- migraciones se aplican a mano en el SQL Editor de Supabase, y se puede correr más de una vez sin riesgo.
ALTER TABLE "newsletter_editions" ADD COLUMN IF NOT EXISTS "items" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "newsletter_editions" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp with time zone;

-- ===== 0015_migracion_del_sitio_anterior.sql =====
-- Migración del sitio anterior: pie de foto de la portada, secciones adicionales de cada nota e índices para listar categorías con decenas de
-- miles de notas. Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase, y se puede
-- correr más de una vez sin riesgo.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "cover_image_caption" text;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "secciones" jsonb DEFAULT '[]'::jsonb NOT NULL;
CREATE INDEX IF NOT EXISTS "articles_category_published_idx" ON "articles" USING btree ("category_id","published_at");
CREATE INDEX IF NOT EXISTS "articles_secciones_idx" ON "articles" USING gin ("secciones");

-- ===== 0016_busqueda_en_texto_completo.sql =====
-- Búsqueda de texto completo rápida con decenas de miles de notas: el texto indexado (título + resumen + cuerpo, en español) se guarda ya
-- calculado en `search_vec` (columna generada por la base) en vez de recalcularse fila por fila en cada búsqueda. Sustituye al índice por expresión
-- `articles_fts_es`. Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
-- Conviene aplicarla ANTES de cargar las notas del sitio anterior (con la tabla casi vacía es instantánea).
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "search_vec" tsvector GENERATED ALWAYS AS (to_tsvector('spanish', title || ' ' || excerpt || ' ' || body)) STORED;
CREATE INDEX IF NOT EXISTS "articles_search_vec_idx" ON "articles" USING gin ("search_vec");
DROP INDEX IF EXISTS "articles_fts_es";

-- ===== 0017_direccion_original_de_las_notas.sql =====
-- Las notas migradas se sirven en su dirección original del sitio anterior (`/seccion/titulo`), sin redirección: la guardamos aquí.
-- Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "legacy_path" text;
CREATE UNIQUE INDEX IF NOT EXISTS "articles_legacy_path_idx" ON "articles" USING btree ("legacy_path") WHERE legacy_path is not null;

-- ===== 0018_indices_del_listado_del_panel.sql =====
-- Listado de artículos del panel con 51 mil notas: ordenar por «última edición» o por fecha de publicación recorría y ordenaba toda la tabla (~3 s).
-- Con estos índices lee solo las 200 filas que muestra. `updated_at` es NOT NULL, así que `DESC` (NULLS FIRST por defecto) coincide con la consulta.
-- Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
CREATE INDEX IF NOT EXISTS "articles_updated_idx" ON "articles" USING btree ("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "articles_published_desc_idx" ON "articles" USING btree ("published_at" DESC NULLS LAST);

-- ===== 0019_indices_por_autor.sql =====
-- Notas de un autor (página de la firma, filtro del panel) y notas creadas por una cuenta («mis notas»): sin estos índices la base recorría las
-- 51 mil filas de `articles`. Cada sentencia es IDEMPOTENTE: en producción las migraciones se aplican a mano en el SQL Editor de Supabase.
CREATE INDEX IF NOT EXISTS "articles_author_idx" ON "articles" USING btree ("author_id","published_at" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "articles_created_by_idx" ON "articles" USING btree ("created_by");

