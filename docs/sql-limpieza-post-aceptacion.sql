-- Limpieza de la base de producción tras la evaluación del 29/10/2026. Se pega a mano en el SQL Editor de Supabase, por pasos y EN ORDEN.
-- Nada de esto lo necesita la aplicación para funcionar: son tareas de higiene que se hacen cuando el cliente ya aceptó la migración.

-- ============================================================================================================================
-- PASO 1 — Archivar las tablas de respaldo de la migración (no se borran: pasan a un esquema que la API pública de Supabase no expone).
-- Solo después de la aceptación. Para devolverlas: ALTER TABLE archivo.<tabla> SET SCHEMA public;
-- Ojo: docs/sql-titulo-seo.sql ya no encontrará `articles_meta_title_respaldo` en `public`; allí se lee `archivo.articles_meta_title_respaldo`.
-- ============================================================================================================================
CREATE SCHEMA IF NOT EXISTS archivo;
REVOKE ALL ON SCHEMA archivo FROM anon, authenticated;

ALTER TABLE IF EXISTS public.respaldo_cuerpos_storyblok SET SCHEMA archivo;
ALTER TABLE IF EXISTS public.articles_meta_title_respaldo SET SCHEMA archivo;

ALTER TABLE IF EXISTS archivo.respaldo_cuerpos_storyblok ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS archivo.articles_meta_title_respaldo ENABLE ROW LEVEL SECURITY;

-- Comprobación (debe listar las dos tablas en `archivo` y ninguna en `public`):
-- select schemaname, tablename from pg_tables where tablename in ('respaldo_cuerpos_storyblok', 'articles_meta_title_respaldo');

-- ============================================================================================================================
-- PASO 2 — Recuperar el espacio de `redirects` (284 filas ocupaban 24 MB por filas muertas de la carga masiva).
-- VACUUM no corre dentro de una transacción: ejecútalo SOLO, sin otras sentencias en la misma ejecución. Bloquea la tabla unos segundos;
-- las direcciones antiguas se sirven con la caché de datos, así que el sitio no lo nota.
-- El índice duplicado `redirects_from_idx` lo quita la migración 0033.
-- ============================================================================================================================
-- VACUUM (FULL, ANALYZE) public.redirects;

-- Comprobación (el tamaño total debe bajar de ~24 MB a menos de 1 MB):
-- select pg_size_pretty(pg_total_relation_size('public.redirects'));

-- ============================================================================================================================
-- PASO 3 — Borrar de `site_settings` lo que ya vive en tablas propias. SOLO cuando el código nuevo lleve días en producción y las
-- comprobaciones coincidan. Antes de esto, `site_settings` conserva la copia de seguridad de los tres datos.
-- ============================================================================================================================
-- Comprobación previa: el número de filas debe cuadrar con lo que se ve en el panel (Configuración → Accesos y permisos).
-- select (select count(*) from user_permission_overrides) permisos,
--        (select count(*) from user_2fa_grace) plazos_2fa,
--        (select count(*) from login_events) accesos;

-- delete from site_settings where key in ('user_permissions', 'plazo_2fa', 'login_log');
