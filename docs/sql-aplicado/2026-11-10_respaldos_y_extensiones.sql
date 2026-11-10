-- YA APLICADO en producción el 10-nov-2026 (SQL Editor). Se guarda como registro; no lo corre ninguna migración.
-- Avisos del asesor de Supabase (10-nov-2026). Pegar en el SQL Editor; se puede repetir sin problema.
-- 1. Tablas de respaldo de la migración (sin clave primaria, nada del código las usa): pasan a un esquema privado, fuera de la API.
--    Para borrarlas del todo más adelante: DROP SCHEMA respaldo CASCADE;
CREATE SCHEMA IF NOT EXISTS respaldo;
REVOKE ALL ON SCHEMA respaldo FROM PUBLIC, anon, authenticated;
ALTER TABLE IF EXISTS public.respaldo_cuerpos_storyblok SET SCHEMA respaldo;
ALTER TABLE IF EXISTS public.respaldo_orden_portada SET SCHEMA respaldo;
ALTER TABLE IF EXISTS public.articles_meta_title_respaldo SET SCHEMA respaldo;
-- 2. Extensiones fuera de `public`. La conexión de la app ya busca en `extensions` (search_path de postgres), y los índices se mueven con ellas.
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
